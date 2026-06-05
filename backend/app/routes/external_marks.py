"""
Module 8: External Marks
Admin enters external (university) marks. Handle absent and malpractice cases.
"""
import datetime
import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from bson.errors import InvalidId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import calculate_grade
from app.utils.excel_processor import process_marks_excel
from app.utils.marks_import_utils import find_student_for_marks_import

external_marks_bp = Blueprint('external_marks', __name__)

SPECIAL_CASES = ['Absent', 'Malpractice', 'Withheld', 'None']


def _coerce_student_object_id(value):
    """Normalize student id from exam_applications / marks docs for Mongo queries."""
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and value:
        try:
            return ObjectId(value)
        except InvalidId:
            return None
    return None


@external_marks_bp.route('/', methods=['POST'])
@role_required(['Exam Cell', 'Faculty'])
def enter_external_marks():
    """Enter/update external marks for a student in a subject."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')
    marks = data.get('marks')
    # Fetch subject to check type
    sub = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})
    is_practical = sub and (sub.get('type') in ['Practical Lab', 'Practical'] or 'L' in sub.get('code', '') or 'Lab' in sub.get('name', '') or int(sub.get('p') or 0) > 0)
    default_max = 40.0 if is_practical else 60.0
    max_marks = float(data.get('max_marks', default_max))
    special_case = data.get('special_case', 'None')  # Absent / Malpractice / Withheld / None

    if not all([exam_id, student_id, subject_id]):
        return jsonify({'message': 'exam_id, student_id, subject_id are required'}), 400
    if special_case not in SPECIAL_CASES:
        return jsonify({'message': f'special_case must be one of {SPECIAL_CASES}'}), 400

    if special_case != 'None':
        # Override marks with 0 but flag the reason
        marks = 0
        grade, grade_point = 'FF', 0
        is_pass = False
    else:
        if marks is None:
            return jsonify({'message': 'marks is required when special_case is None'}), 400
        marks = float(marks)
        if marks < 0 or marks > max_marks:
            return jsonify({'message': f'Marks must be between 0 and {max_marks}'}), 400
        settings = mongo.db.exam_settings.find_one({}) or {}
        passing_pct = settings.get('passing_percentage', 40)
        is_pass = (marks / max_marks * 100) >= passing_pct
        grade, grade_point = calculate_grade(marks, max_marks)

    identity = get_jwt_identity()
    entered_by = identity['email'] if isinstance(identity, dict) else identity
    user = mongo.db.users.find_one({'email': entered_by})
    is_verified = user.get('role') == 'Exam Cell' if user else False

    # Check if locked
    existing = mongo.db.external_marks.find_one({
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id),
        'subject_id': ObjectId(subject_id)
    })
    if existing and existing.get('is_locked'):
        return jsonify({'message': 'Marks are locked and cannot be edited'}), 403

    mongo.db.external_marks.update_one(
        {
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'subject_id': ObjectId(subject_id)
        },
        {'$set': {
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'subject_id': ObjectId(subject_id),
            'marks': marks,
            'max_marks': max_marks,
            'special_case': special_case,
            'grade': grade,
            'grade_point': grade_point,
            'is_pass': is_pass,
            'entered_by': entered_by,
            'entered_at': datetime.datetime.utcnow(),
            'is_verified': is_verified,
            'verification_status': 'Verified' if is_verified else 'Pending'
        },
        '$setOnInsert': {'is_locked': False}},
        upsert=True
    )
    log_audit('EXTERNAL_MARKS_ENTRY', {
        'exam_id': exam_id,
        'student_id': student_id,
        'subject_id': subject_id,
        'special_case': special_case
    })
    return jsonify({'message': 'External marks saved', 'grade': grade}), 200


@external_marks_bp.route('/bulk', methods=['POST'])
@role_required(['Exam Cell', 'Faculty'])
def bulk_enter_external_marks():
    """Bulk enter external marks from a list."""
    data = request.get_json()
    entries = data.get('entries', [])
    if not entries:
        return jsonify({'message': 'No entries provided'}), 400

    identity = get_jwt_identity()
    entered_by = identity['email'] if isinstance(identity, dict) else identity
    user = mongo.db.users.find_one({'email': entered_by})
    is_verified = user.get('role') == 'Exam Cell' if user else False
    success = 0

    for e in entries:
        marks = float(e.get('marks', 0))
        # Check subject type for max marks
        sub = mongo.db.subjects.find_one({'_id': ObjectId(e['subject_id'])})
        is_practical = sub and (sub.get('type') in ['Practical Lab', 'Practical'] or 'L' in sub.get('code', '') or 'Lab' in sub.get('name', '') or int(sub.get('p') or 0) > 0)
        default_max = 40.0 if is_practical else 60.0
        max_marks = float(e.get('max_marks', default_max))
        special_case = e.get('special_case', 'None')
        if special_case != 'None':
            marks = 0
            grade, grade_point = 'FF', 0
            is_pass = False
        else:
            grade, grade_point = calculate_grade(marks, max_marks)
            is_pass = marks >= (max_marks * 0.4)

        # Check if locked
        existing = mongo.db.external_marks.find_one({
            'exam_id': ObjectId(e['exam_id']),
            'student_id': ObjectId(e['student_id']),
            'subject_id': ObjectId(e['subject_id'])
        })
        if existing and existing.get('is_locked'):
            continue  # Skip locked records

        mongo.db.external_marks.update_one(
            {
                'exam_id': ObjectId(e['exam_id']),
                'student_id': ObjectId(e['student_id']),
                'subject_id': ObjectId(e['subject_id'])
            },
            {'$set': {
                'exam_id': ObjectId(e['exam_id']),
                'student_id': ObjectId(e['student_id']),
                'subject_id': ObjectId(e['subject_id']),
                'marks': marks,
                'max_marks': max_marks,
                'special_case': special_case,
                'grade': grade,
                'grade_point': grade_point,
                'is_pass': is_pass,
                'entered_by': entered_by,
                'entered_at': datetime.datetime.utcnow(),
                'is_verified': is_verified,
                'verification_status': 'Verified' if is_verified else 'Pending'
            },
            '$setOnInsert': {'is_locked': False}},
            upsert=True
        )
        success += 1

    log_audit('EXTERNAL_MARKS_BULK', {'count': success})
    return jsonify({'message': f'{success} entries saved'}), 200


@external_marks_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def get_external_marks(exam_id):
    """List all external marks for an exam."""
    marks_list = list(mongo.db.external_marks.find({'exam_id': ObjectId(exam_id)}))
    result = []
    for m in marks_list:
        m['_id'] = str(m['_id'])
        m['exam_id'] = str(m['exam_id'])
        m['student_id'] = str(m['student_id'])
        m['subject_id'] = str(m['subject_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(m['student_id'])})
        if student:
            m['student_name'] = student.get('name', '')
            m['enrollment_no'] = student.get('enrollment_no', '')
        sub = mongo.db.subjects.find_one({'_id': ObjectId(m['subject_id'])})
        if sub:
            m['subject_name'] = sub.get('name', '')
        result.append(m)
    return jsonify(result), 200


@external_marks_bp.route('/exam/<exam_id>/subject/<subject_id>', methods=['GET'])
@role_required(['Exam Cell'])
def get_marks_by_subject(exam_id, subject_id):
    """Get external marks for all students in a given subject."""
    marks_list = list(mongo.db.external_marks.find({
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id)
    }))
    result = []
    for m in marks_list:
        m['_id'] = str(m['_id'])
        m['exam_id'] = str(m['exam_id'])
        m['student_id'] = str(m['student_id'])
        m['subject_id'] = str(m['subject_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(m['student_id'])})
        if student:
            m['student_name'] = student.get('name', '')
            m['enrollment_no'] = student.get('enrollment_no', '')
        result.append(m)
    return jsonify(result), 200
@external_marks_bp.route('/my-results/<exam_id>', methods=['GET'])
@jwt_required()
def get_my_external_results(exam_id):
    """Student fetches their own external grades for a given exam."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    
    student = mongo.db.students.find_one({"email": email})
    if not student:
        return jsonify({'message': 'Student profile not found'}), 404
    
    student_id = student['_id']
    semester = student.get("current_semester")
    
    # 1. Fetch all Theory subjects for this student's semester
    sem_values = []
    if semester is not None and semester != "":
        try:
            sem_int = int(float(semester))
            sem_values = [sem_int, float(sem_int), str(sem_int)]
        except Exception:
            sem_values = [semester, str(semester)]

    sub_query = {}
    if sem_values:
        sub_query["$or"] = [
            {"semester": {"$in": sem_values}},
            {"semester": {"$in": [None, ""]}},
            {"semester": {"$exists": False}}
        ]
    
    all_subjects = list(mongo.db.subjects.find(sub_query))
    
    # 2. Fetch existing external marks
    marks_list = list(mongo.db.external_marks.find({
        'exam_id': ObjectId(exam_id),
        'student_id': student_id
    }))
    
    marks_map = {str(m['subject_id']): m for m in marks_list}
    
    result = []
    total_grade_points = 0
    total_credits = 0
    
    for sub in all_subjects:
        sub_id_str = str(sub['_id'])
        m = marks_map.get(sub_id_str)
        credits = float(sub.get('credits', 0) or 0)
        
        if m:
            gp = float(m.get('grade_point', 0) or 0)
            total_grade_points += (gp * credits)
            total_credits += credits
            
            entry = {
                '_id': str(m['_id']),
                'exam_id': str(m['exam_id']),
                'student_id': str(m['student_id']),
                'subject_id': sub_id_str,
                'subject_name': sub.get('name', ''),
                'subject_code': sub.get('code', ''),
                'credits': credits,
                'marks': m.get('marks', 0),
                'max_marks': m.get('max_marks', 60),
                'grade': m.get('grade', 'FF'),
                'grade_point': gp,
                'special_case': m.get('special_case', 'None'),
                'is_pass': m.get('is_pass', False),
                'status': 'PASSED' if m.get('special_case') == 'None' else m.get('special_case')
            }
        else:
            # Subject exists but no external marks entered/published yet
            entry = {
                '_id': None,
                'exam_id': str(exam_id),
                'student_id': str(student_id),
                'subject_id': sub_id_str,
                'subject_name': sub.get('name', ''),
                'subject_code': sub.get('code', ''),
                'credits': credits,
                'marks': 0,
                'max_marks': 60,
                'grade': 'FF',
                'grade_point': 0,
                'special_case': 'None',
                'is_pass': False,
                'status': 'PENDING'
            }
        result.append(entry)
        
    sgpa = round(total_grade_points / total_credits, 2) if total_credits > 0 else 0
    
    return jsonify({
        'results': result,
        'sgpa': sgpa,
        'cgpa': sgpa # Placeholder
    }), 200


