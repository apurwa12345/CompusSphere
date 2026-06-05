"""
Module 15: Reports & Analytics
Pass/fail rates, toppers list, subject-wise analysis.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/exam/<exam_id>/summary', methods=['GET'])
@role_required(['Exam Cell'])
def exam_summary(exam_id):
    """Overall pass/fail/backlog summary for an exam."""
    results = list(mongo.db.results.find({'exam_id': ObjectId(exam_id)}))
    total = len(results)
    passed = sum(1 for r in results if r.get('status') == 'PASS')
    failed = sum(1 for r in results if r.get('status') == 'FAIL')
    avg_sgpa = round(sum(r.get('sgpa', 0) for r in results) / total, 2) if total else 0

    return jsonify({
        'exam_id': exam_id,
        'total_students': total,
        'passed': passed,
        'failed': failed,
        'pass_rate': round((passed / total) * 100, 1) if total else 0,
        'fail_rate': round((failed / total) * 100, 1) if total else 0,
        'average_sgpa': avg_sgpa
    }), 200


@analytics_bp.route('/exam/<exam_id>/toppers', methods=['GET'])
@role_required(['Exam Cell'])
def toppers(exam_id):
    """Top performing students sorted by SGPA."""
    limit = int(request.args.get('limit', 10))
    results = list(mongo.db.results.find(
        {'exam_id': ObjectId(exam_id), 'is_published': True}
    ).sort('sgpa', -1).limit(limit))

    toppers_list = []
    rank = 1
    for r in results:
        student = mongo.db.students.find_one({'_id': r['student_id']})
        toppers_list.append({
            'rank': rank,
            'student_name': student.get('name', '') if student else '',
            'enrollment_no': student.get('enrollment_no', '') if student else '',
            'sgpa': r.get('sgpa', 0),
            'status': r.get('status', '')
        })
        rank += 1
    return jsonify(toppers_list), 200


@analytics_bp.route('/exam/<exam_id>/subject-analysis', methods=['GET'])
@role_required(['Exam Cell'])
def subject_analysis(exam_id):
    """Subject-wise pass/fail analysis for an exam."""
    marks_list = list(mongo.db.marks.find({'exam_id': ObjectId(exam_id)}))

    subject_map = {}
    for m in marks_list:
        sid = str(m['subject_id'])
        if sid not in subject_map:
            sub = mongo.db.subjects.find_one({'_id': m['subject_id']})
            subject_map[sid] = {
                'subject_id': sid,
                'subject_name': sub.get('name', '') if sub else sid,
                'total': 0, 'passed': 0, 'failed': 0,
                'total_marks_sum': 0, 'absent': 0, 'malpractice': 0
            }
        subject_map[sid]['total'] += 1
        if m.get('is_backlog'):
            subject_map[sid]['failed'] += 1
        else:
            subject_map[sid]['passed'] += 1
        if m.get('special_case') == 'Absent':
            subject_map[sid]['absent'] += 1
        if m.get('special_case') == 'Malpractice':
            subject_map[sid]['malpractice'] += 1
        subject_map[sid]['total_marks_sum'] += m.get('total_marks', 0)

    result = []
    for sid, data in subject_map.items():
        data['pass_rate'] = round((data['passed'] / data['total']) * 100, 1) if data['total'] else 0
        data['average_marks'] = round(data['total_marks_sum'] / data['total'], 1) if data['total'] else 0
        result.append(data)

    return jsonify(result), 200


@analytics_bp.route('/department/<dept_id>/overview', methods=['GET'])
@role_required(['Exam Cell'])
def department_overview(dept_id):
    """Overall performance overview for a department across all exams."""
    students = list(mongo.db.students.find({'department_id': ObjectId(dept_id)}))
    student_ids = [s['_id'] for s in students]
    total_students = len(student_ids)

    results = list(mongo.db.results.find({'student_id': {'$in': student_ids}}))
    pass_count = sum(1 for r in results if r.get('status') == 'PASS')
    fail_count = sum(1 for r in results if r.get('status') == 'FAIL')
    avg_sgpa = round(sum(r.get('sgpa', 0) for r in results) / len(results), 2) if results else 0

    return jsonify({
        'department_id': dept_id,
        'total_students': total_students,
        'total_exams_appeared': len(results),
        'pass_count': pass_count,
        'fail_count': fail_count,
        'average_sgpa': avg_sgpa
    }), 200


@analytics_bp.route('/semester/<int:semester>/summary', methods=['GET'])
@role_required(['Exam Cell'])
def semester_summary(semester):
    """Summary of results for a specific semester across all exams."""
    exams = list(mongo.db.exams.find({'semester': semester}))
    exam_ids = [e['_id'] for e in exams]
    results = list(mongo.db.results.find({'exam_id': {'$in': exam_ids}}))
    total = len(results)
    passed = sum(1 for r in results if r.get('status') == 'PASS')
    avg_sgpa = round(sum(r.get('sgpa', 0) for r in results) / total, 2) if total else 0

    return jsonify({
        'semester': semester,
        'total_exams': len(exam_ids),
        'total_results': total,
        'passed': passed,
        'failed': total - passed,
        'pass_rate': round((passed / total) * 100, 1) if total else 0,
        'average_sgpa': avg_sgpa
    }), 200
