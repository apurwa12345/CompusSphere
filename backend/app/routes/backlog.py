"""
Module 11: Backlog / ATKT Tracking
Track failed subjects per student. Mark as cleared upon supplementary exam pass.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

backlog_bp = Blueprint('backlog', __name__)


@backlog_bp.route('/student/<student_id>', methods=['GET'])
@jwt_required()
def get_student_backlogs(student_id):
    """Get all backlogs for a student."""
    backlogs = list(mongo.db.backlogs.find({'student_id': ObjectId(student_id)}))
    result = []
    for b in backlogs:
        b['_id'] = str(b['_id'])
        b['student_id'] = str(b['student_id'])
        b['exam_id'] = str(b['exam_id'])
        b['subject_id'] = str(b['subject_id'])
        sub = mongo.db.subjects.find_one({'_id': ObjectId(b['subject_id'])})
        if sub:
            b['subject_name'] = sub.get('name', b.get('subject_name', ''))
            b['subject_code'] = sub.get('code', '')
        exam = mongo.db.exams.find_one({'_id': ObjectId(b['exam_id'])})
        if exam:
            b['exam_name'] = exam.get('name', '')
        result.append(b)
    return jsonify({'backlogs': result, 'total': len(result)}), 200


@backlog_bp.route('/my', methods=['GET'])
@role_required(['Student'])
def my_backlogs():
    """Student views their own backlogs."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    return get_student_backlogs(str(student['_id']))


@backlog_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def get_exam_backlogs(exam_id):
    """List all backlogs for an exam (students who failed)."""
    backlogs = list(mongo.db.backlogs.find({'exam_id': ObjectId(exam_id)}))
    result = []
    for b in backlogs:
        b['_id'] = str(b['_id'])
        b['student_id'] = str(b['student_id'])
        b['exam_id'] = str(b['exam_id'])
        b['subject_id'] = str(b['subject_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(b['student_id'])})
        if student:
            b['student_name'] = student.get('name', '')
            b['enrollment_no'] = student.get('enrollment_no', '')
        result.append(b)
    return jsonify(result), 200


@backlog_bp.route('/clear', methods=['POST'])
@role_required(['Exam Cell'])
def clear_backlog():
    """Mark a backlog as cleared (after supplementary/ATKT pass)."""
    data = request.get_json()
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')
    exam_id = data.get('original_exam_id')

    mongo.db.backlogs.update_one(
        {
            'student_id': ObjectId(student_id),
            'subject_id': ObjectId(subject_id),
            'exam_id': ObjectId(exam_id)
        },
        {'$set': {'status': 'Cleared', 'cleared_at': datetime.datetime.utcnow()}}
    )
    log_audit('BACKLOG_CLEARED', {'student_id': student_id, 'subject_id': subject_id})
    return jsonify({'message': 'Backlog marked as cleared'}), 200


@backlog_bp.route('/summary', methods=['GET'])
@role_required(['Exam Cell'])
def backlog_summary():
    """Summary of backlogs across all exams."""
    pipeline = [
        {'$group': {
            '_id': '$status',
            'count': {'$sum': 1}
        }}
    ]
    counts = list(mongo.db.backlogs.aggregate(pipeline))
    total = mongo.db.backlogs.count_documents({})
    students_with_backlogs = len(mongo.db.backlogs.distinct('student_id', {'status': 'Pending'}))
    return jsonify({
        'total_backlogs': total,
        'students_with_pending_backlogs': students_with_backlogs,
        'by_status': {c['_id']: c['count'] for c in counts}
    }), 200
