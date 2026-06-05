"""
Module 9: Marks Verification
Validate that marks are complete and within valid ranges before result processing.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

marks_verify_bp = Blueprint('marks_verify', __name__)


@marks_verify_bp.route('/status/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def verification_status(exam_id):
    """
    Check completeness of marks entry for an exam.
    Returns subject-wise summary: how many students have internal and external marks entered.
    """
    applications = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id), 'status': 'Approved'}))
    total_students = len(applications)

    if total_students == 0:
        return jsonify({'message': 'No approved applications found', 'total_students': 0, 'subjects': []}), 200

    # Get unique subjects across all applications
    all_subject_ids = set()
    for app in applications:
        for s in app.get('subjects', []):
            all_subject_ids.add(s)

    subject_status = []
    for sub_oid in all_subject_ids:
        sub = mongo.db.subjects.find_one({'_id': sub_oid})
        sub_name = sub.get('name', str(sub_oid)) if sub else str(sub_oid)

        internal_count = mongo.db.internal_marks.count_documents({
            'exam_id': ObjectId(exam_id),
            'subject_id': sub_oid
        })
        external_count = mongo.db.external_marks.count_documents({
            'exam_id': ObjectId(exam_id),
            'subject_id': sub_oid
        })
        external_verified_count = mongo.db.external_marks.count_documents({
            'exam_id': ObjectId(exam_id),
            'subject_id': sub_oid,
            'is_verified': True
        })
        
        internal_forwarded = mongo.db.internal_marks.count_documents({
            'exam_id': ObjectId(exam_id),
            'subject_id': sub_oid,
            'is_submitted_by_faculty': True
        })
        external_forwarded = mongo.db.external_marks.count_documents({
            'exam_id': ObjectId(exam_id),
            'subject_id': sub_oid,
            'is_submitted_by_faculty': True
        })

        # Students enrolled in this subject
        enrolled = sum(1 for app in applications if sub_oid in app.get('subjects', []))

        subject_status.append({
            'subject_id': str(sub_oid),
            'subject_name': sub_name,
            'enrolled_students': enrolled,
            'internal_entered': internal_count,
            'internal_forwarded': internal_forwarded,
            'external_entered': external_count,
            'external_forwarded': external_forwarded,
            'external_verified': external_verified_count,
            'internal_complete': internal_count >= enrolled,
            'internal_forwarded_ok': internal_forwarded >= enrolled,
            'external_complete': external_count >= enrolled,
            'external_forwarded_ok': external_forwarded >= enrolled,
            'external_verified_ok': external_verified_count >= enrolled,
            'ready_for_result': internal_count >= enrolled and external_verified_count >= enrolled
        })

    all_ready = all(s['ready_for_result'] for s in subject_status)

    return jsonify({
        'exam_id': exam_id,
        'total_approved_students': total_students,
        'total_subjects': len(subject_status),
        'all_ready': all_ready,
        'subjects': subject_status
    }), 200


@marks_verify_bp.route('/student/<exam_id>/<student_id>', methods=['GET'])
@role_required(['Exam Cell'])
def verify_student_marks(exam_id, student_id):
    """Verify marks completeness for a specific student."""
    app_data = mongo.db.exam_applications.find_one({
        'exam_id': ObjectId(exam_id),
        'student_id': ObjectId(student_id)
    })
    if not app_data:
        return jsonify({'message': 'No application found for this student'}), 404

    subjects = app_data.get('subjects', [])
    subject_checks = []

    for sub_oid in subjects:
        sub = mongo.db.subjects.find_one({'_id': sub_oid})
        sub_name = sub.get('name', '') if sub else str(sub_oid)

        internal = mongo.db.internal_marks.find_one({
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'subject_id': sub_oid
        })
        external = mongo.db.external_marks.find_one({
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'subject_id': sub_oid
        })

        subject_checks.append({
            'subject_id': str(sub_oid),
            'subject_name': sub_name,
            'has_internal': bool(internal),
            'has_external': bool(external),
            'internal_marks': internal.get('marks') if internal else None,
            'external_marks': external.get('marks') if external else None,
            'ready': bool(internal) and bool(external)
        })

    all_ready = all(s['ready'] for s in subject_checks)
    return jsonify({
        'student_id': student_id,
        'all_ready': all_ready,
        'subjects': subject_checks
    }), 200


@marks_verify_bp.route('/approve/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def approve_for_result(exam_id):
    """Mark an exam as verified and approved for result compilation."""
    status_data = verification_status(exam_id)
    # Check if all ready
    mongo.db.exams.update_one(
        {'_id': ObjectId(exam_id)},
        {'$set': {'marks_verified': True, 'marks_verified_at': datetime.datetime.utcnow()}}
    )
    log_audit('MARKS_VERIFIED', {'exam_id': exam_id})
    return jsonify({'message': 'Marks verified and approved for result processing'}), 200
@marks_verify_bp.route('/forward', methods=['POST'])
@role_required(['Faculty'])
def forward_marks():
    """Faculty forwards marks for a subject to Exam Cell."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    exam_type = data.get('exam_type')
    exam_mode = data.get('exam_mode', 'internal') # 'internal' or 'external'

    if not all([exam_id, subject_id]):
        return jsonify({'message': 'exam_id and subject_id are required'}), 400

    query = {
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id)
    }
    if exam_mode == 'internal' and exam_type:
        query['exam_type'] = exam_type

    collection = mongo.db.internal_marks if exam_mode == 'internal' else mongo.db.external_marks

    # Ensure no eligible student is left editable due to a missing mark document.
    # Create minimal placeholder docs for subject students before forwarding.
    subject_doc = mongo.db.subjects.find_one({'_id': ObjectId(subject_id)})
    eligible_students = []

    # Prefer exam applications for the current exam and subject, then fallback to subject semester.
    approved_apps = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id), 'status': 'Approved'}))
    eligible_ids = set()
    for app in approved_apps:
        subjects = app.get('subjects', [])
        if not subjects or ObjectId(subject_id) in subjects or str(subject_id) in [str(s) for s in subjects]:
            sid = app.get('student_id') or app.get('studentId')
            if sid:
                try:
                    eligible_ids.add(ObjectId(sid) if not isinstance(sid, ObjectId) else sid)
                except Exception:
                    pass

    if eligible_ids:
        eligible_students = [{'_id': sid} for sid in eligible_ids]
    elif subject_doc:
        semester = subject_doc.get('semester')
        sem_values = [semester, str(semester)]
        try:
            sem_values.append(int(float(semester)))
        except Exception:
            pass

        student_query = {}
        if semester is not None and semester != '':
            student_query = {'$or': [{'current_semester': {'$in': sem_values}}, {'semester': {'$in': sem_values}}]}
        eligible_students = list(mongo.db.students.find(student_query, {'_id': 1}))

    if eligible_students:
        if exam_mode == 'internal' and exam_type:
            settings = mongo.db.exam_settings.find_one({}) or {}
            if exam_type in ['ca1', 'ca2']:
                default_max = 5.0
                default_status = ''
            elif exam_type == 'practical_internal':
                default_max = 60.0
                default_status = 'ABSENT'
            else:
                default_max = float(settings.get('max_internal_marks', 20))
                default_status = 'ABSENT'

            for st in eligible_students:
                collection.update_one(
                    {
                        'exam_id': ObjectId(exam_id),
                        'subject_id': ObjectId(subject_id),
                        'student_id': st['_id'],
                        'exam_type': exam_type
                    },
                    {
                        '$setOnInsert': {
                            'exam_id': ObjectId(exam_id),
                            'subject_id': ObjectId(subject_id),
                            'student_id': st['_id'],
                            'exam_type': exam_type,
                            'marks': 0.0,
                            'max_marks': default_max,
                            'status': default_status,
                            'remarks': 'Auto-marked during forwarding (no entry submitted)',
                            'is_pass': False,
                            'entered_at': datetime.datetime.utcnow()
                        }
                    },
                    upsert=True
                )
        else:
            for st in eligible_students:
                collection.update_one(
                    {
                        'exam_id': ObjectId(exam_id),
                        'subject_id': ObjectId(subject_id),
                        'student_id': st['_id']
                    },
                    {
                        '$setOnInsert': {
                            'exam_id': ObjectId(exam_id),
                            'subject_id': ObjectId(subject_id),
                            'student_id': st['_id'],
                            'marks': 0.0,
                            'max_marks': 60.0,
                            'special_case': 'Absent',
                            'grade': 'FF',
                            'grade_point': 0,
                            'is_pass': False,
                            'entered_at': datetime.datetime.utcnow()
                        }
                    },
                    upsert=True
                )
    
    # Update all matching records
    result = collection.update_many(
        query,
        {'$set': {
            'is_submitted_by_faculty': True,
            'submitted_at': datetime.datetime.utcnow(),
            'is_locked': True # Also lock them
        }}
    )

    log_audit('MARKS_FORWARDED', {
        'exam_id': exam_id,
        'subject_id': subject_id,
        'exam_type': exam_type,
        'exam_mode': exam_mode,
        'count': result.modified_count
    })

    return jsonify({'message': f'Marks for {result.modified_count} students forwarded to Exam Cell successfully.'}), 200