@external_marks_bp.route('/faculty/students-to-mark/<exam_id>/<subject_id>', methods=['GET'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def get_students_for_external_marks(exam_id, subject_id):
    """List students for external marks entry (Faculty view)."""
    # Find subject to get semester/course info
    sub = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})
    if not sub:
        return jsonify({'message': 'Subject not found'}), 404
    
    subject_oid = ObjectId(subject_id)
    exam_oid = ObjectId(exam_id)

    # Students approved for this subject (exam form may store subject ids as ObjectId or string)
    applications = list(mongo.db.exam_applications.find({
        'exam_id': exam_oid,
        'status': 'Approved',
        '$or': [
            {'subjects': subject_oid},
            {'subjects': str(subject_oid)},
            {'subjects': subject_id},
        ],
    }))

    application_student_ids = []
    for a in applications:
        sid = a.get('studentId') or a.get('student_id')
        oid = _coerce_student_object_id(sid)
        if oid:
            application_student_ids.append(oid)

    # Also include anyone who already has marks (e.g. bulk import / marksheet) so the grid shows them
    marks_student_ids = []
    for m in mongo.db.external_marks.find(
        {'exam_id': exam_oid, 'subject_id': subject_oid},
        {'student_id': 1},
    ):
        oid = _coerce_student_object_id(m.get('student_id'))
        if oid:
            marks_student_ids.append(oid)

    merged_ids = list(dict.fromkeys(application_student_ids + marks_student_ids))
    students = list(mongo.db.students.find({'_id': {'$in': merged_ids}})) if merged_ids else []
    students.sort(
        key=lambda s: (
            str(s.get('roll_no') or ''),
            str(s.get('enrollment_no') or ''),
            str(s.get('name') or ''),
        )
    )
    
    # Get existing external marks
    existing_marks = {str(m['student_id']): m for m in mongo.db.external_marks.find({
        'exam_id': exam_oid,
        'subject_id': subject_oid
    })}
    
    result = []
    for s in students:
        sid_str = str(s['_id'])
        m = existing_marks.get(sid_str, {})
        
        # Build student object with all fields needed for frontend class computation
        # Ensure all fields are JSON serializable (convert ObjectIds and datetimes to strings)
        student_data = {k: (str(v) if isinstance(v, (ObjectId, datetime.datetime)) else v) for k, v in s.items() if k not in ['_id']}
        student_data.update({
            'student_id': sid_str,
            'student_name': s.get('name', ''),
            'marks': m.get('marks', ''),
            'max_marks': m.get('max_marks', 60),
            'special_case': m.get('special_case', 'None'),
            'is_verified': m.get('is_verified', False),
            'verification_status': m.get('verification_status', 'Pending' if m else 'Not Entered'),
            'is_submitted_by_faculty': m.get('is_submitted_by_faculty', False)
        })
        result.append(student_data)
    
    return jsonify(result), 200


