"""
Module 7: Internal Marks
Faculty enters internal marks. Admin/Exam Cell verifies and locks.
"""
import datetime
import re
import math
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from bson.errors import InvalidId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.excel_processor import process_marks_excel
from app.utils.marks_import_utils import find_student_for_marks_import

internal_marks_bp = Blueprint('internal_marks', __name__)

INTERNAL_EXAM_TYPES = {'ca1', 'ca2', 'periodic_test_1', 'mid_semester_exam', 'periodic_test_2', 'practical_internal'}
CA_INTERNAL_EXAM_TYPES = {'ca1', 'ca2'}
DEFAULT_INTERNAL_MAX_MARKS = 20.0


def _safe_object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError, ValueError):
        return None


def _build_student_internal_marks_query(exam_id, student_id, exam_type=None):
    query = {'student_id': student_id}
    exam_object_id = _safe_object_id(exam_id)
    if exam_object_id:
        query['exam_id'] = exam_object_id
    elif exam_type:
        query['exam_type'] = exam_type
    else:
        query['exam_type'] = {'$in': list(INTERNAL_EXAM_TYPES)}
    return query


@internal_marks_bp.route('/', methods=['POST'])
@role_required(['Faculty'])
def enter_internal_marks():
    """Faculty enters or updates internal marks for a student."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity

    data = request.get_json()
    exam_id = data.get('exam_id')
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')
    exam_type = data.get('exam_type', 'periodic_test_1')
    marks = float(data.get('marks', 0))
    settings = mongo.db.exam_settings.find_one({}) or {}
    configured_max = settings.get('max_internal_marks', DEFAULT_INTERNAL_MAX_MARKS)
    if exam_type == 'practical_internal':
        default_max = 60.0
    elif exam_type in CA_INTERNAL_EXAM_TYPES:
        default_max = 10.0
    elif exam_type in INTERNAL_EXAM_TYPES:
        default_max = configured_max
    else:
        default_max = DEFAULT_INTERNAL_MAX_MARKS
    max_marks = float(data.get('max_marks', default_max))

    if not all([exam_id, student_id, subject_id]):
        return jsonify({'message': 'exam_id, student_id, subject_id are required'}), 400
    if marks < 0 or marks > max_marks:
        return jsonify({'message': f'Marks must be between 0 and {max_marks}'}), 400

    # Check if locked
    existing = mongo.db.internal_marks.find_one({
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id),
        'subject_id': ObjectId(subject_id),
        'exam_type': exam_type
    })
    if existing and existing.get('is_locked'):
        return jsonify({'message': 'Marks are locked and cannot be modified'}), 403

    passing = settings.get('min_internal_marks', 12)
    if exam_type == 'practical_internal':
        passing = 24.0 # 40% of 60

    # Don't set status for CA1 and CA2 as they don't have defined criteria
    update_data = {
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id),
        'subject_id': ObjectId(subject_id),
        'exam_type': exam_type,
        'marks': marks,
        'max_marks': max_marks,
        'is_pass': marks >= passing,
        'remarks': data.get('remarks', ''),
        'is_locked': False,
        'entered_by': email,
        'entered_at': datetime.datetime.utcnow()
    }
    
    # Only set status for non-CA exams
    if exam_type not in CA_INTERNAL_EXAM_TYPES:
        update_data['status'] = data.get('status', 'PASSED')
    
    # Store granular components if provided (for Practical Lab subjects)
    if data.get('components'):
        update_data['components'] = data.get('components')
    
    mongo.db.internal_marks.update_one(
        {
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'subject_id': ObjectId(subject_id),
            'exam_type': exam_type
        },
        {'$set': update_data},
        upsert=True
    )
    log_audit('INTERNAL_MARKS_ENTRY', {'exam_id': exam_id, 'student_id': student_id, 'subject_id': subject_id, 'exam_type': exam_type})
    return jsonify({'message': 'Internal marks saved'}), 200


@internal_marks_bp.route('/exam/<exam_id>/subject/<subject_id>', methods=['GET'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def get_marks_by_subject(exam_id, subject_id):
    """Get internal marks for all students for a subject."""
    marks_list = list(mongo.db.internal_marks.find({
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


@internal_marks_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def get_all_internal_marks(exam_id):
    """Get all internal marks for an exam."""
    marks_list = list(mongo.db.internal_marks.find({'exam_id': ObjectId(exam_id)}))
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


@internal_marks_bp.route('/lock', methods=['POST'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def lock_marks():
    """Lock internal marks for an exam (prevents further editing)."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    exam_type = data.get('exam_type')

    query = {'exam_id': ObjectId(exam_id)}
    if subject_id:
        query['subject_id'] = ObjectId(subject_id)
    if exam_type:
        query['exam_type'] = exam_type

    result = mongo.db.internal_marks.update_many(
        query,
        {'$set': {'is_locked': True, 'locked_at': datetime.datetime.utcnow()}}
    )

    # Auto-calculate CA1/CA2 if PT1/PT2 is locked
    if exam_type in ['periodic_test_1', 'periodic_test_2']:
        target_ca = 'ca1' if exam_type == 'periodic_test_1' else 'ca2'
        pt_marks = list(mongo.db.internal_marks.find(query))
        
        for pt in pt_marks:
            marks = pt.get('marks', 0)
            ca_marks = math.ceil((marks * 5) / 20)
            
            mongo.db.internal_marks.update_one(
                {
                    'exam_id': pt['exam_id'],
                    'student_id': pt['student_id'],
                    'subject_id': pt['subject_id'],
                    'exam_type': target_ca
                },
                {
                    '$set': {
                        'exam_id': pt['exam_id'],
                        'student_id': pt['student_id'],
                        'subject_id': pt['subject_id'],
                        'exam_type': target_ca,
                        'marks': float(ca_marks),
                        'max_marks': 5.0,
                        'is_locked': True,
                        'locked_at': datetime.datetime.utcnow(),
                        'entered_by': pt.get('entered_by', 'system'),
                        'entered_at': datetime.datetime.utcnow(),
                        'is_pass': True
                    }
                },
                upsert=True
            )
        log_audit(f'INTERNAL_MARKS_{target_ca.upper()}_CALCULATED', {'exam_id': exam_id, 'subject_id': subject_id})

    log_audit('INTERNAL_MARKS_LOCK', {'exam_id': exam_id, 'count': result.modified_count})
    return jsonify({'message': f'{result.modified_count} mark records locked and CA marks generated'}), 200


