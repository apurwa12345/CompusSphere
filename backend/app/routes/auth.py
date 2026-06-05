from flask import Blueprint, request, jsonify
from flask import current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.validators import validate_institutional_email
import datetime
import hashlib
import secrets
import smtplib
import ssl
from email.message import EmailMessage

auth_bp = Blueprint('auth', __name__)

STAFF_ROLES = ('Faculty', 'Exam Cell', 'Accountant')
RESET_OTP_EXPIRES_MINUTES = 10


def _normalize_email(value):
    return (value or '').strip().lower()


def _serialize_staff_user(user):
    created = user.get('created_at')
    return {
        '_id': str(user.get('_id')),
        'name': user.get('name', ''),
        'email': user.get('email', ''),
        'role': user.get('role', ''),
        'mobile': user.get('mobile') or user.get('phone') or '',
        'dept': user.get('dept') or user.get('department') or '',
        'created_at': created.isoformat() if hasattr(created, 'isoformat') else created,
    }


def _build_staff_user_document(data, email, role, name):
    """Build a user document matching the existing users collection format."""
    mobile = (data.get('mobile') or data.get('phone') or '').strip()
    doc = {
        'email': email,
        'password': generate_password_hash(data.get('password')),
        'role': role,
        'name': name,
        'mobile': mobile,
        'phone': mobile,
        'gender': data.get('gender') or '',
        'dept': (data.get('dept') or '').strip(),
        'department': (data.get('dept') or '').strip(),
        'caserp_id': (data.get('employee_id') or data.get('caserp_id') or '').strip(),
        'qualifications': (data.get('qualifications') or '').strip(),
        'experience': (data.get('experience') or '').strip(),
        'created_at': datetime.datetime.utcnow(),
    }
    return doc


def _hash_reset_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _send_student_reset_otp_email(email, otp):
    sender = current_app.config.get('MAIL_SENDER')
    username = current_app.config.get('MAIL_USERNAME')
    password = (current_app.config.get('MAIL_PASSWORD') or '').replace(' ', '')
    server = current_app.config.get('MAIL_SERVER') or 'smtp.gmail.com'
    port = int(current_app.config.get('MAIL_PORT') or 587)

    if not username or not password or not sender:
        raise RuntimeError('Email service is not configured. Set MAIL_USERNAME and MAIL_PASSWORD.')

    message = EmailMessage()
    message['Subject'] = 'Student password reset OTP'
    message['From'] = sender
    message['To'] = email
    message.set_content(
        "Hello,\n\n"
        "Use this OTP to reset your student account password:\n\n"
        f"{otp}\n\n"
        f"This OTP expires in {RESET_OTP_EXPIRES_MINUTES} minutes and can be used only once.\n\n"
        "If you did not request this, please ignore this email.\n"
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(server, port) as smtp:
        smtp.starttls(context=context)
        smtp.login(username, password)
        smtp.send_message(message)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    role = data.get('role', 'Student') # Default to Student
    name = data.get('name')
    mobile = data.get('mobile') or data.get('phone')
    gender = data.get('gender')
    if not email:
        return jsonify({"message": "Email is required"}), 400

    # Validate institutional email domain
    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({"message": validation_msg}), 400

    # Allow only verified student emails from the students collection to register
    if role == "Student":
        email_student = mongo.db.students.find_one({"email": email})
        prn = data.get('enrollment_number')
        prn_student = mongo.db.students.find_one({"enrollment_no": prn}) if prn else None

        if not email_student and not prn_student:
            return jsonify({"message": "Registration allowed only for listed students. Contact admin."}), 403

        # If both provided, ensure they match the same student record
        if email_student and prn and email_student.get("enrollment_no") != prn:
            return jsonify({"message": "Email and PRN do not match our records."}), 400

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"message": "User already exists"}), 400

    hashed_pw = generate_password_hash(password)
    new_user = {
        "email": email,
        "password": hashed_pw,
        "role": role,
        "name": name,
        "mobile": mobile,
        "phone": mobile,
        "gender": gender,
        "created_at": datetime.datetime.utcnow()
    }

    # Student-specific fields
    if role == "Student":
        new_user.update({
            "department": data.get('department'),
            "enrollment_number": data.get('enrollment_number'),
            "year": data.get('year'),
            "dob": data.get('dob'),
            "roll_no": data.get('roll_no'),
            "group": data.get('group')
        })
    else:
        # Staff-specific fields (Faculty, HOD, Exam Cell, Admin)
        new_user.update({
            "dept": data.get('dept'),
            "caserp_id": data.get('caserp_id'),
            "qualifications": data.get('qualifications'),
            "experience": data.get('experience')
        })
    mongo.db.users.insert_one(new_user)
    return jsonify({"message": "User registered successfully"}), 201