@external_marks_bp.route('/verify-subject', methods=['POST'])
@role_required(['Exam Cell'])
def verify_subject_external_marks():
    """Exam Cell bulk verifies external marks for a subject."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    
    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400
        
    result = mongo.db.external_marks.update_many(
        {
            'exam_id': ObjectId(exam_id),
            'subject_id': ObjectId(subject_id)
        },
        {'$set': {
            'is_verified': True,
            'verification_status': 'Verified',
            'verified_at': datetime.datetime.utcnow()
        }}
    )
    
    log_audit('EXTERNAL_MARKS_VERIFIED', {'exam_id': exam_id, 'subject_id': subject_id, 'count': result.modified_count})
    return jsonify({'message': f'Verified {result.modified_count} mark records'}), 200

@external_marks_bp.route('/import-excel', methods=['POST'])
@role_required(['Exam Cell', 'Faculty'])
def import_external_marks():
    """Import external marks from an Excel file."""
    exam_id = request.form.get('exam_id')
    subject_id = request.form.get('subject_id')
    
    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400
        
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'No file uploaded'}), 400
        
    print(f"[DEBUG] Starting External Excel import for Exam: {exam_id}, Subject: {subject_id}, File: {file.filename}")
    
    data, metadata, error = process_marks_excel(file)
    if error:
        print(f"[DEBUG] Excel processing error: {error}")
        return jsonify({'message': error}), 400

    target_subject = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})

    # Validation: Check if subject in sheet matches selected subject
    if metadata and metadata.get('subject'):
        if target_subject:
            target_name = str(target_subject.get('name', '')).lower().strip()
            sheet_name = str(metadata.get('subject', '')).lower().strip()
            
            if target_name not in sheet_name and sheet_name not in target_name:
                base_target = re.sub(r'\(.*?\)', '', target_name).strip()
                if base_target not in sheet_name and sheet_name not in base_target:
                    return jsonify({
                        'message': f"Subject mismatch! The Excel sheet is for '{metadata.get('subject')}', but you selected '{target_subject.get('name')}'"
                    }), 400
        
    print(f"[DEBUG] Processed {len(data)} rows from Excel.")
    
    success_count = 0
    not_found = []
    
    identity = get_jwt_identity()
    entered_by = identity['email'] if isinstance(identity, dict) else identity

    for idx, row in enumerate(data):
        roll = row.get('roll_no')
        enroll = row.get('enrollment_no')
        student = find_student_for_marks_import(mongo.db, roll, enroll)

        if not student:
            print(f"[DEBUG] Row {idx+1}: Student not found (Roll: {roll}, Enroll: {enroll})")
            not_found.append(f"Row {idx+1}: {roll or enroll}")
            continue
            
        marks = float(row.get('marks', 0))
        max_marks = float(row.get('max_marks', 60))
        special_case = row.get('status') if row.get('status') in ['Absent', 'Malpractice', 'Withheld'] else 'None'
        
        grade, grade_point = calculate_grade(marks, max_marks)
        is_pass = marks >= (max_marks * 0.4)
        
        print(f"[DEBUG] Row {idx+1}: Updating external marks for {student.get('name')} -> {marks}")

        mongo.db.external_marks.update_one(
            {
                'exam_id': ObjectId(exam_id),
                'student_id': student['_id'],
                'subject_id': ObjectId(subject_id)
            },
            {
                '$set': {
                    'exam_id': ObjectId(exam_id),
                    'student_id': student['_id'],
                    'subject_id': ObjectId(subject_id),
                    'marks': marks,
                    'max_marks': max_marks,
                    'special_case': special_case,
                    'grade': grade,
                    'grade_point': grade_point,
                    'is_pass': is_pass,
                    'entered_by': entered_by,
                    'updated_at': datetime.datetime.utcnow(),
                    'is_verified': False
                },
                '$setOnInsert': {
                    'entered_at': datetime.datetime.utcnow()
                }
            },
            upsert=True
        )
        success_count += 1
        
    log_audit('EXTERNAL_MARKS_IMPORT', {
        'exam_id': exam_id, 
        'subject_id': subject_id, 
        'count': success_count,
        'errors': len(not_found)
    })
    return jsonify({
        'message': f"External marks for '{target_subject.get('name') if target_subject else 'Subject'}' imported successfully for {success_count} students.",
        'failed_count': len(not_found),
        'failed_identifiers': not_found[:10]
    }), 200


@external_marks_bp.route('/lock-subject', methods=['POST'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def lock_subject_external_marks():
    """Exam Cell locks external marks for a subject to prevent further edits."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    
    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400
        
    result = mongo.db.external_marks.update_many(
        {
            'exam_id': ObjectId(exam_id),
            'subject_id': ObjectId(subject_id)
        },
        {'$set': {
            'is_locked': True,
            'locked_at': datetime.datetime.utcnow(),
            'is_verified': True,
            'verification_status': 'Verified'
        }}
    )
    
    log_audit('EXTERNAL_MARKS_LOCKED', {'exam_id': exam_id, 'subject_id': subject_id, 'count': result.modified_count})
    return jsonify({'message': f'Locked {result.modified_count} mark records'}), 200