@internal_marks_bp.route('/student/<exam_id>/<student_id>', methods=['GET'])
@jwt_required()
def get_student_internal_marks(exam_id, student_id):
    """Get internal marks for a specific student."""
    marks_list = list(mongo.db.internal_marks.find({
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id)
    }))
    result = []
    for m in marks_list:
        m['_id'] = str(m['_id'])
        m['exam_id'] = str(m['exam_id'])
        m['student_id'] = str(m['student_id'])
        m['subject_id'] = str(m['subject_id'])
        sub = mongo.db.subjects.find_one({'_id': ObjectId(m['subject_id'])})
        if sub:
            m['subject_name'] = sub.get('name', '')
        result.append(m)
    return jsonify(result), 200
@internal_marks_bp.route('/faculty/students-to-mark/<exam_id>/<subject_id>', methods=['GET'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def get_students_for_marks(exam_id, subject_id):
    """List all students eligible to receive marks for this subject in this exam."""
    # Find subject to get semester
    sub = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})
    if not sub:
        return jsonify({'message': 'Subject not found'}), 404
    
    semester = sub.get('semester')
    
    # Start with broad query - get all students, then filter
    students = list(mongo.db.students.find({}))
    
    # Filter by semester if available
    if semester:
        sem_values = [semester, str(semester)]
        try:
            sem_values.append(int(float(semester)))
        except: 
            pass
        students = [
            s for s in students 
            if s.get('current_semester') in sem_values or s.get('semester') in sem_values
        ]
    
    # Class division config - fy maps semester to year (sem 1-2 = FY, sem 3-4 = SY, etc.)
    CLASS_DIVISION = {
        'CSE': {'fy': 1, 'total': 208, 'sections': 3},
        'IT': {'fy': 2, 'total': 121, 'sections': 2},
        'AIML': {'fy': 3, 'total': 69, 'sections': 1},
        'A&R': {'fy': 4, 'total': 64, 'sections': 1},
        'CIVIL': {'fy': 5, 'total': 73, 'sections': 1},
        'MECH': {'fy': 6, 'total': 59, 'sections': 1},
        'E&TC': {'fy': 7, 'total': 69, 'sections': 1}
    }
    
    def normalize_text(value):
        if value is None or value == '':
            return ''
        raw = str(value).strip().lower()
        return ''.join(ch for ch in raw if ch.isalnum())

    def normalize_class_name(value):
        if not value:
            return ''
        parts = str(value).strip().upper().replace('(', ' ').replace(')', ' ').split()
        if len(parts) >= 3 and parts[0] == 'FY' and parts[1].isdigit():
            return f"FY {int(parts[1])} {parts[2]}"
        return str(value).strip()

    dept_cache = {}
    course_cache = {}

    def load_department_code(dept_id):
        if not dept_id:
            return ''
        key = str(dept_id)
        if key in dept_cache:
            return dept_cache[key]
        query = {'_id': _safe_object_id(dept_id)} if _safe_object_id(dept_id) else {'_id': dept_id}
        dept = mongo.db.departments.find_one(query)
        code = dept.get('code') if dept else ''
        dept_cache[key] = code
        return code or ''

    def load_course_details(course_id):
        if not course_id:
            return None
        key = str(course_id)
        if key in course_cache:
            return course_cache[key]
        query = {'_id': _safe_object_id(course_id)} if _safe_object_id(course_id) else {'_id': course_id}
        course = mongo.db.courses.find_one(query)
        course_cache[key] = course
        return course

    def get_dept_key_for_student(student):
        raw = [
            student.get('department'),
            student.get('department_name'),
            student.get('department_code'),
            student.get('dept'),
            student.get('dept_name'),
            student.get('dept_code')
        ]

        if not any(raw):
            dept_id = student.get('department_id') or student.get('dept_id')
            if dept_id:
                dept_code = load_department_code(dept_id)
                if dept_code:
                    raw.append(dept_code)

        if not any(raw):
            course_id = student.get('course_id')
            course = load_course_details(course_id)
            if course:
                raw.append(course.get('code'))
                other_dept_id = course.get('department_id')
                if other_dept_id:
                    dept_code = load_department_code(other_dept_id)
                    if dept_code:
                        raw.append(dept_code)

        raw = [r for r in raw if r]
        candidate = normalize_text(' '.join(raw))
        if not candidate:
            return ''

        def matches(keys):
            candidate_norm = candidate
            for key in keys:
                key_norm = normalize_text(key)
                if key_norm == candidate_norm or key_norm in candidate_norm or candidate_norm in key_norm:
                    return True
            return False

        if matches(['aiml', 'artificialintelligence', 'machinelearning', 'artificialintelligencemachinelearning']):
            return 'AIML'
        if matches(['etc', 'entc', 'electronic', 'telecommunication', 'electronicstelecommunication']):
            return 'E&TC'
        if matches(['automation', 'robotics', 'automationrobotics']):
            return 'A&R'
        if matches(['cse', 'computerscience', 'computerscienceengineering']):
            return 'CSE'
        if matches(['it', 'informationtechnology']):
            return 'IT'
        if matches(['civil', 'civilengineering']):
            return 'CIVIL'
        if matches(['mech', 'mechanical', 'mechanicalengineering']):
            return 'MECH'

        # Also check raw department field for patterns like "INFORMATION TECHNOLOGY (B.Tech)"
        dept_field = student.get('department') or ''
        dept_lower = dept_field.lower()
        if 'information technology' in dept_lower or 'it' in dept_lower:
            return 'IT'
        if 'computer science' in dept_lower or 'cse' in dept_lower:
            return 'CSE'
        if 'electronics' in dept_lower or 'entc' in dept_lower:
            return 'E&TC'
        if 'mechanical' in dept_lower:
            return 'MECH'
        if 'civil' in dept_lower:
            return 'CIVIL'
        if 'artificial intelligence' in dept_lower or 'aiml' in dept_lower:
            return 'AIML'
        if 'automation' in dept_lower or 'robotics' in dept_lower:
            return 'A&R'

        return ''

    def compute_section_sizes(dept_key):
        cfg = CLASS_DIVISION.get(dept_key)
        if not cfg:
            return []
        total, sections = cfg['total'], cfg['sections']
        if sections <= 1:
            return [total]
        if dept_key == 'CSE' and sections == 3:
            return [70, 70, total - 140]
        base = total // sections
        rem = total % sections
        return [base + (1 if i < rem else 0) for i in range(sections)]

    # Compute class index map
    groups = {}
    for s in students:
        dept_key = get_dept_key_for_student(s) or '__UNKNOWN__'
        if dept_key not in groups:
            groups[dept_key] = []
        groups[dept_key].append(s)
    
    class_index_map = {}
    for dept_key, list_s in groups.items():
        sorted_list = sorted(list_s, key=lambda s: (
            (s.get('roll_no') or s.get('enrollment_no') or s.get('student_id') or '').lower(),
            (s.get('student_name') or s.get('name') or '').lower()
        ))
        for idx, s in enumerate(sorted_list):
            class_index_map[str(s['_id'])] = idx
    
    def get_class_for_student(student):
        dept_key = get_dept_key_for_student(student)
        cfg = CLASS_DIVISION.get(dept_key)
        if not cfg:
            return ''
        
        sizes = compute_section_sizes(dept_key)
        index_within_dept = class_index_map.get(str(student['_id']))
        if index_within_dept is None:
            return ''
        
        idx = index_within_dept
        section_index = 0
        while section_index < len(sizes) and idx >= sizes[section_index]:
            idx -= sizes[section_index]
            section_index += 1
        letter = chr(ord('A') + min(section_index, 25))
        return f"FY {cfg['fy']} {letter}"
    
    # Filter by class if provided
    class_filter = normalize_class_name(request.args.get('class'))
    import sys
    debug_log = []
    if class_filter and class_filter.lower() != 'all':
        filtered = []
        for s in students:
            computed_class = get_class_for_student(s)
            debug_log.append(f"Student: {s.get('name','')} | Roll: {s.get('roll_no','')} | Dept: {s.get('department','')} | Computed: {computed_class} | Filter: {class_filter}")
            if computed_class == class_filter:
                filtered.append(s)
        students = filtered
        print("\n".join(debug_log), file=sys.stderr)
    
    exam_type = request.args.get('exam_type', 'periodic_test_1')
    settings = mongo.db.exam_settings.find_one({}) or {}
    configured_max = settings.get('max_internal_marks', DEFAULT_INTERNAL_MAX_MARKS)
    default_max = configured_max if exam_type in INTERNAL_EXAM_TYPES else DEFAULT_INTERNAL_MAX_MARKS

    # Get existing marks for selected internal exam type
    existing_marks = {str(m['student_id']): m for m in mongo.db.internal_marks.find({
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id),
        'exam_type': exam_type
    })}
    
    result = []
    for s in students:
        sid_str = str(s['_id'])
        m = existing_marks.get(sid_str, {})
        result.append({
            'student_id': sid_str,
            'student_name': s.get('name', ''),
            'enrollment_no': s.get('enrollment_no', ''),
            'roll_no': s.get('roll_no', ''),
            'department': s.get('department', ''),
            'marks': m.get('marks', ''),
            'max_marks': m.get('max_marks', default_max),
            'status': m.get('status', 'PASSED'),
            'remarks': m.get('remarks', ''),
            'is_locked': m.get('is_locked', False),
            'is_pass': m.get('is_pass', False),
            'is_submitted_by_faculty': m.get('is_submitted_by_faculty', False),
            'components': m.get('components', {})
        })
        
    return jsonify(result), 200
