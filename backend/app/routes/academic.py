from flask import Blueprint, request, jsonify
import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from bson.objectid import ObjectId
from typing import cast
from pymongo.database import Database

academic_bp = Blueprint('academic', __name__)

# Cast to avoid type checker issues
db = cast(Database, mongo.db)

# --- DEPARTMENTS ---
@academic_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
    deps = list(db.departments.find({}, {"_id": 1, "name": 1, "code": 1}))
    for d in deps:
        d['_id'] = str(d['_id'])
    return jsonify(deps), 200

@academic_bp.route('/departments', methods=['POST'])
@role_required(['Admin', 'HOD'])
def create_department():
    data = request.get_json()
    new_dep = {
        "name": data.get("name"),
        "code": data.get("code")
    }
    result = db.departments.insert_one(new_dep)
    log_audit("CREATE_DEPARTMENT", {"code": new_dep["code"]})
    return jsonify({"message": "Department created", "id": str(result.inserted_id)}), 201

@academic_bp.route('/departments/<id>', methods=['PUT'])
@role_required(['Admin', 'HOD'])
def update_department(id):
    try:
        data = request.get_json()
        update_data = {
            "name": data.get("name"),
            "code": data.get("code")
        }
        # Handle both ObjectId and string IDs
        query_id = id
        if len(id) == 24:
            try:
                query_id = ObjectId(id)
            except Exception:
                pass
        
        db.departments.update_one({"_id": query_id}, {"$set": update_data})
        log_audit("UPDATE_DEPARTMENT", {"id": id, "code": update_data["code"]})
        return jsonify({"message": "Department updated"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@academic_bp.route('/departments/<id>', methods=['DELETE'])
@role_required(['Admin', 'HOD'])
def delete_department(id):
    try:
        # Handle both ObjectId and string IDs
        query_id = id
        if len(id) == 24:
            try:
                query_id = ObjectId(id)
            except Exception:
                pass
                
        db.departments.delete_one({"_id": query_id})
        log_audit("DELETE_DEPARTMENT", {"id": id})
        return jsonify({"message": "Department deleted"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# --- COURSES ---
@academic_bp.route('/courses', methods=['GET'])
@jwt_required()
def get_courses():
    courses = list(db.courses.find({}, {"_id": 1, "name": 1, "code": 1, "department_id": 1, "semesters": 1}))
    for c in courses:
        c['_id'] = str(c['_id'])
    return jsonify(courses), 200

@academic_bp.route('/courses', methods=['POST'])
@role_required(['Admin', 'HOD'])
def create_course():
    data = request.get_json()
    new_course = {
        "name": data.get("name"),
        "code": data.get("code"),
        "department_id": data.get("department_id"),
        "semesters": data.get("semesters", 8) # default 8 semesters
    }
    result = db.courses.insert_one(new_course)
    log_audit("CREATE_COURSE", {"code": new_course["code"]})
    return jsonify({"message": "Course created", "id": str(result.inserted_id)}), 201

# --- SUBJECTS ---
@academic_bp.route('/subjects', methods=['GET'])
@jwt_required()
def get_subjects():
    query = {}
    subject_type = request.args.get('subject_type')
    if subject_type:
        # Match against the 'type' field (or 'subject_type' field) in the DB
        query['$or'] = [
            {'type': subject_type},
            {'subject_type': subject_type}
        ]
    department = request.args.get('department')
    if department:
        query['department'] = department
    subjects = list(db.subjects.find(query))
    import math
    for s in subjects:
        s['_id'] = str(s['_id'])
        if 'course_id' in s:
            s['course_id'] = str(s['course_id'])
        for k, v in list(s.items()):
            if isinstance(v, float) and math.isnan(v):
                s[k] = None
    return jsonify(subjects), 200

@academic_bp.route('/subjects', methods=['POST'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def create_subject():
    data = request.get_json()
    new_subject = {
        "name": data.get("name"),
        "code": data.get("code"),
        "course_id": data.get("course_id"),
        "semester": data.get("semester"),
        "credits": data.get("credits", 3),
        "type": data.get("type", "Theory") # Theory, Practical
    }
    result = db.subjects.insert_one(new_subject)
    log_audit("CREATE_SUBJECT", {"code": new_subject["code"]})
    return jsonify({"message": "Subject created", "id": str(result.inserted_id)}), 201

@academic_bp.route('/subjects/<id>', methods=['PUT'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def update_subject(id):
    try:
        data = request.get_json()
        update_data = {
            "name": data.get("name"),
            "code": data.get("code"),
            "course_id": data.get("course_id"),
            "semester": data.get("semester"),
            "credits": data.get("credits", 3),
            "type": data.get("type", "Theory")
        }
        
        query_id = id
        if len(id) == 24:
            try:
                query_id = ObjectId(id)
            except Exception:
                pass
                
        db.subjects.update_one({"_id": query_id}, {"$set": update_data})
        log_audit("UPDATE_SUBJECT", {"id": id, "code": update_data["code"]})
        return jsonify({"message": "Subject updated"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@academic_bp.route('/subjects/<id>', methods=['DELETE'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def delete_subject(id):
    try:
        query_id = id
        if len(id) == 24:
            try:
                query_id = ObjectId(id)
            except Exception:
                pass
                
        db.subjects.delete_one({"_id": query_id})
        log_audit("DELETE_SUBJECT", {"id": id})
        return jsonify({"message": "Subject deleted"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@academic_bp.route('/student/subjects', methods=['GET'])
@jwt_required()
def get_student_subjects():
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    
    user = db.users.find_one({"email": email})
    if not user or user.get('role') != 'Student':
        return jsonify({"message": "Access denied"}), 403
        
    student = db.students.find_one({"email": email})
    if not student:
        return jsonify({"message": "Student profile not found"}), 404

    semester = student.get("current_semester")
    if not semester:
        return jsonify([]), 200
        
    # Filter by student's current semester, but include subjects without a semester set
    sem_values = []
    if semester is not None and semester != "":
        try:
            sem_int = int(float(semester))
            sem_values = [sem_int, float(sem_int), str(sem_int)]
        except Exception:
            sem_values = [semester, str(semester)]

    if sem_values:
        # Only return subjects that match the student's exact semester
        query = {"semester": {"$in": sem_values}}
    else:
        query = {}

    subjects = list(db.subjects.find(query))

    import math
    for s in subjects:
        s['_id'] = str(s['_id'])
        if 'course_id' in s:
            s['course_id'] = str(s['course_id'])
        # Sanitize NaNs from pandas import
        for k, v in list(s.items()):
            if isinstance(v, float) and math.isnan(v):
                s[k] = None
            
    return jsonify(subjects), 200


# --- FACULTY AND STUDENTS (Academic Profile Management) ---
# Assuming they are created in auth.register first, then their academic profiles are added here by Admin/HOD.

@academic_bp.route('/faculties', methods=['GET'])
@jwt_required()
def get_faculties():
    faculties = list(db.faculties.find({}))
    for f in faculties:
        f['_id'] = str(f['_id'])
    return jsonify(faculties), 200

@academic_bp.route('/faculties', methods=['POST'])
@role_required(['Admin', 'HOD'])
def create_faculty():
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    user = db.users.find_one({"email": email})
    if not user or user.get('role') != 'Faculty':
        return jsonify({"message": "Create a Faculty login under Admin → Create Account first."}), 400

    new_faculty = {
        "name": data.get("name"),
        "email": email,
        "department_id": data.get("department_id"),
        "employee_id": data.get("employee_id"),
        "designation": data.get("designation")
    }
    result = db.faculties.insert_one(new_faculty)
    log_audit("CREATE_FACULTY_PROFILE", {"email": new_faculty["email"]})
    return jsonify({"message": "Faculty profile created", "id": str(result.inserted_id)}), 201

@academic_bp.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    query = {}
    department = request.args.get('department')
    if department:
        # Match department by name or department_name field
        query['$or'] = [
            {'department': department},
            {'department_name': department}
        ]
    group = request.args.get('group')
    if group:
        query['group'] = group
    students = list(db.students.find(query))
    for s in students:
        s['_id'] = str(s['_id'])
    return jsonify(students), 200

@academic_bp.route('/students', methods=['POST'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def create_student():
    data = request.get_json()
    # Ensure user exists as Student role
    user = db.users.find_one({"email": data.get('email')})
    if not user or user.get('role') != 'Student':
        return jsonify({"message": "User not found or not a student"}), 400

    new_student = {
        "name": data.get("name"),
        "email": data.get("email"),
        "enrollment_no": data.get("enrollment_no"),
        "course_id": data.get("course_id"),
        "department_id": data.get("department_id"),
        "class_name": data.get("class_name"),
        "current_semester": data.get("current_semester", 1),
        "batch_year": data.get("batch_year")
    }
    result = db.students.insert_one(new_student)
    log_audit("CREATE_STUDENT_PROFILE", {"enrollment_no": new_student["enrollment_no"]})
    return jsonify({"message": "Student profile created", "id": str(result.inserted_id)}), 201

@academic_bp.route('/admin/students', methods=['POST'])
@role_required(['Admin'])
def admin_create_student():
    """
    Admin endpoint to create a complete student record (both user and student profile).
    Creates user account and student profile in one operation with all available data keys.
    """
    from werkzeug.security import generate_password_hash
    import secrets
    from app.utils.validators import validate_institutional_email
    
    data = request.get_json() or {}
    
    # Validate required fields
    email = (data.get('email') or '').strip().lower()
    name = (data.get('name') or '').strip()
    enrollment_no = (data.get('enrollment_no') or '').strip()
    password = data.get('password') or ''
    
    if not email or not name or not enrollment_no:
        return jsonify({"message": "Email, name, and enrollment number are required"}), 400
    
    # Validate institutional email domain
    is_valid, validation_msg = validate_institutional_email(email)
    if not is_valid:
        return jsonify({"message": validation_msg}), 400
    
    # Check if email already exists
    if db.users.find_one({"email": email}):
        return jsonify({"message": "Email already registered"}), 400
    
    # Check if enrollment_no already exists
    if db.students.find_one({"enrollment_no": enrollment_no}):
        return jsonify({"message": "Enrollment number already exists"}), 400
    
    # Generate password if not provided
    if not password:
        password = secrets.token_urlsafe(8)
    
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400
    
    try:
        # Create user account
        hashed_pw = generate_password_hash(password)
        new_user = {
            "email": email,
            "password": hashed_pw,
            "role": "Student",
            "name": name,
            "mobile": data.get('mobile') or data.get('phone') or '',
            "phone": data.get('mobile') or data.get('phone') or '',
            "gender": data.get('gender') or '',
            "dob": data.get('dob') or '',
            "department": data.get('department') or '',
            "enrollment_number": enrollment_no,
            "year": data.get('year') or data.get('batch_year') or '',
            "roll_no": data.get('roll_no') or '',
            "group": data.get('group') or 'A',
            "created_at": datetime.datetime.utcnow()
        }
        
        user_result = db.users.insert_one(new_user)
        user_id = str(user_result.inserted_id)
        
        # Create student profile
        new_student = {
            "name": name,
            "email": email,
            "enrollment_no": enrollment_no,
            "user_id": user_result.inserted_id,
            "course_id": data.get('course_id') or '',
            "department_id": data.get('department_id') or '',
            "class_name": data.get('class_name') or '',
            "current_semester": int(data.get('current_semester', 1)),
            "batch_year": data.get('batch_year') or data.get('year') or '',
            "roll_no": data.get('roll_no') or '',
            "group": data.get('group') or 'A',
            "dob": data.get('dob') or '',
            "mobile": data.get('mobile') or data.get('phone') or '',
            "phone": data.get('mobile') or data.get('phone') or '',
            "gender": data.get('gender') or '',
            "created_at": datetime.datetime.utcnow()
        }
        
        student_result = db.students.insert_one(new_student)
        student_id = str(student_result.inserted_id)
        
        log_audit("ADMIN_CREATE_STUDENT", {
            "enrollment_no": enrollment_no,
            "email": email,
            "user_id": user_id,
            "student_id": student_id
        })
        
        return jsonify({
            "message": "Student created successfully",
            "user_id": user_id,
            "student_id": student_id,
            "email": email,
            "enrollment_no": enrollment_no,
            "temporary_password": password
        }), 201
        
    except Exception as e:
        return jsonify({"message": f"Error creating student: {str(e)}"}), 500

# --- FACULTY ALLOCATIONS ---
@academic_bp.route('/allocate-faculty', methods=['POST'])
@role_required(['Admin', 'HOD'])
def allocate_faculty():
    data = request.get_json()
    faculty_id = data.get("faculty_id")
    subject_id = data.get("subject_id")
    semester = data.get("semester")

    if not faculty_id or not subject_id or not semester:
        return jsonify({"message": "All fields are required"}), 400

    allocation = {
        "faculty_id": ObjectId(faculty_id) if isinstance(faculty_id, str) and len(faculty_id) == 24 else faculty_id,
        "subject_id": ObjectId(subject_id) if isinstance(subject_id, str) and len(subject_id) == 24 else subject_id,
        "semester": int(semester),
        "class_value": data.get("classValue"),
        "allocated_at": datetime.datetime.utcnow()
    }
    
    # Upsert: Update if same faculty, subject, and semester
    query = {
        "faculty_id": allocation["faculty_id"],
        "subject_id": allocation["subject_id"],
        "semester": allocation["semester"],
        "class_value": allocation["class_value"]
    }
    db.faculty_allocations.update_one(query, {"$set": allocation}, upsert=True)
    
    log_audit("ALLOCATE_FACULTY_SUBJECT", {"faculty_id": str(faculty_id), "subject_id": str(subject_id)})
    return jsonify({"message": "Faculty allocated successfully"}), 201

@academic_bp.route('/faculty/my-subjects', methods=['GET'])
@jwt_required()
def get_faculty_my_subjects():
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    
    faculty = db.faculties.find_one({"email": email})
    if not faculty:
        return jsonify({"message": "Faculty profile not found"}), 404
        
    faculty_id = faculty['_id']
    allocations = list(db.faculty_allocations.find({"faculty_id": faculty_id}))
    
    alloc_map = {}
    for a in allocations:
        sid = str(a.get('subject_id'))
        if sid not in alloc_map:
            alloc_map[sid] = []
        if a.get('class_value'):
            alloc_map[sid].append(a.get('class_value'))
    
    subject_ids = [a.get('subject_id') for a in allocations if a.get('subject_id')]
    if not subject_ids:
        return jsonify([]), 200
        
    subjects = list(db.subjects.find({"_id": {"$in": subject_ids}}))
    for s in subjects:
        s['_id'] = str(s['_id'])
        if 'course_id' in s:
            s['course_id'] = str(s['course_id'])
        s['allocated_classes'] = alloc_map.get(s['_id'], [])
            
    return jsonify(subjects), 200

@academic_bp.route('/allocations', methods=['GET'])
@jwt_required()
def get_allocations():
    allocations = list(db.faculty_allocations.find({}))
    for a in allocations:
        a['_id'] = str(a['_id'])
        a['faculty_id'] = str(a['faculty_id'])
        a['subject_id'] = str(a['subject_id'])
    return jsonify(allocations), 200

@academic_bp.route('/allocations/<id>', methods=['PUT'])
@role_required(['Admin', 'HOD'])
def update_allocation(id):
    data = request.get_json()
    faculty_id = data.get("faculty_id")
    subject_id = data.get("subject_id")
    semester = data.get("semester")

    if not faculty_id or not subject_id or not semester:
        return jsonify({"message": "All fields are required"}), 400

    try:
        allocation_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid allocation id"}), 400

    update_data = {
        "faculty_id": ObjectId(faculty_id) if isinstance(faculty_id, str) and len(faculty_id) == 24 else faculty_id,
        "subject_id": ObjectId(subject_id) if isinstance(subject_id, str) and len(subject_id) == 24 else subject_id,
        "semester": int(semester),
        "class_value": data.get("classValue")
    }

    existing = db.faculty_allocations.find_one({"_id": allocation_id})
    if not existing:
        return jsonify({"message": "Allocation not found"}), 404

    duplicate_query = {
        "faculty_id": update_data["faculty_id"],
        "subject_id": update_data["subject_id"],
        "semester": update_data["semester"],
        "class_value": update_data["class_value"],
        "_id": {"$ne": allocation_id}
    }
    if db.faculty_allocations.find_one(duplicate_query):
        return jsonify({"message": "This allocation already exists"}), 409

    db.faculty_allocations.update_one({"_id": allocation_id}, {"$set": update_data})
    log_audit("UPDATE_FACULTY_ALLOCATION", {"allocation_id": id})
    return jsonify({"message": "Allocation updated successfully"}), 200

@academic_bp.route('/allocations/<id>', methods=['DELETE'])
@role_required(['Admin', 'HOD'])
def delete_allocation(id):
    try:
        allocation_id = ObjectId(id)
    except Exception:
        return jsonify({"message": "Invalid allocation id"}), 400

    result = db.faculty_allocations.delete_one({"_id": allocation_id})
    if result.deleted_count == 0:
        return jsonify({"message": "Allocation not found"}), 404

    log_audit("DELETE_FACULTY_ALLOCATION", {"allocation_id": id})
    return jsonify({"message": "Allocation deleted successfully"}), 200
