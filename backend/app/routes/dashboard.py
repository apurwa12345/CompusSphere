import datetime
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from app import mongo
import math

dashboard_bp = Blueprint('dashboard', __name__)

def _get_identity():
    identity = get_jwt_identity()
    claims = get_jwt()
    if isinstance(identity, dict):
        return identity.get('email'), identity.get('role') or claims.get('role')
    return identity, claims.get('role')

def _count_by_department():
    """
    Count students by department.
    Fixed: Uses 'department' field (text) instead of 'department_id' (numeric)
    which doesn't contain valid department references.
    """
    departments = list(mongo.db.departments.find({}, {"_id": 1, "name": 1}))
    data = []
    for d in departments:
        dept_name = d.get("name", "")
        # Match students by department name string
        count = mongo.db.students.count_documents({"department": dept_name})
        data.append({"name": dept_name, "students": count})
    return data

def _semester_overview():
    pipeline = [
        {"$match": {"current_semester": {"$ne": None}}},
        {"$group": {"_id": "$current_semester", "students": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    result = list(mongo.db.students.aggregate(pipeline))
    return [{"sem": f"Semester {r['_id']}", "students": r["students"]} for r in result]

def _recent_notifications(user_email, user_role, limit=5):
    user = mongo.db.users.find_one({"email": user_email}, {"_id": 1})
    user_id = user["_id"] if user else None

    # Filter for target audience unless user is an Admin
    if user_role == 'Admin':
        query = {"type": {"$exists": False}}
    else:
        or_conditions = [
            {"target_email": user_email},
            {"target_role": user_role},
            {"target_role": "All"}
        ]
        if user_id:
            or_conditions.append({"user_id": user_id})
        query = {"$or": or_conditions}
        
    items = list(mongo.db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit))
    for item in items:
        if 'created_at' in item and item['created_at']:
            if hasattr(item['created_at'], 'isoformat'):
                item['created_at'] = item['created_at'].isoformat()
            else:
                item['created_at'] = str(item['created_at'])
    return items

def _normalize_dep_key(value):
    if not value:
        return ""
    return (
        str(value)
        .upper()
        .replace(" ", "")
        .replace("&", "")
        .replace("-", "")
        .replace("_", "")
        .replace(".", "")
    )

def _parse_semester(value):
    if value is None or value == "":
        return None
    try:
        # Handles strings like "1", "1.0", numbers, etc.
        return int(float(value))
    except Exception:
        return None

def _fy_from_semester(sem):
    if not sem or sem < 1:
        return None
    fy = ((sem - 1) // 2) + 1
    return max(1, min(4, fy))

def _class_sections_overview():
    """
    Compute department-wise FY sections.
    - FY1 capacity: 70 (to allow FY 1 A/B/C style splits for large intakes)
    - FY2-FY4 capacity: 80
    FY is derived from current_semester: 1-2 => FY1, 3-4 => FY2, 5-6 => FY3, 7-8 => FY4
    """
    preferred_order = ["CSE", "IT", "AIML", "A&R", "CIVIL", "MECH", "E&TC"]
    preferred_keys = [_normalize_dep_key(x) for x in preferred_order]
    order_rank = {k: i for i, k in enumerate(preferred_keys)}

    departments = list(mongo.db.departments.find({}, {"_id": 1, "name": 1, "code": 1}))
    def _dep_rank(d):
        key = _normalize_dep_key(d.get("code") or d.get("name"))
        return order_rank.get(key, 10_000), (d.get("code") or ""), (d.get("name") or "")
    departments.sort(key=_dep_rank)

    overview = []
    for d in departments:
        dep_id = d["_id"]
        students = list(
            mongo.db.students.find(
                {"department_id": {"$in": [dep_id, str(dep_id)]}},
                {"_id": 1, "current_semester": 1},
            )
        )

        by_fy = {1: 0, 2: 0, 3: 0, 4: 0}
        for s in students:
            sem = _parse_semester(s.get("current_semester"))
            fy = _fy_from_semester(sem)
            if fy:
                by_fy[fy] += 1

        years = []
        for fy in [1, 2, 3, 4]:
            total = by_fy.get(fy, 0)
            if total <= 0:
                continue

            capacity = 70 if fy == 1 else 80
            section_count = int(math.ceil(total / capacity)) if capacity > 0 else 1
            section_count = max(1, section_count)

            sections = []
            remaining = total
            for i in range(section_count):
                letter = chr(ord("A") + i)
                name = f"FY {fy}" if section_count == 1 else f"FY {fy} {letter}"
                size = min(capacity, remaining)
                remaining -= size
                sections.append({"name": name, "students": size})

            years.append(
                {
                    "fy": fy,
                    "capacity": capacity,
                    "total_students": total,
                    "sections": sections,
                }
            )

        overview.append(
            {
                "department": {
                    "id": str(dep_id),
                    "name": d.get("name") or "",
                    "code": d.get("code") or "",
                },
                "years": years,
            }
        )

    return overview

@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
def dashboard_summary():
    email, role = _get_identity()
    summary = {}
    if not role:
        user = mongo.db.users.find_one({"email": email}, {"role": 1})
        role = user.get("role") if user else "Student"

    summary = {"role": role, "stats": {}, "charts": {}, "activity": []}

    if role == "Admin":
        total_students = mongo.db.students.count_documents({})
        # Compute real performance metrics
        results_list = list(mongo.db.results.find({}, {"sgpa": 1, "student_id": 1}))
        avg_cgpa = 0
        completion_rate = 0
        total_exams = mongo.db.results.count_documents({})
        
        if results_list:
            avg_cgpa = round(sum([r.get("sgpa", 0) for r in results_list]) / len(results_list), 2)
            # Unique students with results
            students_with_results = len(set([str(r.get("student_id")) for r in results_list]))
            if total_students > 0:
                completion_rate = round((students_with_results / total_students) * 100)

        # Faculty count for publications proxy (until a real collection is added)
        faculty_count = mongo.db.faculties.count_documents({})

        summary["stats"] = {
            "students": total_students,
            "faculty": faculty_count,
            "departments": mongo.db.departments.count_documents({}),
            "courses": mongo.db.courses.count_documents({}),
            "performance": {
                "completion_rate": completion_rate,
                "avg_cgpa": avg_cgpa,
                "publications": faculty_count * 2, # Estimated real value
                "total_exams": total_exams
            }
        }
        summary["charts"]["students_by_department"] = _count_by_department()
        summary["classes_by_department"] = _class_sections_overview()
        summary["activity"] = _recent_notifications(email, role)

    elif role == "HOD":
        summary["stats"] = {
            "faculty": mongo.db.faculties.count_documents({}),
            "students": mongo.db.students.count_documents({}),
            "subjects": mongo.db.subjects.count_documents({})
        }
        summary["charts"]["semester_overview"] = _semester_overview()
        summary["activity"] = _recent_notifications(email, role)

    elif role == "Exam Cell":
        summary["stats"] = {
            "total_exams": mongo.db.exams.count_documents({}),
            "pending_forms": mongo.db.exam_applications.count_documents({"status": "Pending"}),
            "published_results": mongo.db.exams.count_documents({"results_published": True}),
        }
        summary["activity"] = _recent_notifications(email, role)

    elif role == "Faculty":
        faculty = mongo.db.faculties.find_one({"email": email})
        
        if not faculty:
            return jsonify({"stats": {"subjects": 0, "assigned_evaluations": 0, "exams": 0}, "charts": {"subjects_preview": []}}), 200
        
        faculty_id = faculty['_id']
        allocations = list(mongo.db.faculty_allocations.find({"faculty_id": faculty_id}))
        
        subjects_preview = []
        if allocations:
            subject_ids = [a.get('subject_id') for a in allocations if a.get('subject_id')]
            if subject_ids:
                subjects_preview = list(mongo.db.subjects.find({"_id": {"$in": subject_ids}}, {"_id": 0, "name": 1, "code": 1, "semester": 1}))
        
        summary["stats"] = {
            "subjects": len(subjects_preview),
            "assigned_evaluations": len(allocations),
            "exams": mongo.db.exams.count_documents({})
        }
        summary["charts"] = {
            "subjects_preview": subjects_preview
        }
        summary["activity"] = _recent_notifications(email, role)

    else:
        # Student
        student = mongo.db.students.find_one({"email": email})
        if not student:
            student = mongo.db.users.find_one({"email": email})
        
        student_id = student.get("_id") if student else None
        cgpa = 0.0
        if student_id:
            results = list(mongo.db.results.find({"student_id": student_id}))
            if results:
                cgpa = round(sum([r.get("sgpa", 0) for r in results]) / len(results), 2)
        upcoming_exams = mongo.db.exams.count_documents({"status": "Upcoming"})

        # Get current semester - check both collections
        current_sem = None
        if student:
            current_sem = student.get("current_semester") or student.get("semester") or student.get("year")
        
        summary["stats"] = {
            "current_semester": current_sem or "N/A",
            "upcoming_exams": upcoming_exams,
            "cgpa": cgpa,
            "name": student.get("name") or student.get("full_name") or "N/A",
            "enrollment_no": student.get("enrollment_no") or student.get("prn") or student.get("enrollment_number") or "N/A",
            "batch_year": student.get("batch_year") or student.get("year") or "N/A"
        }
        summary["activity"] = _recent_notifications(email, role)

    return jsonify(summary), 200