@internal_marks_bp.route('/my-results/<exam_id>', methods=['GET'])
@jwt_required()
def get_my_internal_marks(exam_id):
    """Student fetches their own internal marks for a given exam."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    
    student = mongo.db.students.find_one({"email": email})
    if not student:
        return jsonify({'message': 'Student profile not found'}), 404
    
    student_id = student['_id']
    semester = student.get("current_semester")
    
    # 1. Fetch all subjects for this student's semester
    sem_values = []
    if semester is not None and semester != "":
        try:
            sem_int = int(float(semester))
            sem_values = [sem_int, float(sem_int), str(sem_int)]
        except Exception:
            sem_values = [semester, str(semester)]

    sub_query = {"type": "Theory"}
    if sem_values:
        sub_query["$or"] = [
            {"semester": {"$in": sem_values}},
            {"semester": {"$in": [None, ""]}},
            {"semester": {"$exists": False}}
        ]
    
    all_subjects = list(mongo.db.subjects.find(sub_query))
    
    exam_type = request.args.get('exam_type')
    settings = mongo.db.exam_settings.find_one({}) or {}
    configured_max = settings.get('max_internal_marks', DEFAULT_INTERNAL_MAX_MARKS)
    default_max = configured_max if (exam_type in INTERNAL_EXAM_TYPES) else DEFAULT_INTERNAL_MAX_MARKS

    # 2. Fetch existing marks
    marks_query = _build_student_internal_marks_query(exam_id, student_id, exam_type)
    marks_list = list(mongo.db.internal_marks.find(marks_query))
    
    marks_map = {str(m['subject_id']): m for m in marks_list}
    
    result = []
    for sub in all_subjects:
        sub_id_str = str(sub['_id'])
        m = marks_map.get(sub_id_str)
        
        if m:
            entry = {
                '_id': str(m['_id']),
                'exam_id': str(m['exam_id']),
                'student_id': str(m['student_id']),
                'subject_id': sub_id_str,
                'subject_name': sub.get('name', ''),
                'subject_code': sub.get('code', ''),
                'credits': sub.get('credits', 0),
                'marks': m.get('marks', 0),
                'max_marks': m.get('max_marks', default_max),
                'is_pass': m.get('is_pass', False),
                'status': m.get('status', 'PASSED'),
                'remarks': m.get('remarks', '')
            }
        else:
            # Subject exists but no marks entered yet
            entry = {
                '_id': None,
                'exam_id': str(exam_id),
                'student_id': str(student_id),
                'subject_id': sub_id_str,
                'subject_name': sub.get('name', ''),
                'subject_code': sub.get('code', ''),
                'credits': sub.get('credits', 0),
                'marks': 0,
                'max_marks': default_max,  # Default max
                'is_pass': False,
                'status': 'PENDING',
                'remarks': 'Marks not inserted'
            }
        result.append(entry)
        
    return jsonify(result), 200

@internal_marks_bp.route('/lock-student', methods=['POST'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def lock_student_marks():
    """Lock marks for a specific student/subject/internal exam type."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    student_id = data.get('student_id')
    exam_type = data.get('exam_type', 'periodic_test_1')

    if not all([exam_id, subject_id, student_id]):
        return jsonify({'message': 'exam_id, subject_id, student_id are required'}), 400

    result = mongo.db.internal_marks.update_one(
        {
            'exam_id': ObjectId(exam_id),
            'subject_id': ObjectId(subject_id),
            'student_id': ObjectId(student_id),
            'exam_type': exam_type
        },
        {
            '$set': {
                'is_locked': True,
                'locked_at': datetime.datetime.utcnow()
            }
        }
    )

    if result.matched_count == 0:
        return jsonify({'message': 'No saved marks found to lock for this student'}), 404

    log_audit('INTERNAL_MARKS_LOCK_STUDENT', {
        'exam_id': exam_id,
        'subject_id': subject_id,
        'student_id': student_id,
        'exam_type': exam_type
    })
    return jsonify({'message': 'Marks locked successfully'}), 200

