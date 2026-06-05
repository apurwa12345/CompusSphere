"""
Module 2: Exam Form Management
Students submit exam forms; admin approves/rejects.
Tracks subjects, fees, and application status.
"""
import datetime
import os
import razorpay
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

exam_forms_bp = Blueprint('exam_forms', __name__)

# Initialize Razorpay Client safely
razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_placeholder')
razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET', 'secret_placeholder')
razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))


def _to_object_id(value):
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and value:
        try:
            return ObjectId(value)
        except Exception:
            return None
    return None


def _normalize_college_fee_status(raw_status, fees_paid_flag=False):
    """
    Normalize fee status to one of: Paid / Partially Paid / Pending.
    Handles legacy spelling/casing variants from older records.
    """
    status_text = str(raw_status or '').strip().lower()
    if status_text in ['paid', 'full paid', 'fully paid']:
        return 'Paid'
    if status_text in ['partially paid', 'partial paid', 'partiallypaid', 'partial']:
        return 'Partially Paid'
    if fees_paid_flag:
        return 'Paid'
    return 'Pending'


def _best_fee_status_from_submissions(student_id):
    """
    Derive effective accountant fee status from all submissions.
    Priority: Paid > Partially Paid > Pending
    """
    submissions = mongo.db.fee_submissions.find({'student_id': student_id}, {'status': 1})
    has_partial = False
    for sub in submissions:
        normalized = _normalize_college_fee_status(sub.get('status'))
        if normalized == 'Paid':
            return 'Paid'
        if normalized == 'Partially Paid':
            has_partial = True
    return 'Partially Paid' if has_partial else 'Pending'


def _resolve_student_and_fee_status(app_doc):
    """
    Resolve student for an exam application and return normalized fee status.
    Falls back to latest fee submission if student fee_status is missing/legacy.
    """
    sid_raw = app_doc.get('studentId') or app_doc.get('student_id')
    sid_oid = _to_object_id(sid_raw)

    student = None
    if sid_oid:
        student = mongo.db.students.find_one({'_id': sid_oid})
    if not student and sid_raw:
        student = mongo.db.students.find_one({'_id': sid_raw})

    if not student:
        return None, 'Pending'

    normalized_status = _normalize_college_fee_status(
        student.get('fee_status'),
        bool(student.get('fees_paid'))
    )

    if normalized_status == 'Pending':
        normalized_status = _best_fee_status_from_submissions(student['_id'])

    return student, normalized_status



def _verify_utr(utr):
    if not utr or len(utr) != 12 or not utr.isdigit(): 
        return 'SUSPICIOUS'
    
    # Check for too few unique characters (e.g., '111111111111' or '464646464646')
    if len(set(utr)) <= 2:
        return 'SUSPICIOUS'
        
    seq1 = '01234567890123456789'
    seq2 = '98765432109876543210'
    if utr in seq1 or utr in seq2:
        return 'SUSPICIOUS'
    return 'LIKELY_VALID'

def _check_payment_expiry(payment_initiated_at, current_time=None):
    """Check if payment was completed within 5 minutes of initiation."""
    if not payment_initiated_at:
        return False, "Payment initiation time not recorded"
    
    if current_time is None:
        current_time = datetime.datetime.utcnow()
    
    # Convert to datetime if it's a string
    if isinstance(payment_initiated_at, str):
        payment_initiated_at = datetime.datetime.fromisoformat(payment_initiated_at.replace('Z', '+00:00'))
    
    time_elapsed = (current_time - payment_initiated_at).total_seconds()
    max_duration = 5 * 60  # 5 minutes in seconds
    
    if time_elapsed > max_duration:
        return False, f"Payment session expired (submitted after {int(time_elapsed)} seconds)"
    
    return True, "Payment within valid time window"