@auth_bp.route('/admin/staff', methods=['GET'])
@role_required(['Admin'])
def list_staff_accounts():
    """List Faculty, Exam Cell, and Accountant login accounts."""
    role_filter = request.args.get('role')
    query = {'role': {'$in': list(STAFF_ROLES)}}
    if role_filter in STAFF_ROLES:
        query['role'] = role_filter

    users = list(mongo.db.users.find(query, {'password': 0}).sort('created_at', -1))
    return jsonify([_serialize_staff_user(u) for u in users]), 200


@auth_bp.route('/admin/staff', methods=['POST'])
@role_required(['Admin'])
def create_staff_account():
    """Admin creates Exam Cell, Accountant, or Faculty login — saved to users collection."""
    data = request.get_json() or {}
    email = _normalize_email(data.get('email'))
    password = data.get('password') or ''
    role = (data.get('role') or '').strip()
    name = (data.get('name') or '').strip()

    if not name or not email or not password:
        return jsonify({'message': 'Name, email, and password are required'}), 400
    
    # Validate institutional email domain
    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({'message': validation_msg}), 400
    
    if role not in STAFF_ROLES:
        return jsonify({'message': f'Role must be one of: {", ".join(STAFF_ROLES)}'}), 400
    if len(password) < 6:
        return jsonify({'message': 'Password must be at least 6 characters'}), 400
    if mongo.db.users.find_one({'email': email}):
        return jsonify({'message': 'An account with this email already exists'}), 400

    new_user = _build_staff_user_document(data, email, role, name)
    result = mongo.db.users.insert_one(new_user)

    faculty_profile_id = None
    if role == 'Faculty':
        employee_id = (data.get('employee_id') or data.get('caserp_id') or '').strip()
        department_id = data.get('department_id') or ''
        designation = (data.get('designation') or '').strip()
        if employee_id and department_id and designation:
            profile = {
                'name': name,
                'email': email,
                'employee_id': employee_id,
                'department_id': department_id,
                'designation': designation,
            }
            existing = mongo.db.faculties.find_one({'email': email})
            if existing:
                mongo.db.faculties.update_one({'_id': existing['_id']}, {'$set': profile})
                faculty_profile_id = str(existing['_id'])
            else:
                fac_res = mongo.db.faculties.insert_one(profile)
                faculty_profile_id = str(fac_res.inserted_id)

    log_audit('ADMIN_CREATE_STAFF', {'email': email, 'role': role})
    return jsonify({
        'message': f'{role} account created successfully',
        'user_id': str(result.inserted_id),
        'faculty_profile_id': faculty_profile_id,
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    if not email:
        return jsonify({"message": "Email is required"}), 400

    # Validate institutional email domain
    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({"message": validation_msg}), 400

    user = mongo.db.users.find_one({"email": email})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"message": "Invalid email or password"}), 401

    # For students, verify they exist in the students collection
    if user.get('role') == 'Student':
        student = mongo.db.students.find_one({"email": email})
        if not student:
            return jsonify({"message": "Access denied. Student record not found."}), 403

    # Use additional_claims for the role to keep identity simple (string email)
    access_token = create_access_token(identity=email, additional_claims={"role": user['role']})
    
    from app.utils.logger import log_audit
    log_audit(action="LOGIN", details={"user": email})
    
    return jsonify(access_token=access_token, role=user['role'], name=user['name']), 200