@internal_marks_bp.route('/import-excel', methods=['POST'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def import_internal_marks():
    """Import internal marks from an Excel file."""
    exam_id = request.form.get('exam_id')
    subject_id = request.form.get('subject_id')
    exam_type = request.form.get('exam_type', 'periodic_test_1')
    
    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400
        
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'No file uploaded'}), 400
        
    print(f"[DEBUG] Starting Excel import for Exam: {exam_id}, Subject: {subject_id}, Type: {exam_type}, File: {file.filename}")
    
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
            
            # Use fuzzy check (if one is contained in another or significant overlap)
            if target_name not in sheet_name and sheet_name not in target_name:
                # If target name has (Code), ignore the code part
                base_target = re.sub(r'\(.*?\)', '', target_name).strip()
                if base_target not in sheet_name and sheet_name not in base_target:
                    return jsonify({
                        'message': f"Subject mismatch! The Excel sheet is for '{metadata.get('subject')}', but you selected '{target_subject.get('name')}'"
                    }), 400

    # Validation: Check if Exam Type matches
    if metadata and metadata.get('exam_type'):
        sheet_exam_type = re.sub(r'[^a-z0-9]', '', str(metadata.get('exam_type', '')).lower())
        selected_exam_normalized = re.sub(r'[^a-z0-9]', '', str(exam_type).lower())
        
        if selected_exam_normalized not in sheet_exam_type and sheet_exam_type not in selected_exam_normalized:
            return jsonify({
                'message': f"Exam Type mismatch! The Excel sheet is for '{metadata.get('exam_type')}', but you selected '{exam_type.replace('_', ' ').title()}'"
            }), 400
        
    print(f"[DEBUG] Processed {len(data)} rows from Excel.")
    
    success_count = 0
    not_found = []
    
    settings = mongo.db.exam_settings.find_one({}) or {}
    passing_mark = settings.get('min_internal_marks', 8)

    for idx, row in enumerate(data):
        roll = row.get('roll_no')
        enroll = row.get('enrollment_no')
        student = find_student_for_marks_import(mongo.db, roll, enroll)

        if not student:
            print(f"[DEBUG] Row {idx+1}: Student not found (Roll: {roll}, Enroll: {enroll})")
            not_found.append(f"Row {idx+1}: {roll or enroll}")
            continue
            
        marks = row.get('marks', 0)
        # Don't auto-calculate status for CA1 and CA2 as they don't have defined criteria
        if exam_type in CA_INTERNAL_EXAM_TYPES:
            status = row.get('status')  # Only use explicit status if provided
        else:
            status = row.get('status') or ('PASSED' if marks >= passing_mark else 'FAILED')
        remarks = row.get('remarks', '')
        
        print(f"[DEBUG] Row {idx+1}: Updating marks for {student.get('name')} -> {marks}")
        
        mongo.db.internal_marks.update_one(
            {
                'exam_id': ObjectId(exam_id),
                'student_id': student['_id'],
                'subject_id': ObjectId(subject_id),
                'exam_type': exam_type
            },
            {
                '$set': {
                    'exam_id': ObjectId(exam_id),
                    'student_id': student['_id'],
                    'subject_id': ObjectId(subject_id),
                    'exam_type': exam_type,
                    'marks': float(marks),
                    'max_marks': float(row.get('max_marks', 20)),
                    'status': status,
                    'remarks': remarks,
                    'is_pass': float(marks) >= passing_mark,
                    'is_locked': False,
                    'updated_at': datetime.datetime.utcnow()
                },
                '$setOnInsert': {
                    'entered_at': datetime.datetime.utcnow()
                }
            },
            upsert=True
        )
        success_count += 1
        
    log_audit('INTERNAL_MARKS_IMPORT', {
        'exam_id': exam_id, 
        'subject_id': subject_id, 
        'count': success_count,
        'errors': len(not_found)
    })
    
    return jsonify({
        'message': f"Marks for '{target_subject.get('name') if target_subject else 'Subject'}' ({exam_type.replace('_', ' ').title()}) imported successfully for {success_count} students.",
        'failed_count': len(not_found),
        'failed_identifiers': not_found[:10]
    }), 200