def _serialize_app(app_doc):
    """Normalize exam application document for frontend."""
    # Convert ObjectIds to strings if they exist, though global provider handles this too
    app_doc['_id'] = str(app_doc['_id'])
    if 'exam_id' in app_doc:
        app_doc['exam_id'] = str(app_doc['exam_id'])
    if 'studentId' in app_doc or 'student_id' in app_doc:
        app_doc['studentId'] = str(app_doc.get('studentId', app_doc.get('student_id', '')))
    
    if 'subjects' in app_doc:
        app_doc['subjects'] = [str(s) for s in app_doc['subjects']]
    
    # Field mapping for frontend compatibility
    app_doc['paymentStatus'] = app_doc.get('paymentStatus', app_doc.get('payment_status', 'PENDING_VERIFICATION'))
    app_doc['UTR'] = app_doc.get('UTR', app_doc.get('transaction_id', ''))
    app_doc['totalFee'] = app_doc.get('totalFee', 1)
    
    # Ensure createdAt is set from any available timestamp field
    raw_date = app_doc.get('createdAt') or app_doc.get('created_at') or app_doc.get('applied_on')
    if raw_date:
        app_doc['createdAt'] = raw_date.isoformat() if hasattr(raw_date, 'isoformat') else str(raw_date)
    else:
        app_doc['createdAt'] = None
    
    # Also handle other date fields
    for field in ['payment_initiated_at', 'payment_verified_at', 'reviewed_at']:
        val = app_doc.get(field)
        if val:
            app_doc[field] = val.isoformat() if hasattr(val, 'isoformat') else str(val)

    app_doc['payment_method'] = app_doc.get('payment_method', 'upi')
    app_doc['razorpay_order_id'] = app_doc.get('razorpay_order_id')
    app_doc['razorpay_payment_id'] = app_doc.get('razorpay_payment_id')
    return app_doc

@exam_forms_bp.route('/create-razorpay-order', methods=['POST'])
@role_required(['Student'])
def create_razorpay_order():
    """Create a Razorpay order for exam fee payment."""
    data = request.get_json()
    amount = data.get('amount', 1) # Default 1 INR for test
    
    try:
        order_data = {
            'amount': amount * 100, # Amount in paise
            'currency': 'INR',
            'receipt': f'receipt_{ObjectId()}'
        }
        order = razorpay_client.order.create(data=order_data)
        
        # Include the Razorpay key so frontend doesn't need to hardcode it
        order['key_id'] = os.getenv('RAZORPAY_KEY_ID')
        
        return jsonify(order), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500


