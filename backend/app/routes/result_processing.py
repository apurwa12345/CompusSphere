"""
Module 10: Result Processing
Calculate total marks, grade, SGPA, generate result records.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import calculate_grade, calculate_sgpa, calculate_cgpa, convert_cgpa_to_percentage

result_processing_bp = Blueprint('result_processing', __name__)


@result_processing_bp.route('/compile/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def compile_results(exam_id):
    """
    Compile results for all approved students in an exam.
    Combines internal + external marks, calculates grade and SGPA.
    """
    print(f"DEBUG: Compiling results for exam_id: {exam_id}")
    applications = list(mongo.db.exam_applications.find({
        'exam_id': ObjectId(exam_id),
        'status': 'Approved'
    }))

    if not applications:
        return jsonify({'message': 'No approved applications to compile'}), 404

    settings = mongo.db.exam_settings.find_one({}) or {}
    passing_pct = settings.get('passing_percentage', 40)

    compiled = 0
    for app in applications:
        student_id = app.get('student_id') or app.get('studentId')
        if not student_id:
            continue
        if isinstance(student_id, str):
            student_id = ObjectId(student_id)
        subjects = app.get('subjects', [])

        subject_marks_info = []
        has_backlog = False
        subject_results = []

        for sub_oid in subjects:
            if isinstance(sub_oid, str):
                sub_oid = ObjectId(sub_oid)
            
            internal_docs = list(mongo.db.internal_marks.find({
                'exam_id': ObjectId(exam_id),
                'student_id': student_id,
                'subject_id': sub_oid
            }))
            external = mongo.db.external_marks.find_one({
                'exam_id': ObjectId(exam_id),
                'student_id': student_id,
                'subject_id': sub_oid
            })

            sub = mongo.db.subjects.find_one({'_id': sub_oid})
            sub_name = sub.get('name', '') if sub else ''
            sub_type = sub.get('type', '') if sub else ''
            
            try:
                raw_credits = sub.get('credits', 3) if sub else 3
                credits = float(raw_credits) if raw_credits not in [None, ''] else 3.0
            except:
                credits = 3.0

            # Audit Subjects Logic (Yoga, NCC, NSS)
            # Normalize name for comparison
            normalized_name = sub_name.strip()
            audit_names = ['A. Yoga Education', 'C. NCC', 'B. NSS-I', 'A.Yoga Education', 'C.NCC', 'B.NSS-I']
            is_audit = normalized_name in audit_names
            
            # Debug log to verify detection in server logs
            print(f"COMPILING: Subject='{sub_name}', Audit={is_audit}")

            if is_audit:
                grade, grade_point = 'PP', 0.0
                total_m = 0
                total_max = 100
                credits = 0.0 # Audit subjects don't count towards SGPA/CGPA
                special_case = 'None'
                internal_m = 0
                external_m = 0
            else:
                def safe_float(v):
                    try:
                        return float(v) if v not in [None, ''] else 0.0
                    except (ValueError, TypeError):
                        return 0.0

                external_m = safe_float(external.get('marks', 0)) if external else 0.0
                special_case = external.get('special_case', 'None') if external else 'None'

                is_practical = (sub_type in ['Practical Lab', 'Practical']) or (sub and ('L' in sub.get('code', '') or 'Lab' in sub.get('name', '') or int(sub.get('p') or 0) > 0))
                if is_practical:
                    pract_doc = next((d for d in internal_docs if d.get('exam_type') == 'practical_internal'), None)
                    internal_m = safe_float(pract_doc.get('marks', 0)) if pract_doc else 0.0
                else:
                    import math
                    pt1_doc = next((d for d in internal_docs if d.get('exam_type') == 'periodic_test_1'), None)
                    pt1 = safe_float(pt1_doc.get('marks', 0)) if pt1_doc else 0.0
                    pt2_doc = next((d for d in internal_docs if d.get('exam_type') == 'periodic_test_2'), None)
                    pt2 = safe_float(pt2_doc.get('marks', 0)) if pt2_doc else 0.0
                    mid_doc = next((d for d in internal_docs if d.get('exam_type') == 'mid_semester_exam'), None)
                    mid = safe_float(mid_doc.get('marks', 0)) if mid_doc else 0.0
                    
                    ca1 = math.ceil((pt1 * 5) / 20)
                    ca2 = math.ceil((pt2 * 5) / 20)
                    attendance = 4
                    assignment = 6
                    total_ca = ca1 + ca2 + attendance + assignment
                    internal_m = total_ca + mid

                total_m = internal_m + external_m
                total_max = 100
                
                grade, grade_point = calculate_grade(total_m, total_max)

            is_backlog = (grade == 'FF') or (special_case in ['Absent', 'Malpractice'])
            if is_backlog:
                has_backlog = True

            subject_marks_info.append({'credits': credits, 'grade_point': grade_point})
            subject_results.append({
                'subject_id': str(sub_oid),
                'subject_name': sub_name,
                'credits': credits,
                'internal_marks': internal_m,
                'external_marks': external_m,
                'total_marks': total_m,
                'max_marks': total_max,
                'grade': grade,
                'grade_point': grade_point,
                'special_case': special_case,
                'is_backlog': is_backlog
            })

            # Also upsert combined marks record
            mongo.db.marks.update_one(
                {'exam_id': ObjectId(exam_id), 'student_id': student_id, 'subject_id': sub_oid},
                {'$set': {
                    'exam_id': ObjectId(exam_id),
                    'student_id': student_id,
                    'subject_id': sub_oid,
                    'internal_marks': internal_m,
                    'external_marks': external_m,
                    'total_marks': total_m,
                    'grade': grade,
                    'grade_point': grade_point,
                    'is_backlog': is_backlog,
                    'special_case': special_case
                }},
                upsert=True
            )

        sgpa = calculate_sgpa(subject_marks_info)
        
        # Calculate CGPA
        all_results = list(mongo.db.results.find({'student_id': student_id}))
        all_past_subjects = []
        for r in all_results:
            if str(r.get('exam_id')) != str(exam_id): # Don't include current one yet if already exists
                for sr in r.get('subject_results', []):
                    # We need credits for past subjects too. 
                    # If we don't store credits in result_record, we have to fetch them.
                    # Let's assume we should store credits in subject_results for easier CGPA calculation.
                    all_past_subjects.append({
                        'credits': sr.get('credits', 3),
                        'grade_point': sr.get('grade_point', 0)
                    })
        
        # Add current subjects
        all_past_subjects.extend(subject_marks_info)
        cgpa = calculate_cgpa(all_past_subjects)

        result_record = {
            'student_id': student_id,
            'exam_id': ObjectId(exam_id),
            'sgpa': sgpa,
            'cgpa': cgpa,
            'percentage': convert_cgpa_to_percentage(cgpa),
            'has_backlogs': has_backlog,
            'status': 'FAIL' if has_backlog else 'PASS',
            'subject_results': subject_results,
            'is_published': False,
            'compiled_at': datetime.datetime.utcnow()
        }

        mongo.db.results.update_one(
            {'student_id': student_id, 'exam_id': ObjectId(exam_id)},
            {'$set': result_record},
            upsert=True
        )

        # Track backlogs
        if has_backlog:
            for sr in subject_results:
                if sr['is_backlog']:
                    mongo.db.backlogs.update_one(
                        {
                            'student_id': student_id,
                            'exam_id': ObjectId(exam_id),
                            'subject_id': ObjectId(sr['subject_id'])
                        },
                        {'$set': {
                            'student_id': student_id,
                            'exam_id': ObjectId(exam_id),
                            'subject_id': ObjectId(sr['subject_id']),
                            'subject_name': sr['subject_name'],
                            'grade': sr['grade'],
                            'status': 'Pending',  # Pending | Cleared
                            'created_at': datetime.datetime.utcnow()
                        }},
                        upsert=True
                    )

        compiled += 1

    # Update exam status
    mongo.db.exams.update_one({'_id': ObjectId(exam_id)}, {'$set': {'status': 'Completed'}})
    log_audit('RESULT_COMPILED', {'exam_id': exam_id, 'count': compiled})
    return jsonify({'message': f'Results compiled for {compiled} students'}), 200


@result_processing_bp.route('/exam/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def list_results(exam_id):
    """List all compiled results for an exam."""
    results = list(mongo.db.results.find({'exam_id': ObjectId(exam_id)}))
    output = []
    for r in results:
        r['_id'] = str(r['_id'])
        r['student_id'] = str(r['student_id'])
        r['exam_id'] = str(r['exam_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(r['student_id'])})
        if student:
            r['student_name'] = student.get('name', '')
            r['enrollment_no'] = student.get('enrollment_no', '')
        output.append(r)
    return jsonify(output), 200


@result_processing_bp.route('/student/me', methods=['GET'])
@role_required(['Student'])
def my_results():
    """Student views their own compiled results."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    results = list(mongo.db.results.find({
        'student_id': student['_id'],
        'is_published': True
    }))
    output = []
    for r in results:
        r['_id'] = str(r['_id'])
        r['student_id'] = str(r['student_id'])
        r['exam_id'] = str(r['exam_id'])
        exam = mongo.db.exams.find_one({'_id': ObjectId(r['exam_id'])})
        if exam:
            r['exam_name'] = exam.get('name', '')
            r['exam_type'] = exam.get('exam_type', '')
            
        for sr in r.get('subject_results', []):
            try:
                sub = mongo.db.subjects.find_one({'_id': ObjectId(sr['subject_id'])})
                sr['subject_code'] = sub.get('code', '') if sub else ''
            except Exception:
                sr['subject_code'] = ''
                
        output.append(r)

    cgpa = round(sum(r['sgpa'] for r in output) / len(output), 2) if output else 0.0
    return jsonify({'results': output, 'cgpa': cgpa}), 200
