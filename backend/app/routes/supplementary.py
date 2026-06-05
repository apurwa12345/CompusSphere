"""
Module 13: Supplementary / ATKT Exam Management
Manage re-exam process for backlog students.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

supplementary_bp = Blueprint('supplementary', __name__)


@supplementary_bp.route('/', methods=['POST'])
@role_required(['Exam Cell'])
def create_supplementary_exam():
    """Create a supplementary/ATKT exam session."""
    data = request.get_json()
    name = data.get('name', '').strip()
    parent_exam_id = data.get('parent_exam_id')  # Original exam this is supplementary for
    semester = int(data.get('semester', 1))
    department_id = data.get('department_id', 'ALL')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not name:
        return jsonify({'message': 'Name is required'}), 400

    dept_val = 'ALL' if department_id == 'ALL' else ObjectId(department_id)
    now = datetime.datetime.utcnow()

    supp_doc = {
        'name': name,
        'exam_type': 'Supplementary',
        'semester': semester,
        'department_id': dept_val,
        'parent_exam_id': ObjectId(parent_exam_id) if parent_exam_id else None,
        'start_date': start_date,
        'end_date': end_date,
        'status': 'Upcoming',
        'timetable': [],
        'created_at': now,
        'updated_at': now
    }
    result = mongo.db.exams.insert_one(supp_doc)
    log_audit('SUPPLEMENTARY_EXAM_CREATE', {'name': name, 'semester': semester})
    return jsonify({'message': 'Supplementary exam created', 'id': str(result.inserted_id)}), 201


@supplementary_bp.route('/', methods=['GET'])
@jwt_required()
def list_supplementary_exams():
    """List all supplementary exam sessions."""
    exams = list(mongo.db.exams.find({'exam_type': 'Supplementary'}).sort('created_at', -1))
    result = []
    for e in exams:
        e['_id'] = str(e['_id'])
        if e.get('department_id') != 'ALL':
            e['department_id'] = str(e.get('department_id', ''))
        if e.get('parent_exam_id'):
            e['parent_exam_id'] = str(e['parent_exam_id'])
        result.append(e)
    return jsonify(result), 200


@supplementary_bp.route('/eligible-students/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def eligible_for_supplementary(exam_id):
    """
    List students eligible to appear in supplementary exams.
    These are students who have pending backlogs from the parent exam.
    """
    backlogs = list(mongo.db.backlogs.find({'exam_id': ObjectId(exam_id), 'status': 'Pending'}))
    student_map = {}
    for b in backlogs:
        sid = str(b['student_id'])
        if sid not in student_map:
            student = mongo.db.students.find_one({'_id': b['student_id']})
            student_map[sid] = {
                'student_id': sid,
                'student_name': student.get('name', '') if student else '',
                'enrollment_no': student.get('enrollment_no', '') if student else '',
                'backlog_subjects': []
            }
        student_map[sid]['backlog_subjects'].append({
            'subject_id': str(b['subject_id']),
            'subject_name': b.get('subject_name', ''),
            'grade': b.get('grade', '')
        })
    return jsonify(list(student_map.values())), 200


@supplementary_bp.route('/apply', methods=['POST'])
@role_required(['Student'])
def apply_supplementary():
    """Student applies to appear in supplementary exam for pending backlogs."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    data = request.get_json()
    supp_exam_id = data.get('exam_id')
    subjects = data.get('subjects', [])
    fee_acknowledged = data.get('fee_acknowledged', False)

    if not subjects:
        return jsonify({'message': 'At least one subject required'}), 400
    if not fee_acknowledged:
        return jsonify({'message': 'Fee must be acknowledged'}), 400

    existing = mongo.db.exam_applications.find_one({
        'exam_id': ObjectId(supp_exam_id),
        'student_id': student['_id']
    })
    if existing:
        return jsonify({'message': 'Already applied'}), 409

    application = {
        'exam_id': ObjectId(supp_exam_id),
        'student_id': student['_id'],
        'subjects': [ObjectId(s) for s in subjects],
        'fee_acknowledged': fee_acknowledged,
        'fees_paid': False,
        'applied_on': datetime.datetime.utcnow(),
        'status': 'Pending'
    }
    result = mongo.db.exam_applications.insert_one(application)
    log_audit('SUPPLEMENTARY_APPLY', {'exam_id': supp_exam_id, 'student_id': str(student['_id'])})
    return jsonify({'message': 'Supplementary application submitted', 'id': str(result.inserted_id)}), 201