@exam_forms_bp.route('/apply', methods=['POST'])
@role_required(['Student'])
def apply_exam_form():
    """Student submits exam form with selected subjects and fee acknowledgement."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student profile not found'}), 404

    data = request.get_json()
    exam_id = data.get('exam_id')
    subjects = data.get('subjects', [])
    fee_acknowledged = data.get('fee_acknowledged', False)
    transaction_id = data.get('transaction_id', '').strip()
    payment_method = data.get('payment_method', 'unknown')
    payment_initiated_at = data.get('payment_initiated_at')
    
    # Razorpay specific fields
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_signature = data.get('razorpay_signature')

    if not exam_id:
        return jsonify({'message': 'exam_id is required'}), 400
    if not subjects:
        return jsonify({'message': 'At least one subject must be selected'}), 400
    if not fee_acknowledged:
        return jsonify({'message': 'Fee acknowledgement is required'}), 400
    if not transaction_id and payment_method != 'razorpay':
        return jsonify({'message': 'Exam fees must be paid before submission (Transaction ID required)'}), 400

    import re
    if payment_method != 'razorpay' and not re.match(r'^\d{12}$', transaction_id):
        return jsonify({'message': 'Invalid Transaction ID format. It must be exactly 12 digits.'}), 400

    # Check if payment was completed within 5-minute window
    if payment_initiated_at and payment_method != 'razorpay':
        is_valid_time, time_check_msg = _check_payment_expiry(payment_initiated_at)
        if not is_valid_time:
            return jsonify({'message': f'Payment session expired: {time_check_msg}. Please try again.'}), 400

    payment_status = 'PENDING_VERIFICATION'
    
    if payment_method == 'razorpay':
        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return jsonify({'message': 'Missing Razorpay payment details'}), 400
        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
            payment_status = 'VERIFIED'
            transaction_id = razorpay_payment_id
        except razorpay.errors.SignatureVerificationError:
            return jsonify({'message': 'Razorpay signature verification failed'}), 400
    else:
        payment_status = _verify_utr(transaction_id)

    duplicate_utr = mongo.db.exam_applications.find_one({
        '$or': [{'UTR': transaction_id}, {'transaction_id': transaction_id}]
    })
    if duplicate_utr and payment_method != 'razorpay':
        return jsonify({'message': 'This Transaction ID has already been submitted.'}), 409
    elif duplicate_utr and payment_method == 'razorpay':
        return jsonify({'message': 'This Razorpay payment has already been processed.'}), 409

    # Prevent duplicate application
    existing = mongo.db.exam_applications.find_one({
        'exam_id': ObjectId(exam_id),
        '$or': [{'studentId': student['_id']}, {'student_id': student['_id']}]
    })
    if existing:
        return jsonify({'message': 'You have already applied for this exam'}), 409

    # Verify exam exists and is in valid state
    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404
    if exam.get('status') not in ('Upcoming', 'Draft'):
        return jsonify({'message': 'Exam is not accepting applications'}), 400

    subject_oids = [ObjectId(s) for s in subjects]
    total_fee = 1  # Server-side fee recalculation (hardcoded to 1 as requested)
    
    college_fee_status = student.get('fee_status')
    if not college_fee_status:
        college_fee_status = 'Paid' if student.get('fees_paid') else 'Pending'
    is_college_fee_paid = college_fee_status in ['Paid', 'Partially Paid']

    application = {
        'exam_id': ObjectId(exam_id),
        'studentId': student['_id'],
        'subjects': subject_oids,
        'fee_acknowledged': fee_acknowledged,
        'totalFee': total_fee,
        'UTR': transaction_id,
        'paymentStatus': payment_status,
        'payment_method': payment_method,
        'payment_initiated_at': payment_initiated_at,
        'payment_verified_at': datetime.datetime.utcnow() if payment_status == 'VERIFIED' else None,
        'razorpay_order_id': razorpay_order_id,
        'razorpay_payment_id': razorpay_payment_id,
        'razorpay_signature': razorpay_signature,
        'fees_paid': payment_status == 'VERIFIED',  # Only True when payment is genuinely verified
        'createdAt': datetime.datetime.utcnow(),
        'status': 'Pending',  # Always pending until Exam Cell explicitly approves
        'remarks': 'Razorpay payment verified' if payment_status == 'VERIFIED' else ''
    }
    result = mongo.db.exam_applications.insert_one(application)
    log_audit('EXAM_FORM_SUBMITTED', {'exam_id': exam_id, 'student_id': str(student['_id']), 'payment_method': payment_method})
    return jsonify({'message': 'Application submitted successfully', 'application_id': str(result.inserted_id)}), 201


@exam_forms_bp.route('/my-applications', methods=['GET'])
@role_required(['Student'])
def my_applications():
    """Student views their own exam applications."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student profile not found'}), 404

    apps = list(mongo.db.exam_applications.find({
        '$or': [{'studentId': student['_id']}, {'student_id': student['_id']}]
    }))
    result = []
    for a in apps:
        a = _serialize_app(a)
        exam = mongo.db.exams.find_one({'_id': ObjectId(a['exam_id'])})
        a['exam_name'] = exam.get('name') if exam else 'Unknown'
        a['exam_type'] = exam.get('exam_type') if exam else ''
        result.append(a)
    return jsonify(result), 200


