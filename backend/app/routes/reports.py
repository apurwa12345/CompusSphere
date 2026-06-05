import csv
import io
import datetime
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit
from app.utils.helpers import paginate_query

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/students', methods=['GET'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def report_students():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    department_id = request.args.get('department_id')
    export = request.args.get('export') == 'true'
    
    query = {}
    if department_id:
        query['department_id'] = department_id
        
    pagination = paginate_query(mongo.db.students, query, page, per_page)
    
    # Format ObjectIds to string for JSON serialization
    for s in pagination['items']:
        s['_id'] = str(s['_id'])
        
    if export:
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Enrollment No', 'Name', 'Email', 'Batch Year', 'Semester'])
        for s in pagination['items']:
            writer.writerow([s.get('enrollment_no'), s.get('name'), s.get('email'), s.get('batch_year'), s.get('current_semester')])
            
        csv_data = output.getvalue()
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = "attachment; filename=students_report.csv"
        response.headers["Content-type"] = "text/csv"
        log_audit("EXPORT_STUDENT_REPORT")
        return response
        
    return jsonify(pagination), 200

@reports_bp.route('/faculty', methods=['GET'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def report_faculty():
    export = request.args.get('export') == 'true'
    query = {"role": "Faculty"}
    
    if export:
        items = list(mongo.db.users.find(query))
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Name', 'Email', 'Role', 'Department', 'Experience', 'ID'])
        for f in items:
            writer.writerow([f.get('name'), f.get('email'), f.get('role'), f.get('dept') or f.get('department'), f.get('experience'), f.get('caserp_id')])
            
        csv_data = output.getvalue()
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = "attachment; filename=faculty_report.csv"
        response.headers["Content-type"] = "text/csv"
        log_audit("EXPORT_FACULTY_REPORT")
        return response
        
    pagination = paginate_query(mongo.db.users, query, 1, 10)
    for s in pagination['items']:
        s['_id'] = str(s['_id'])
    return jsonify(pagination), 200

@reports_bp.route('/subjects', methods=['GET'])
@role_required(['Admin', 'HOD', 'Exam Cell'])
def report_subjects():
    export = request.args.get('export') == 'true'
    
    if export:
        items = list(mongo.db.subjects.find({}))
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Code', 'Name', 'Type', 'Credits', 'Semester', 'Total'])
        for s in items:
            writer.writerow([s.get('code'), s.get('name'), s.get('type'), s.get('credits'), s.get('semester'), s.get('total')])
            
        csv_data = output.getvalue()
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = "attachment; filename=subjects_report.csv"
        response.headers["Content-type"] = "text/csv"
        log_audit("EXPORT_SUBJECTS_REPORT")
        return response
        
    pagination = paginate_query(mongo.db.subjects, {}, 1, 10)
    for s in pagination['items']:
        s['_id'] = str(s['_id'])
    return jsonify(pagination), 200

@reports_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    current_user = get_jwt_identity()
    user_email = current_user['email'] if isinstance(current_user, dict) else current_user
    user_role = current_user['role'] if isinstance(current_user, dict) else None
    if not user_role:
        user_doc = mongo.db.users.find_one({"email": user_email}, {"role": 1})
        user_role = user_doc.get("role") if user_doc else "Student"
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 5))
    source = request.args.get('source')
    
    # Filter for target audience unless user is an Admin
    if user_role == 'Admin':
        query = {"type": {"$exists": False}}
    else:
        user = mongo.db.users.find_one({"email": user_email}, {"_id": 1})
        user_id = user["_id"] if user else None
        
        or_conditions = [
            {"target_email": user_email},
            {"target_role": user_role},
            {"target_role": "All"}
        ]
        if user_id:
            or_conditions.append({"user_id": user_id})
        query = {"$or": or_conditions}

    # Add source filter if provided
    if source:
        if "$or" in query:
            # If we already have an OR query, we need to AND the source filter
            query = {"$and": [query, {"source": source}]}
        else:
            query["source"] = source
    
    pagination = paginate_query(mongo.db.notifications, query, page, per_page, sort_by="created_at", sort_order=-1)
    
    for n in pagination['items']:
        n['_id'] = str(n['_id'])
        if 'created_at' in n and n['created_at']:
            if hasattr(n['created_at'], 'isoformat'):
                n['created_at'] = n['created_at'].isoformat()
            else:
                n['created_at'] = str(n['created_at'])
        
    return jsonify(pagination), 200

@reports_bp.route('/notifications', methods=['POST'])
@role_required(['Admin', 'Exam Cell'])
def create_notification():
    data = request.get_json()
    new_notif = {
        "title": data.get("title"),
        "message": data.get("message"),
        "target_email": data.get("target_email"), # nullable
        "target_role": data.get("target_role", "All"), # Admin, HOD, Faculty, Student, All
        "created_at": datetime.datetime.utcnow()
    }
    result = mongo.db.notifications.insert_one(new_notif)
    log_audit("CREATE_NOTIFICATION", {"title": new_notif["title"]})
    return jsonify({"message": "Notification broadcasted", "id": str(result.inserted_id)}), 201


@reports_bp.route('/contact', methods=['POST'])
def create_contact_message():
    """
    Public endpoint used by the Home "Get in Touch" form.
    Stores messages in the existing `notifications` collection so Admin can view them.
    """
    data = request.get_json() or {}
    full_name = (data.get("full_name") or data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not message or not subject:
        return jsonify({"message": "Subject and message are required"}), 400
    if not email:
        return jsonify({"message": "Email is required"}), 400

    new_notif = {
        "title": f"Contact Request: {subject}",
        "message": f"From: {full_name} <{email}>\n\n{message}",
        "target_email": None,
        "target_role": "Admin",
        "created_at": datetime.datetime.utcnow(),
        # Used by the Admin "Inbox" view to filter contact messages only.
        "source": "contact_form"
    }
    result = mongo.db.notifications.insert_one(new_notif)
    log_audit("CONTACT_FORM", {"email": email, "subject": subject})
    return jsonify({"message": "Contact message received", "id": str(result.inserted_id)}), 201
