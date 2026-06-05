from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import calculate_grade, calculate_sgpa

marks_bp = Blueprint('marks', __name__)

@marks_bp.route('/', methods=['POST'])
@role_required(['Faculty'])
def enter_marks():
    data = request.get_json()
    student_id = data.get("student_id")
    exam_id = data.get("exam_id")
    subject_id = data.get("subject_id")
    internal_marks = float(data.get("internal_marks", 0))
    external_marks = float(data.get("external_marks", 0))
    total_marks = internal_marks + external_marks

    settings = mongo.db.exam_settings.find_one({}) or {}
    max_internal = float(settings.get("max_internal_marks", 20))
    max_external = float(settings.get("max_external_marks", 60))

    if internal_marks < 0 or internal_marks > max_internal or external_marks < 0 or external_marks > max_external:
        return jsonify({"message": f"Invalid marks entered (Internal max {max_internal}, External max {max_external})"}), 400
        
    grade, grade_point = calculate_grade(total_marks, 100)

    mark_entry = {
        "student_id": ObjectId(student_id),
        "exam_id": ObjectId(exam_id),
        "subject_id": ObjectId(subject_id),
        "internal_marks": internal_marks,
        "external_marks": external_marks,
        "total_marks": total_marks,
        "grade": grade,
        "grade_point": grade_point,
        "is_backlog": (grade == 'FF')
    }
    
    # Upsert logic to update if existing record or create new
    mongo.db.marks.update_one(
        {"student_id": ObjectId(student_id), "exam_id": ObjectId(exam_id), "subject_id": ObjectId(subject_id)},
        {"$set": mark_entry},
        upsert=True
    )
    
    log_audit("ENTER_MARKS", {"student_id": student_id, "subject_id": subject_id})
    return jsonify({"message": "Marks recorded successfully", "total": total_marks, "grade": grade}), 200

@marks_bp.route('/compile/<exam_id>', methods=['POST'])
@role_required(['Exam Cell', 'Admin'])
def compile_results(exam_id):
    """
    Compiles all marks for a generic exam and generates Results containing SGPA.
    This runs at the end of the evaluation phase.
    """
    students_in_exam = mongo.db.marks.distinct("student_id", {"exam_id": ObjectId(exam_id)})
    
    results = []
    for student_id in students_in_exam:
        student_marks_cursor = mongo.db.marks.find({"exam_id": ObjectId(exam_id), "student_id": student_id})
        student_marks = list(student_marks_cursor)
        
        subject_credits_info = []
        has_backlogs = False
        
        for m in student_marks:
            # fetch subject credits
            subject = mongo.db.subjects.find_one({"_id": m["subject_id"]})
            if subject:
                c = subject.get("credits", 3)
                subject_credits_info.append({"credits": c, "grade_point": m["grade_point"]})
                if m["is_backlog"]:
                    has_backlogs = True
                    
        sgpa = calculate_sgpa(subject_credits_info)
        
        result_record = {
            "student_id": student_id,
            "exam_id": ObjectId(exam_id),
            "sgpa": sgpa,
            "has_backlogs": has_backlogs,
            "status": "FAIL" if has_backlogs else "PASS"
        }
        
        # Upsert Result
        mongo.db.results.update_one(
            {"student_id": student_id, "exam_id": ObjectId(exam_id)},
            {"$set": result_record},
            upsert=True
        )
        results.append(result_record)
    
    log_audit("COMPILE_RESULTS", {"exam_id": exam_id, "records_processed": len(results)})
    return jsonify({"message": f"Results compiled for {len(results)} students"}), 200

@marks_bp.route('/student/<student_id>', methods=['GET'])
@jwt_required()
def get_student_results(student_id):
    results = list(mongo.db.results.find({"student_id": ObjectId(student_id)}))
    for r in results:
        r['_id'] = str(r['_id'])
        r['student_id'] = str(r['student_id'])
        r['exam_id'] = str(r['exam_id'])
    
    # Calculate weighted CGPA
    all_subject_marks = []
    for r in results:
        for sr in r.get('subject_results', []):
            all_subject_marks.append({
                'credits': sr.get('credits', 3),
                'grade_point': sr.get('grade_point', 0)
            })
    
    cgpa = calculate_cgpa(all_subject_marks)
    percentage = convert_cgpa_to_percentage(cgpa)
        
    return jsonify({
        "results": results, 
        "cgpa": cgpa,
        "percentage": percentage
    }), 200

@marks_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_results():
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({"email": email})
    if not student:
        return jsonify({"message": "Student profile not found"}), 404
    return get_student_results(str(student['_id']))