@exam_forms_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def list_exam_applications(exam_id):
    """Admin/Exam cell lists all applications for a given exam."""
    status_filter = request.args.get('status')
    query = {'exam_id': ObjectId(exam_id)}
    if status_filter:
        query['status'] = status_filter

    apps = list(mongo.db.exam_applications.find(query).sort('createdAt', -1))
    result = []
    for a in apps:
        a['_id'] = str(a['_id'])
        a['exam_id'] = str(a['exam_id'])
        a['studentId'] = str(a.get('studentId', a.get('student_id', '')))
        if 'subjects' in a:
            a['subjects'] = [str(s) for s in a['subjects']]
        student, college_fee_status = _resolve_student_and_fee_status(a)
        if student:
            a['student_name'] = student.get('name', '')
            a['enrollment_no'] = student.get('enrollment_no', '')
            a['email'] = student.get('email', '')
            a['department'] = student.get('department', '')
            a['department_name'] = student.get('department_name', '')
            a['college_fee_status'] = college_fee_status
        else:
            a['college_fee_status'] = 'Pending'
        a['hall_ticket_generated'] = a.get('hall_ticket_generated', False)
        a['paymentStatus'] = a.get('paymentStatus', a.get('payment_status', 'PENDING_VERIFICATION'))
        a['UTR'] = a.get('UTR', a.get('transaction_id', ''))
        a['totalFee'] = a.get('totalFee', 1)
        raw_date = a.get('createdAt') or a.get('created_at') or a.get('applied_on')
        if raw_date:
            a['createdAt'] = raw_date.isoformat() if hasattr(raw_date, 'isoformat') else str(raw_date)
        else:
            a['createdAt'] = None
        a['payment_method'] = a.get('payment_method', 'upi')
        a['payment_initiated_at'] = a.get('payment_initiated_at')
        a['payment_verified_at'] = a.get('payment_verified_at')
        result.append(a)
    return jsonify(result), 200


@exam_forms_bp.route('/exam/<exam_id>/remaining-students', methods=['GET'])
@role_required(['Exam Cell'])
def list_remaining_students(exam_id):
    """List students who have NOT applied for a specific exam."""
    department = request.args.get('department')
    
    # 1. Find all students
    student_query = {}
    if department and department != 'All Departments':
        student_query['$or'] = [
            {'department': department},
            {'department_name': department}
        ]
    
    all_students = list(mongo.db.students.find(student_query))
    
    # 2. Find student IDs who applied for this exam
    applied_apps = mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id)}, {'studentId': 1, 'student_id': 1})
    applied_student_ids = set()
    for app in applied_apps:
        sid = app.get('studentId') or app.get('student_id')
        if sid:
            applied_student_ids.add(str(sid))
            
    # 3. Filter remaining
    remaining = []
    for s in all_students:
        if str(s['_id']) not in applied_student_ids:
            s['_id'] = str(s['_id'])
            # Include relevant fields for display
            remaining.append({
                '_id': s['_id'],
                'name': s.get('name', 'Unknown'),
                'enrollment_no': s.get('enrollment_no', 'N/A'),
                'department': s.get('department') or s.get('department_name', 'N/A'),
                'current_semester': s.get('current_semester', 'N/A')
            })
            
    return jsonify(remaining), 200


