"""
Module 3: Eligibility Verification
Check fees and internal marks.
Mark students eligible or not eligible per exam.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

eligibility_bp = Blueprint('eligibility', __name__)

MIN_INTERNAL_MARKS = 12  # out of 30


@eligibility_bp.route('/check/<exam_id>/<student_id>', methods=['GET'])
@role_required(['Exam Cell'])
def check_eligibility(exam_id, student_id):
    """Check and return eligibility status for a student in an exam."""
    student = mongo.db.students.find_one({'_id': ObjectId(student_id)})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    settings = mongo.db.exam_settings.find_one({}) or {}
    min_internal = settings.get('min_internal_marks', MIN_INTERNAL_MARKS)
    fees_paid = student.get('fees_paid', False)

    # Get internal marks for this exam
    internal_marks_list = list(mongo.db.internal_marks.find({
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id)
    }))
    failed_internal = [m for m in internal_marks_list if m.get('marks', 0) < min_internal]

    reasons = []
    eligible = True
    if not fees_paid:
        eligible = False
        reasons.append('Fees not paid')
    if failed_internal:
        eligible = False
        for m in failed_internal:
            sub = mongo.db.subjects.find_one({'_id': m.get('subject_id')})
            sub_name = sub.get('name', str(m.get('subject_id'))) if sub else str(m.get('subject_id'))
            reasons.append(f'Internal marks insufficient for {sub_name}')

    return jsonify({
        'student_id': student_id,
        'student_name': student.get('name', ''),
        'enrollment_no': student.get('enrollment_no', ''),
        'fees_paid': fees_paid,
        'eligible': eligible,
        'reasons': reasons
    }), 200


@eligibility_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def list_eligibility(exam_id):
    """List eligibility status for all students who applied for an exam."""
    applications = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id)}))
    result = []
    for app in applications:
        student = mongo.db.students.find_one({'_id': app['student_id']})
        if not student:
            continue
        fees_paid = student.get('fees_paid', False)

        # Check saved eligibility override
        saved = mongo.db.eligibility.find_one({
            'exam_id': ObjectId(exam_id),
            'student_id': app['student_id']
        })

        result.append({
            'application_id': str(app['_id']),
            'student_id': str(app['student_id']),
            'student_name': student.get('name', ''),
            'enrollment_no': student.get('enrollment_no', ''),
            'fees_paid': fees_paid,
            'eligible': saved.get('eligible') if saved else fees_paid,
            'override': saved.get('override', False) if saved else False,
            'remarks': saved.get('remarks', '') if saved else ''
        })
    return jsonify(result), 200


@eligibility_bp.route('/set', methods=['POST'])
@role_required(['Exam Cell'])
def set_eligibility():
    """Manually override eligibility for a student."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    student_id = data.get('student_id')
    eligible = data.get('eligible')
    remarks = data.get('remarks', '')

    if eligible is None:
        return jsonify({'message': 'eligible field is required (true/false)'}), 400

    mongo.db.eligibility.update_one(
        {'exam_id': ObjectId(exam_id), 'student_id': ObjectId(student_id)},
        {'$set': {
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'eligible': eligible,
            'override': True,
            'remarks': remarks,
            'updated_at': datetime.datetime.utcnow()
        }},
        upsert=True
    )
    log_audit('ELIGIBILITY_SET', {'exam_id': exam_id, 'student_id': student_id, 'eligible': eligible})
    return jsonify({'message': 'Eligibility updated'}), 200


@eligibility_bp.route('/bulk-check/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def bulk_check_and_save(exam_id):
    """Run eligibility check for all applicants of an exam and save results."""
    applications = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id)}))
    updated = 0
    for app in applications:
        student = mongo.db.students.find_one({'_id': app['student_id']})
        if not student:
            continue
        fees_paid = student.get('fees_paid', False)
        eligible = fees_paid
        mongo.db.eligibility.update_one(
            {'exam_id': ObjectId(exam_id), 'student_id': app['student_id']},
            {'$set': {
                'exam_id': ObjectId(exam_id),
                'student_id': app['student_id'],
                'eligible': eligible,
                'override': False,
                'updated_at': datetime.datetime.utcnow()
            }},
            upsert=True
        )
        updated += 1
    log_audit('ELIGIBILITY_BULK_CHECK', {'exam_id': exam_id, 'count': updated})
    return jsonify({'message': f'Eligibility checked for {updated} students'}), 200