@auth_bp.route('/student/forgot-password', methods=['POST'])
def student_forgot_password():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    generic_message = 'If a student account exists, a reset OTP has been sent.'

    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({'message': validation_msg}), 400

    user = mongo.db.users.find_one({'email': email})
    student = mongo.db.students.find_one({'email': email})
    if not user or user.get('role') != 'Student' or not student:
        return jsonify({'message': generic_message}), 200

    otp = f'{secrets.randbelow(1000000):06d}'
    otp_hash = _hash_reset_token(otp)
    now = datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(minutes=RESET_OTP_EXPIRES_MINUTES)

    mongo.db.password_reset_tokens.update_many(
        {'email': email, 'used_at': None},
        {'$set': {'used_at': now, 'invalidated_at': now}}
    )
    mongo.db.password_reset_tokens.insert_one({
        'email': email,
        'otp_hash': otp_hash,
        'role': 'Student',
        'created_at': now,
        'expires_at': expires_at,
        'used_at': None,
    })

    try:
        _send_student_reset_otp_email(email, otp)
        log_audit('STUDENT_PASSWORD_RESET_REQUEST', {'email': email})
    except Exception as exc:
        current_app.logger.exception('Failed to send student password reset OTP email')
        mongo.db.password_reset_tokens.update_one(
            {'email': email, 'otp_hash': otp_hash},
            {'$set': {'used_at': now, 'send_error': str(exc)}}
        )
        return jsonify({'message': 'Unable to send reset OTP. Please contact admin.'}), 500

    return jsonify({'message': generic_message}), 200


@auth_bp.route('/student/verify-reset-otp', methods=['POST'])
def student_verify_reset_otp():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    otp = ''.join(ch for ch in (data.get('otp') or '') if ch.isdigit())

    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({'message': validation_msg}), 400
    if len(otp) != 6:
        return jsonify({'message': 'A valid 6-digit OTP is required'}), 400

    otp_hash = _hash_reset_token(otp)
    now = datetime.datetime.utcnow()
    token_doc = mongo.db.password_reset_tokens.find_one({
        'email': email,
        'otp_hash': otp_hash,
        'role': 'Student',
        'used_at': None,
    })

    if not token_doc or token_doc.get('expires_at') < now:
        return jsonify({'message': 'OTP is invalid or expired'}), 400

    user = mongo.db.users.find_one({'email': email})
    student = mongo.db.students.find_one({'email': email})
    if not user or user.get('role') != 'Student' or not student:
        return jsonify({'message': 'OTP is invalid or expired'}), 400

    mongo.db.password_reset_tokens.update_one(
        {'_id': token_doc['_id']},
        {'$set': {'verified_at': now}}
    )
    return jsonify({'message': 'OTP verified. You can now create a new password.'}), 200


