"""
Module 1: Exam Setup
Create and manage exam sessions (End Sem, Internal, Supplementary).
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

exam_setup_bp = Blueprint('exam_setup', __name__)

EXAM_TYPES = ['End Semester', 'Supplementary', 'Backlogs']
EXAM_STATUSES = ['Draft', 'Upcoming', 'Ongoing', 'Completed', 'Results Declared']


def _serialize(doc):
    doc['_id'] = str(doc['_id'])
    if 'department_id' in doc and doc['department_id'] != 'ALL':
        doc['department_id'] = str(doc['department_id'])
    return doc


@exam_setup_bp.route('/', methods=['GET'])
@jwt_required()
def list_exams():
    """List all exam sessions, optionally filter by type/status."""
    exam_type = request.args.get('type')
    status = request.args.get('status')
    query = {}
    if exam_type:
        query['exam_type'] = exam_type
    if status:
        query['status'] = status
    exams = [_serialize(e) for e in mongo.db.exams.find(query).sort('created_at', -1)]
    return jsonify(exams), 200


@exam_setup_bp.route('/', methods=['POST'])
@role_required(['Admin', 'Exam Cell'])
def create_exam():
    """Create a new exam session."""
    data = request.get_json()
    name = data.get('name', '').strip()
    exam_type = data.get('exam_type', 'End Semester')
    semester = int(data.get('semester', 1))
    department_id = data.get('department_id', 'ALL')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not name:
        return jsonify({'message': 'Exam name is required'}), 400
    if exam_type not in EXAM_TYPES:
        return jsonify({'message': f'exam_type must be one of {EXAM_TYPES}'}), 400
    if semester not in range(1, 9):
        return jsonify({'message': 'Semester must be between 1 and 8'}), 400

    dept_val = 'ALL' if department_id == 'ALL' else ObjectId(department_id)
    now = datetime.datetime.utcnow()

    exam_doc = {
        'name': name,
        'exam_type': exam_type,
        'semester': semester,
        'department_id': dept_val,
        'start_date': start_date,
        'end_date': end_date,
        'status': 'Draft',
        'timetable': [],
        'created_at': now,
        'updated_at': now
    }
    result = mongo.db.exams.insert_one(exam_doc)
    log_audit('EXAM_SETUP_CREATE', {'name': name, 'exam_type': exam_type})
    return jsonify({'message': 'Exam session created', 'id': str(result.inserted_id)}), 201


@exam_setup_bp.route('/<exam_id>', methods=['GET'])
@jwt_required()
def get_exam(exam_id):
    """Get a single exam session."""
    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404
    return jsonify(_serialize(exam)), 200


@exam_setup_bp.route('/<exam_id>', methods=['PUT'])
@role_required(['Admin', 'Exam Cell'])
def update_exam(exam_id):
    """Update exam session details."""
    data = request.get_json()
    allowed = ['name', 'exam_type', 'semester', 'start_date', 'end_date', 'status', 'department_id']
    updates = {k: v for k, v in data.items() if k in allowed}

    if 'department_id' in updates and updates['department_id'] != 'ALL':
        updates['department_id'] = ObjectId(updates['department_id'])
    if 'status' in updates and updates['status'] not in EXAM_STATUSES:
        return jsonify({'message': f'Invalid status. Allowed: {EXAM_STATUSES}'}), 400

    updates['updated_at'] = datetime.datetime.utcnow()
    mongo.db.exams.update_one({'_id': ObjectId(exam_id)}, {'$set': updates})
    log_audit('EXAM_SETUP_UPDATE', {'exam_id': exam_id, 'updates': list(updates.keys())})
    return jsonify({'message': 'Exam updated'}), 200


@exam_setup_bp.route('/<exam_id>', methods=['DELETE'])
@role_required(['Admin', 'Exam Cell'])
def delete_exam(exam_id):
    """Delete an exam session (only if Draft)."""
    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404
    if exam.get('status') != 'Draft':
        return jsonify({'message': 'Only Draft exams can be deleted'}), 400
    mongo.db.exams.delete_one({'_id': ObjectId(exam_id)})
    log_audit('EXAM_SETUP_DELETE', {'exam_id': exam_id})
    return jsonify({'message': 'Exam deleted'}), 200


@exam_setup_bp.route('/<exam_id>/status', methods=['PATCH'])
@role_required(['Admin', 'Exam Cell'])
def update_status(exam_id):
    """Update exam status."""
    data = request.get_json()
    new_status = data.get('status')
    if new_status not in EXAM_STATUSES:
        return jsonify({'message': f'Invalid status. Allowed: {EXAM_STATUSES}'}), 400
    mongo.db.exams.update_one(
        {'_id': ObjectId(exam_id)},
        {'$set': {'status': new_status, 'updated_at': datetime.datetime.utcnow()}}
    )
    log_audit('EXAM_STATUS_CHANGE', {'exam_id': exam_id, 'status': new_status})
    return jsonify({'message': f'Status updated to {new_status}'}), 200