@exam_forms_bp.route('/all', methods=['GET'])
@role_required(['Exam Cell'])
def list_all_applications():
    """List all exam applications across all exams."""
    status_filter = request.args.get('status')
    query = {}
    if status_filter:
        query['status'] = status_filter

    apps = list(mongo.db.exam_applications.find(query).sort('createdAt', -1).limit(200))
    result = []
    for a in apps:
        a['_id'] = str(a['_id'])
        a['exam_id'] = str(a['exam_id'])
        a['studentId'] = str(a.get('studentId', a.get('student_id', '')))
        if 'subjects' in a:
            a['subjects'] = [str(s) for s in a['subjects']]
        student, college_fee_status = _resolve_student_and_fee_status(a)
        if student:
            a['student_name'] = student.get('name', '')
            a['enrollment_no'] = student.get('enrollment_no', '')
            a['college_fee_status'] = college_fee_status
        else:
            a['college_fee_status'] = 'Pending'
        exam = mongo.db.exams.find_one({'_id': ObjectId(a['exam_id'])})
        if exam:
            a['exam_name'] = exam.get('name', '')
        a['paymentStatus'] = a.get('paymentStatus', a.get('payment_status', 'PENDING_VERIFICATION'))
        a['UTR'] = a.get('UTR', a.get('transaction_id', ''))
        a['totalFee'] = a.get('totalFee', 1)
        # Ensure createdAt is set from any available timestamp field
        raw_date = a.get('createdAt') or a.get('created_at') or a.get('applied_on')
        if raw_date:
            a['createdAt'] = raw_date.isoformat() if hasattr(raw_date, 'isoformat') else str(raw_date)
        else:
            a['createdAt'] = None
            
        a['payment_method'] = a.get('payment_method', 'upi')
        
        for field in ['payment_initiated_at', 'payment_verified_at']:
            val = a.get(field)
            if val:
                a[field] = val.isoformat() if hasattr(val, 'isoformat') else str(val)
        result.append(a)
    return jsonify(result), 200


@exam_forms_bp.route('/<application_id>/status', methods=['PATCH'])
@role_required(['Exam Cell'])
def update_application_status(application_id):
    """Approve or reject a student exam application."""
    data = request.get_json()
    new_status = data.get('status')
    remarks = data.get('remarks', '')

    app = mongo.db.exam_applications.find_one({'_id': ObjectId(application_id)})
    if not app:
        return jsonify({'message': 'Application not found'}), 404

    if new_status == 'Approved' and not app.get('fees_paid'):
        return jsonify({'message': 'Cannot approve application while fees are unpaid'}), 400

    if new_status == 'Approved':
        student, college_fee_status = _resolve_student_and_fee_status(app)
        if student:
            if college_fee_status not in ['Paid', 'Partially Paid']:
                return jsonify({'message': 'Cannot approve application: College fees must be Paid or Partially Paid'}), 400

    update_fields = {'status': new_status, 'remarks': remarks, 'reviewed_at': datetime.datetime.utcnow()}
    if new_status == 'Approved':
        update_fields['paymentStatus'] = 'VERIFIED'

    mongo.db.exam_applications.update_one(
        {'_id': ObjectId(application_id)},
        {'$set': update_fields}
    )
    log_audit('EXAM_FORM_STATUS_UPDATE', {'application_id': application_id, 'status': new_status})
    return jsonify({'message': f'Application {new_status}'}), 200


@exam_forms_bp.route('/bulk-approve', methods=['POST'])
@role_required(['Exam Cell'])
def bulk_approve():
    """Bulk approve a list of application IDs."""
    data = request.get_json()
    ids = data.get('application_ids', [])
    if not ids:
        return jsonify({'message': 'No application IDs provided'}), 400

    oids = [ObjectId(i) for i in ids]
    
    valid_oids = []
    for app in mongo.db.exam_applications.find({'_id': {'$in': oids}, 'fees_paid': True}):
        student, college_fee_status = _resolve_student_and_fee_status(app)
        if student:
            if college_fee_status in ['Paid', 'Partially Paid']:
                valid_oids.append(app['_id'])

    if not valid_oids:
        return jsonify({'message': 'No valid applications to approve (fees may be unpaid or college fees not paid)'}), 400

    result = mongo.db.exam_applications.update_many(
        {'_id': {'$in': valid_oids}},
        {'$set': {'status': 'Approved', 'paymentStatus': 'VERIFIED', 'reviewed_at': datetime.datetime.utcnow()}}
    )
    log_audit('EXAM_FORM_BULK_APPROVE', {'count': result.modified_count})
    return jsonify({'message': f'{result.modified_count} applications approved'}), 200
