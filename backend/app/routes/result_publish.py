"""
Module 14: Result Publishing
Publish or unpublish results for an exam. Students can only see published results.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

result_publish_bp = Blueprint('result_publish', __name__)


@result_publish_bp.route('/status/<exam_id>', methods=['GET'])
@jwt_required()
def get_publish_status(exam_id):
    """Get the publish status of an exam's results."""
    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404

    published = exam.get('results_published', False)
    published_at = exam.get('results_published_at')
    return jsonify({
        'exam_id': exam_id,
        'exam_name': exam.get('name', ''),
        'results_published': published,
        'published_at': str(published_at) if published_at else None
    }), 200


@result_publish_bp.route('/publish/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def publish_results(exam_id):
    """Publish results for an exam (make visible to students)."""
    # Check if results are compiled
    result_count = mongo.db.results.count_documents({'exam_id': ObjectId(exam_id)})
    if result_count == 0:
        return jsonify({'message': 'No results compiled yet. Please compile results first.'}), 400

    now = datetime.datetime.utcnow()

    # Update exam document
    mongo.db.exams.update_one(
        {'_id': ObjectId(exam_id)},
        {'$set': {
            'results_published': True,
            'results_published_at': now,
            'status': 'Results Declared'
        }}
    )

    # Mark all results as published
    mongo.db.results.update_many(
        {'exam_id': ObjectId(exam_id)},
        {'$set': {'is_published': True, 'published_at': now}}
    )

    log_audit('RESULTS_PUBLISHED', {'exam_id': exam_id, 'count': result_count})
    return jsonify({'message': f'Results published for {result_count} students'}), 200


@result_publish_bp.route('/unpublish/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def unpublish_results(exam_id):
    """Unpublish results (hide from students)."""
    mongo.db.exams.update_one(
        {'_id': ObjectId(exam_id)},
        {'$set': {'results_published': False, 'status': 'Completed'}}
    )
    mongo.db.results.update_many(
        {'exam_id': ObjectId(exam_id)},
        {'$set': {'is_published': False}}
    )
    log_audit('RESULTS_UNPUBLISHED', {'exam_id': exam_id})
    return jsonify({'message': 'Results unpublished'}), 200


@result_publish_bp.route('/all', methods=['GET'])
@role_required(['Exam Cell'])
def list_publish_statuses():
    """List all exams with their publish status."""
    exams = list(mongo.db.exams.find({}).sort('created_at', -1))
    result = []
    for e in exams:
        result.append({
            'exam_id': str(e['_id']),
            'exam_name': e.get('name', ''),
            'exam_type': e.get('exam_type', ''),
            'semester': e.get('semester'),
            'status': e.get('status', ''),
            'results_published': e.get('results_published', False),
            'published_at': str(e.get('results_published_at', '')) or None
        })
    return jsonify(result), 200


@result_publish_bp.route('/exam/<exam_id>/overview', methods=['GET'])
@role_required(['Exam Cell'])
def get_exam_results_overview(exam_id):
    """Get a matrix of all students and their subject-wise marks for review."""
    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404
        
    results = list(mongo.db.results.find({'exam_id': ObjectId(exam_id)}))
    if not results:
        return jsonify({'message': 'No results compiled yet.'}), 400
        
    subject_ids = set()
    for r in results:
        for sr in r.get('subject_results', []):
            subject_ids.add(sr['subject_id'])
            
    subjects = []
    for sid in subject_ids:
        sub = mongo.db.subjects.find_one({'_id': ObjectId(sid)})
        subjects.append({
            'id': sid,
            'name': sub.get('name', 'Unknown') if sub else 'Unknown',
            'code': sub.get('subject_code', '') if sub else ''
        })
        
    student_data = []
    for r in results:
        student = mongo.db.students.find_one({'_id': r['student_id']})
        s_info = {
            'student_name': student.get('name', '') if student else 'Unknown',
            'enrollment_no': student.get('enrollment_no', '') if student else '',
            'sgpa': r.get('sgpa', 0),
            'cgpa': r.get('cgpa', 0),
            'percentage': r.get('percentage', 0),
            'status': r.get('status', ''),
            'marks': {}
        }
        
        for sr in r.get('subject_results', []):
            s_info['marks'][sr['subject_id']] = {
                'internal': sr.get('internal_marks', 0),
                'external': sr.get('external_marks', 0),
                'total': sr.get('total_marks', 0),
                'grade': sr.get('grade', 'FF')
            }
        student_data.append(s_info)
        
    return jsonify({
        'exam_name': exam.get('name', ''),
        'subjects': sorted(subjects, key=lambda x: x['code']),
        'students': sorted(student_data, key=lambda x: x['enrollment_no'])
    }), 200