@internal_marks_bp.route('/subject-overview/<exam_id>/<subject_id>', methods=['GET'])
@role_required(['Faculty', 'Admin', 'Exam Cell'])
def get_subject_marks_overview(exam_id, subject_id):
    """Aggregate all internal marks for all students in a subject."""
    # 1. Fetch all internal marks for this exam and subject
    internal_marks_list = list(mongo.db.internal_marks.find({
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id)
    }))
    
    # 2. Fetch all external marks for this exam and subject
    external_marks_list = list(mongo.db.external_marks.find({
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id)
    }))
    
    # 3. Get the list of students for this subject
    sub = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})
    if not sub:
        return jsonify({'message': 'Subject not found'}), 404
    
    semester = sub.get('semester')
    sem_values = [semester, str(semester)]
    try:
        sem_values.append(int(float(semester)))
    except: pass

    # 3. Find students who have an approved exam application for this session.
    # Also include any student who already has marks entered for this subject/exam,
    # so faculty overview never "drops" students after import/forward workflows.
    approved_apps = list(mongo.db.exam_applications.find({
        'exam_id': ObjectId(exam_id),
        'status': 'Approved',
        '$or': [
            {'subjects': ObjectId(subject_id)},
            {'subjects': str(subject_id)},
            {'subjects': {'$exists': False}},
            {'subjects': []}
        ]
    }))
    approved_student_ids = []
    for a in approved_apps:
        sid = a.get('student_id') or a.get('studentId')
        if not sid:
            continue
        try:
            approved_student_ids.append(ObjectId(sid) if not isinstance(sid, ObjectId) else sid)
        except Exception:
            continue

    marks_student_ids = set()
    for m in internal_marks_list:
        sid = m.get('student_id')
        if isinstance(sid, ObjectId):
            marks_student_ids.add(sid)
        else:
            try:
                marks_student_ids.add(ObjectId(sid))
            except Exception:
                pass
    for m in external_marks_list:
        sid = m.get('student_id')
        if isinstance(sid, ObjectId):
            marks_student_ids.add(sid)
        else:
            try:
                marks_student_ids.add(ObjectId(sid))
            except Exception:
                pass

    merged_ids = list(dict.fromkeys(approved_student_ids + list(marks_student_ids)))

    if merged_ids:
        students_query = {'_id': {'$in': merged_ids}}
    else:
        # Fallback: semester-based pool if neither applications nor marks are available.
        if not sem_values:
            return jsonify([])
        students_query = {'$or': [{'current_semester': {'$in': sem_values}}, {'semester': {'$in': sem_values}}]}

    students = list(mongo.db.students.find(students_query))
    
    # 4. Aggregate internal marks by student
    internal_marks_map = {}
    for m in internal_marks_list:
        exam_type = m.get('exam_type')
        if not exam_type:
            # Skip malformed or legacy records without an exam_type field.
            continue
        sid = str(m['student_id'])
        if sid not in internal_marks_map:
            internal_marks_map[sid] = {}
        internal_marks_map[sid][exam_type] = {
            'marks': m.get('marks'),
            'components': m.get('components', {}),
            'is_locked': m.get('is_locked', False),
            'is_submitted': m.get('is_submitted_by_faculty', False)
        }
        
    # 5. Aggregate external marks by student
    external_marks_map = {}
    for m in external_marks_list:
        sid = str(m['student_id'])
        external_marks_map[sid] = {
            'marks': m.get('marks'),
            'is_locked': m.get('is_locked', False),
            'is_submitted': m.get('is_submitted_by_faculty', False)
        }
        
    result = []
    for s in students:
        sid_str = str(s['_id'])
        s_internal = internal_marks_map.get(sid_str, {})
        s_external = external_marks_map.get(sid_str, {})
        
        result.append({
            'student_id': sid_str,
            'student_name': s.get('name', ''),
            'enrollment_no': s.get('enrollment_no', ''),
            'roll_no': s.get('roll_no', ''),
            'department': s.get('department', ''),
            'current_semester': s.get('current_semester', ''),
            'marks': {
                'periodic_test_1': s_internal.get('periodic_test_1', {}).get('marks', ''),
                'periodic_test_2': s_internal.get('periodic_test_2', {}).get('marks', ''),
                'ca1': s_internal.get('ca1', {}).get('marks', ''),
                'ca2': s_internal.get('ca2', {}).get('marks', ''),
                'mid_semester_exam': s_internal.get('mid_semester_exam', {}).get('marks', ''),
                'practical_internal': s_internal.get('practical_internal', {}).get('marks', ''),
                'practical_components': s_internal.get('practical_internal', {}).get('components', {}),
                'external_exam': s_external.get('marks', '')
            },
            'locks': {
                'periodic_test_1': s_internal.get('periodic_test_1', {}).get('is_locked', False),
                'periodic_test_2': s_internal.get('periodic_test_2', {}).get('is_locked', False),
                'ca1': s_internal.get('ca1', {}).get('is_locked', False),
                'ca2': s_internal.get('ca2', {}).get('is_locked', False),
                'mid_semester_exam': s_internal.get('mid_semester_exam', {}).get('is_locked', False),
                'external_exam': s_external.get('is_locked', False)
            },
            'is_submitted': {
                'internal': all([
                    s_internal.get(t, {}).get('is_submitted', False) 
                    for t in ['periodic_test_1', 'periodic_test_2', 'mid_semester_exam', 'practical_internal']
                    if s_internal.get(t) # Only check if data exists
                ]) if s_internal else False,
                'external': s_external.get('is_submitted', False)
            }
        })
        
    return jsonify(result), 200