@auth_bp.route('/student/reset-password', methods=['POST'])
def student_reset_password():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    otp = ''.join(ch for ch in (data.get('otp') or '') if ch.isdigit())
    new_password = data.get('password') or ''

    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({'message': validation_msg}), 400
    if len(otp) != 6:
        return jsonify({'message': 'A valid 6-digit OTP is required'}), 400
    if len(new_password) < 6:
        return jsonify({'message': 'Password must be at least 6 characters'}), 400

    otp_hash = _hash_reset_token(otp)
    now = datetime.datetime.utcnow()
    token_doc = mongo.db.password_reset_tokens.find_one({
        'email': email,
        'otp_hash': otp_hash,
        'role': 'Student',
        'used_at': None,
    })

    if not token_doc or token_doc.get('expires_at') < now:
        return jsonify({'message': 'OTP is invalid or expired'}), 400

    user = mongo.db.users.find_one({'email': email})
    student = mongo.db.students.find_one({'email': email})
    if not user or user.get('role') != 'Student' or not student:
        return jsonify({'message': 'OTP is invalid or expired'}), 400

    mongo.db.users.update_one(
        {'email': email},
        {'$set': {'password': generate_password_hash(new_password), 'password_updated_at': now}}
    )
    mongo.db.password_reset_tokens.update_one(
        {'_id': token_doc['_id']},
        {'$set': {'used_at': now}}
    )
    log_audit('STUDENT_PASSWORD_RESET_COMPLETE', {'email': email})

    return jsonify({'message': 'Password changed successfully. Please login with your new password.'}), 200


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    identity = get_jwt_identity()
    # Handle both string and potentially old dict identities
    email = identity['email'] if isinstance(identity, dict) else identity
    
    user_data = mongo.db.users.find_one({"email": email}, {"_id": 0, "password": 0, "created_at": 0})
    if not user_data:
        return jsonify({"message": "User not found"}), 404

    # Normalize fields for frontend consistency
    if user_data.get('role') == 'Student':
        # Add aliases for commonly used fields
        if 'enrollment_number' in user_data:
            user_data['prn'] = user_data['enrollment_number']
        if 'year' in user_data:
            user_data['batch_year'] = user_data['year']

    # Enrich with student academic profile when available from students collection
    student = mongo.db.students.find_one({"email": email})
    if student:
        user_data.update({
            "student_id": str(student.get("_id")) if student.get("_id") else "",
            "current_semester": student.get("current_semester") or user_data.get("current_semester") or 1,
            "department_id": str(student.get("department_id")) if student.get("department_id") else user_data.get("department_id") or "",
            "enrollment_no": student.get("enrollment_no") or user_data.get("enrollment_number") or "",
            "batch_year": student.get("batch_year") or user_data.get("year") or "",
            "prn": student.get("prn") or student.get("enrollment_no") or user_data.get("enrollment_number") or user_data.get("prn") or "",
            "abc_id": student.get("abc_id") or "",
            "dob": student.get("dob") or user_data.get("dob") or "",
            "mobile": student.get("mobile") or student.get("phone") or user_data.get("mobile") or user_data.get("phone") or "",
            "phone": student.get("phone") or student.get("mobile") or user_data.get("phone") or user_data.get("mobile") or "",
            "group": student.get("group") or "A",
            "first_name": student.get("first_name") or user_data.get("first_name") or "",
            "last_name": student.get("last_name") or user_data.get("last_name") or "",
            "branch": student.get("branch") or "",
            "semester": student.get("semester") or student.get("current_semester") or 1,
        })
    
    return jsonify(user_data), 200
    
@auth_bp.route('/update-profile-picture', methods=['POST'])
@jwt_required()
def update_profile_picture():
    try:
        identity = get_jwt_identity()
        email = identity['email'] if isinstance(identity, dict) else identity
        
        data = request.get_json()
        profile_picture = data.get('profile_picture') # Base64 string
        
        if not profile_picture:
            return jsonify({"message": "No image data provided"}), 400
            
        # Update users collection
        mongo.db.users.update_one(
            {"email": email},
            {"$set": {"profile_picture": profile_picture}}
        )
        
        # Update students collection if applicable
        mongo.db.students.update_one(
            {"email": email},
            {"$set": {"profile_picture": profile_picture}}
        )
        
        return jsonify({"message": "Profile picture updated successfully"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@auth_bp.route('/delete-profile-picture', methods=['DELETE'])
@jwt_required()
def delete_profile_picture():
    try:
        identity = get_jwt_identity()
        email = identity['email'] if isinstance(identity, dict) else identity
        
        # Unset in users collection
        mongo.db.users.update_one(
            {"email": email},
            {"$unset": {"profile_picture": ""}}
        )
        
        # Unset in students collection if applicable
        mongo.db.students.update_one(
            {"email": email},
            {"$unset": {"profile_picture": ""}}
        )
        
        return jsonify({"message": "Profile picture removed successfully"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
