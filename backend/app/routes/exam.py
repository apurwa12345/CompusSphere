import datetime
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import create_hall_ticket_pdf

exam_bp = Blueprint('exam', __name__)

@exam_bp.route('/', methods=['GET'])
@jwt_required()
def get_exams():
    exams = list(mongo.db.exams.find({}))
    for e in exams:
        e['_id'] = str(e['_id'])
        e['department_id'] = str(e.get('department_id'))
    return jsonify(exams), 200

@exam_bp.route('/', methods=['POST'])
@role_required(['Admin', 'Exam Cell'])
def create_exam():
    data = request.get_json()
    dept_id_raw = data.get("department_id")
    department_id = "ALL" if dept_id_raw == "ALL" else ObjectId(dept_id_raw)
    
    new_exam = {
        "name": data.get("name"),
        "department_id": department_id,
        "semester": data.get("semester"),
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "status": "Upcoming", # Upcoming, Ongoing, Completed, Results Declared
        "timetable": data.get("timetable", []) # List of {subject_id, date, time}
    }
    result = mongo.db.exams.insert_one(new_exam)
    log_audit("CREATE_EXAM", {"exam_name": new_exam["name"]})
    return jsonify({"message": "Exam created", "id": str(result.inserted_id)}), 201

@exam_bp.route('/<exam_id>/schedule', methods=['PUT'])
@role_required(['Admin', 'Exam Cell'])
def schedule_exam(exam_id):
    data = request.get_json()
    timetable = data.get("timetable")
    mongo.db.exams.update_one({"_id": ObjectId(exam_id)}, {"$set": {"timetable": timetable}})
    log_audit("UPDATE_EXAM_SCHEDULE", {"exam_id": exam_id})
    return jsonify({"message": "Timetable updated"}), 200

@exam_bp.route('/<exam_id>/assign-faculty', methods=['POST'])
@role_required(['Admin', 'Exam Cell', 'HOD'])
def assign_faculty(exam_id):
    data = request.get_json()
    assignment = {
        "exam_id": ObjectId(exam_id),
        "subject_id": ObjectId(data.get("subject_id")),
        "faculty_id": ObjectId(data.get("faculty_id"))
    }
    mongo.db.evaluator_assignments.insert_one(assignment)
    log_audit("ASSIGN_FACULTY_EVALUATOR", {"exam_id": exam_id, "faculty_id": data.get("faculty_id")})
    return jsonify({"message": "Faculty assigned for evaluation"}), 201

@exam_bp.route('/apply', methods=['POST'])
@role_required(['Student'])
def apply_exam():
    current_user = get_jwt_identity()
    user_email = current_user['email'] if isinstance(current_user, dict) else current_user
    
    student = mongo.db.students.find_one({"email": user_email})
    if not student:
        return jsonify({"message": "Student profile not found"}), 404
        
    transaction_id = data.get("transaction_id")
    if not transaction_id:
        return jsonify({"message": "Exam fees must be paid before submission (Transaction ID required)"}), 400
        
    application = {
        "exam_id": ObjectId(exam_id),
        "student_id": ObjectId(student['_id']),
        "subjects": data.get("subjects", []),
        "transaction_id": transaction_id,
        "fees_paid": True,
        "applied_on": datetime.datetime.utcnow(),
        "status": "Pending" 
    }
    result = mongo.db.exam_applications.insert_one(application)
    log_audit("EXAM_APP_SUBMITTED", {"exam_id": exam_id, "student_id": str(student['_id'])})
    return jsonify({"message": "Application successful", "application_id": str(result.inserted_id)}), 201

@exam_bp.route('/hall-ticket/<application_id>', methods=['GET'])
@role_required(['Student', 'Exam Cell', 'Admin'])
def download_hall_ticket(application_id):
    app_data = mongo.db.exam_applications.find_one({"_id": ObjectId(application_id)})
    if not app_data:
        return jsonify({"message": "Application not found"}), 404
        
    student = mongo.db.students.find_one({"_id": app_data['student_id']})
    exam = mongo.db.exams.find_one({"_id": app_data['exam_id']})
    
    # Get subjects info for the timetable
    subjects = []
    for entry in exam.get('timetable', []):
        sub = mongo.db.subjects.find_one({"_id": ObjectId(entry['subject_id'])})
        if sub:
            subjects.append({
                "subject_name": sub['name'],
                "date": entry['date'],
                "time": entry['time']
            })
            
    pdf_path = create_hall_ticket_pdf(
        student_info=student, 
        exam_info=exam, 
        subjects=subjects, 
        application_id=application_id
    )
    
    log_audit("DOWNLOAD_HALL_TICKET", {"application_id": application_id})
    return send_file(pdf_path, as_attachment=True)

@exam_bp.route('/<exam_id>/applications', methods=['GET'])
@role_required(['Admin', 'Exam Cell'])
def get_exam_applications(exam_id):
    applications = list(mongo.db.exam_applications.find({"exam_id": ObjectId(exam_id)}))
    
    # Manually join student data
    for app in applications:
        app['_id'] = str(app['_id'])
        app['exam_id'] = str(app['exam_id'])
        app['student_id'] = str(app['student_id'])
        
        student = mongo.db.students.find_one({"_id": ObjectId(app['student_id'])})
        if student:
            app['student_name'] = student.get('name')
            app['enrollment_no'] = student.get('enrollment_no')
            app['department_id'] = str(student.get('department_id'))
        else:
            app['student_name'] = 'Unknown'
            
        app['transaction_id'] = app.get('transaction_id', 'N/A')
            
    return jsonify(applications), 200

@exam_bp.route('/application/<application_id>/status', methods=['PATCH'])
@role_required(['Admin', 'Exam Cell'])
def update_application_status(application_id):
    data = request.get_json()
    new_status = data.get('status')
    remarks = data.get('remarks', '')
    
    app = mongo.db.exam_applications.find_one({"_id": ObjectId(application_id)})
    if not app:
        return jsonify({"message": "Application not found"}), 404

    if new_status == 'Approved' and not app.get('fees_paid'):
        return jsonify({"message": "Cannot approve application while fees are unpaid"}), 400

    mongo.db.exam_applications.update_one(
        {"_id": ObjectId(application_id)}, 
        {"$set": {"status": new_status, "remarks": remarks}}
    )
    
    log_audit("UPDATE_EXAM_APP_STATUS", {"application_id": application_id, "status": new_status})
    return jsonify({"message": f"Application {new_status}"}), 200
