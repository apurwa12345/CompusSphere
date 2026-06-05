"""
Module 12: Revaluation
Students apply for revaluation. Admin updates marks after recheck.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import calculate_grade

revaluation_bp = Blueprint('revaluation', __name__)


@revaluation_bp.route('/apply', methods=['POST'])
@role_required(['Student'])
def apply_revaluation():
    """Student applies for revaluation of a subject."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    reason = data.get('reason', '')

    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400

    # Verify result exists and exam is published
    result = mongo.db.results.find_one({'exam_id': ObjectId(exam_id), 'student_id': student['_id']})
    if not result:
        return jsonify({'message': 'No result found. Cannot apply for revaluation.'}), 404
    if not result.get('is_published'):
        return jsonify({'message': 'Results not yet published'}), 400

    # Duplicate check
    existing = mongo.db.revaluations.find_one({
        'exam_id': ObjectId(exam_id),
        'student_id': student['_id'],
        'subject_id': ObjectId(subject_id)
    })
    if existing:
        return jsonify({'message': 'Revaluation already applied for this subject'}), 409

    rev = {
        'exam_id': ObjectId(exam_id),
        'student_id': student['_id'],
        'subject_id': ObjectId(subject_id),
        'reason': reason,
        'status': 'Pending',  # Pending | Under Review | Completed
        'original_marks': None,
        'revised_marks': None,
        'applied_at': datetime.datetime.utcnow()
    }

    # Fetch original marks
    ext_marks = mongo.db.external_marks.find_one({
        'exam_id': ObjectId(exam_id),
        'student_id': student['_id'],
        'subject_id': ObjectId(subject_id)
    })
    if ext_marks:
        rev['original_marks'] = ext_marks.get('marks')

    result_id = mongo.db.revaluations.insert_one(rev)
    log_audit('REVALUATION_APPLY', {'exam_id': exam_id, 'student_id': str(student['_id']), 'subject_id': subject_id})
    return jsonify({'message': 'Revaluation application submitted', 'id': str(result_id.inserted_id)}), 201


@revaluation_bp.route('/all', methods=['GET'])
@role_required(['Exam Cell'])
def list_revaluations():
    """List all revaluation requests."""
    status_filter = request.args.get('status')
    query = {}
    if status_filter:
        query['status'] = status_filter

    revs = list(mongo.db.revaluations.find(query).sort('applied_at', -1))
    result = []
    for r in revs:
        r['_id'] = str(r['_id'])
        r['exam_id'] = str(r['exam_id'])
        r['student_id'] = str(r['student_id'])
        r['subject_id'] = str(r['subject_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(r['student_id'])})
        if student:
            r['student_name'] = student.get('name', '')
            r['enrollment_no'] = student.get('enrollment_no', '')
        sub = mongo.db.subjects.find_one({'_id': ObjectId(r['subject_id'])})
        if sub:
            r['subject_name'] = sub.get('name', '')
        result.append(r)
    return jsonify(result), 200


@revaluation_bp.route('/my', methods=['GET'])
@role_required(['Student'])
def my_revaluations():
    """Student views their own revaluation applications."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    revs = list(mongo.db.revaluations.find({'student_id': student['_id']}))
    result = []
    for r in revs:
        r['_id'] = str(r['_id'])
        r['exam_id'] = str(r['exam_id'])
        r['student_id'] = str(r['student_id'])
        r['subject_id'] = str(r['subject_id'])
        sub = mongo.db.subjects.find_one({'_id': ObjectId(r['subject_id'])})
        if sub:
            r['subject_name'] = sub.get('name', '')
        result.append(r)
    return jsonify(result), 200


@revaluation_bp.route('/<rev_id>/update-marks', methods=['PATCH'])
@role_required(['Exam Cell'])
def update_revaluation_marks(rev_id):
    """Admin updates marks after revaluation and reflects in results."""
    data = request.get_json()
    revised_marks = float(data.get('revised_marks'))
    remarks = data.get('remarks', '')

    rev = mongo.db.revaluations.find_one({'_id': ObjectId(rev_id)})
    if not rev:
        return jsonify({'message': 'Revaluation not found'}), 404

    # Update external marks
    max_marks = 60
    ext = mongo.db.external_marks.find_one({
        'exam_id': rev['exam_id'],
        'student_id': rev['student_id'],
        'subject_id': rev['subject_id']
    })
    if ext:
        max_marks = ext.get('max_marks', 60)

    grade, grade_point = calculate_grade(revised_marks, max_marks)
    mongo.db.external_marks.update_one(
        {'exam_id': rev['exam_id'], 'student_id': rev['student_id'], 'subject_id': rev['subject_id']},
        {'$set': {'marks': revised_marks, 'grade': grade, 'grade_point': grade_point, 'is_revised': True}}
    )

    # Update revaluation record
    mongo.db.revaluations.update_one(
        {'_id': ObjectId(rev_id)},
        {'$set': {
            'revised_marks': revised_marks,
            'status': 'Completed',
            'remarks': remarks,
            'completed_at': datetime.datetime.utcnow()
        }}
    )
    log_audit('REVALUATION_UPDATED', {'rev_id': rev_id, 'revised_marks': revised_marks})
    return jsonify({'message': 'Revaluation marks updated. Please recompile results.'}), 200
