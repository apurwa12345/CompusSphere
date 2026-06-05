"""
Hall ticket generation endpoints.
Builds a print-ready university-format hall ticket, stores the PDF path,
and exposes preview/download flows for students and exam cell staff.
"""
import datetime
import os

from bson.objectid import ObjectId
from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename

from app import mongo
from app.utils.decorators import role_required
from app.utils.helpers import create_hall_ticket_pdf
from app.utils.logger import log_audit

hall_ticket_bp = Blueprint("hall_ticket", __name__)

UNIVERSITY_NAME = "MGM's College Of Engineering Nanded"
HEADER_SUBTITLE = "( AN AUTONOMOUS INSTITUTE )"
COLLEGE_NAME = "MGM's College Of Engineering Nanded"
DEFAULT_CENTER = "02127 - MGM's College of Engineering Nanded/Nanded"
DEFAULT_MEDIUM = "English"
DEFAULT_SIGNATURES = ["College Stamp", "Principal Sign", "Eligible Student"]
DEFAULT_INSTRUCTIONS = [
    "Examination Hall Ticket will be considered valid only if signed by the competent authority.",
    "Possession of papers, books, notes, mobile phones or any electronic devices inside the examination hall is strictly prohibited.",
    "Report to the examination center at least 10 minutes before the scheduled commencement of the examination.",
]


def _to_object_id(value):
    if isinstance(value, ObjectId):
        return value
    return ObjectId(value)


def _identity_email():
    identity = get_jwt_identity()
    return identity["email"] if isinstance(identity, dict) else identity


def _resolve_student(application):
    student_id = application.get("student_id") or application.get("studentId")
    return mongo.db.students.find_one({"_id": _to_object_id(student_id)}) if student_id else None


def _resolve_course(student):
    course_id = student.get("course_id")
    if not course_id:
        return None
    try:
        return mongo.db.courses.find_one({"_id": _to_object_id(course_id)})
    except Exception:
        return mongo.db.courses.find_one({"_id": course_id})


def _resolve_eligibility(exam_id, student, fees_paid):
    saved = mongo.db.eligibility.find_one({
        "exam_id": _to_object_id(exam_id),
        "student_id": student["_id"],
    })
    if saved:
        return bool(saved.get("eligible")), saved.get("remarks", "")
    eligible = fees_paid
    message = "" if eligible else "Fee criteria not satisfied."
    return eligible, message


def _build_subjects(application, exam, student):
    student_class_value = (student.get("group") or student.get("class_value") or "").strip()
    subjects = []
    for subject_ref in application.get("subjects", []):
        subject_oid = _to_object_id(subject_ref)
        subject = mongo.db.subjects.find_one({"_id": subject_oid})
        timetable_query = {"exam_id": exam["_id"], "subject_id": subject_oid}
        if student_class_value:
            timetable_query["class_value"] = student_class_value
        timetable = mongo.db.timetable.find_one(timetable_query)
        if subject:
            exam_time = ""
            if timetable:
                start_time = timetable.get("start_time", "")
                end_time = timetable.get("end_time", "")
                exam_time = f"{start_time} To {end_time}".strip(" To")
            subjects.append({
                "subject_code": subject.get("code", ""),
                "subject_name": subject.get("name", ""),
                "exam_date": timetable.get("date", "") if timetable else "",
                "exam_time": exam_time,
            })

    if subjects:
        return subjects

    for entry in exam.get("timetable", []):
        subject_id = entry.get("subject_id")
        if not subject_id:
            continue
        subject = mongo.db.subjects.find_one({"_id": _to_object_id(subject_id)})
        if subject:
            if student_class_value and (entry.get("class_value") or "").strip() not in ("", student_class_value):
                continue
            subjects.append({
                "subject_code": subject.get("code", ""),
                "subject_name": subject.get("name", ""),
                "exam_date": entry.get("date", ""),
                "exam_time": entry.get("time", ""),
            })
    return subjects


def _build_hall_ticket_payload(application, student, exam):
    course = _resolve_course(student) or {}
    seat_info = mongo.db.seating.find_one({"exam_id": exam["_id"], "student_id": student["_id"]}) or {}
    fees_paid = bool(application.get("fees_paid", student.get("fees_paid", False)))
    eligible, eligibility_remark = _resolve_eligibility(exam["_id"], student, fees_paid)
    approved = application.get("status") == "Approved"
    subjects = _build_subjects(application, exam, student)

    degree_name = course.get("name") or "Bachelor of Technology"
    semester = student.get("current_semester") or exam.get("semester") or ""
    hall_ticket_number = application.get("hall_ticket_number") or f"HT-{str(application['_id'])[-6:].upper()}-{student.get('enrollment_no', '')}"

    reasons = []
    if not approved:
        reasons.append("Exam form is not approved.")
    if not eligible:
        reasons.append(eligibility_remark or "Eligibility status is not ELIGIBLE.")
    if not fees_paid:
        reasons.append("Exam fees are not marked as paid.")
    if not subjects:
        reasons.append("Exam timetable is not available for the selected subjects.")

    logo_path = os.path.abspath(
        os.path.join(current_app.root_path, "..", "..", "frontend", "src", "assets", "logo.png")
    )

    prn_value = student.get("prn") or student.get("enrollment_no") or ""

    return {
        "application_id": str(application["_id"]),
        "hall_ticket_number": hall_ticket_number,
        "hall_ticket_id": str(application["_id"]),
        "is_allowed": len(reasons) == 0,
        "warnings": reasons,
        "university_name": UNIVERSITY_NAME,
        "header_subtitle": HEADER_SUBTITLE,
        "college_name": COLLEGE_NAME,
        "degree_semester": f"{degree_name} - SEMESTER - {semester}",
        "medium": student.get("medium") or DEFAULT_MEDIUM,
        "student_name": student.get("name", ""),
        "prn": prn_value,
        "seat_number": prn_value,
        "phone_number": student.get("phone_no") or student.get("phone") or student.get("mobile") or "",
        "email_id": student.get("email", ""),
        "exam_center": seat_info.get("room") or exam.get("exam_center") or DEFAULT_CENTER,
        "student_photo_url": student.get("photo_url") or student.get("student_photo_url") or student.get("profile_photo_url") or "",
        "subjects": subjects,
        "instructions": DEFAULT_INSTRUCTIONS,
        "signature_labels": DEFAULT_SIGNATURES,
        "college_logo_path": logo_path,
        "status": application.get("status"),
        "fees_paid": fees_paid,
        "eligible": eligible,
        "pdf_path": application.get("hall_ticket_pdf_path"),
        "download_url": application.get("hall_ticket_url"),
        "preview_url": f"/api/hall-ticket/preview/{application['_id']}",
        "generated_at": application.get("hall_ticket_generated_at"),
    }


def _generate_and_store_pdf(application, payload):
    storage_dir = os.path.abspath(os.path.join(current_app.root_path, "..", "..", "generated", "hall_tickets"))
    os.makedirs(storage_dir, exist_ok=True)
    filename = secure_filename(f"{payload['hall_ticket_number']}.pdf")
    pdf_path = os.path.join(storage_dir, filename)
    create_hall_ticket_pdf(payload, pdf_path)

    hall_ticket_url = f"/api/hall-ticket/download/{application['_id']}"
    mongo.db.exam_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {
            "hall_ticket_generated": True,
            "hall_ticket_generated_at": datetime.datetime.utcnow(),
            "hall_ticket_number": payload["hall_ticket_number"],
            "hall_ticket_pdf_path": pdf_path,
            "hall_ticket_url": hall_ticket_url,
        }},
    )
    payload["pdf_path"] = pdf_path
    payload["download_url"] = hall_ticket_url
    return payload


def _application_by_id(application_id):
    return mongo.db.exam_applications.find_one({"_id": _to_object_id(application_id)})


def _ensure_access(application):
    email = _identity_email()
    student = mongo.db.students.find_one({"email": email})
    role_user = mongo.db.users.find_one({"email": email}) or {}
    if role_user.get("role") in {"Exam Cell", "Admin"}:
        return True
    if not student:
        return False
    student_id = application.get("student_id") or application.get("studentId")
    return str(student["_id"]) == str(student_id)


@hall_ticket_bp.route("/student", methods=["GET"])
@role_required(["Student"])
def list_student_hall_tickets():
    email = _identity_email()
    student = mongo.db.students.find_one({"email": email})
    if not student:
        return jsonify({"message": "Student not found"}), 404

    applications = list(mongo.db.exam_applications.find({
        "$or": [{"student_id": student["_id"]}, {"studentId": student["_id"]}],
    }).sort("createdAt", -1))

    result = []
    for application in applications:
        exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
        if not exam:
            continue
        payload = _build_hall_ticket_payload(application, student, exam)
        payload["exam_id"] = str(exam["_id"])
        payload["exam_name"] = exam.get("name", "")
        result.append(payload)
    return jsonify(result), 200


@hall_ticket_bp.route("/preview/<application_id>", methods=["GET"])
@role_required(["Student", "Exam Cell", "Admin"])
def preview_hall_ticket(application_id):
    application = _application_by_id(application_id)
    if not application:
        return jsonify({"message": "Application not found"}), 404
    if not _ensure_access(application):
        return jsonify({"message": "Unauthorized"}), 403

    student = _resolve_student(application)
    exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
    if not student or not exam:
        return jsonify({"message": "Student or exam data missing"}), 404

    payload = _build_hall_ticket_payload(application, student, exam)
    return jsonify(payload), 200


@hall_ticket_bp.route("/generate/<application_id>", methods=["POST"])
@role_required(["Student", "Exam Cell", "Admin"])
def generate_hall_ticket(application_id):
    application = _application_by_id(application_id)
    if not application:
        return jsonify({"message": "Application not found"}), 404
    if not _ensure_access(application):
        return jsonify({"message": "Unauthorized"}), 403

    student = _resolve_student(application)
    exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
    if not student or not exam:
        return jsonify({"message": "Student or exam data missing"}), 404

    payload = _build_hall_ticket_payload(application, student, exam)
    if not payload["is_allowed"]:
        return jsonify({
            "message": "Hall ticket cannot be generated.",
            "warnings": payload["warnings"],
            "is_allowed": False,
        }), 403

    payload = _generate_and_store_pdf(application, payload)
    log_audit("HALL_TICKET_GENERATED", {"application_id": application_id, "student_id": str(student["_id"])})
    return jsonify({
        "message": "Hall ticket generated successfully.",
        "is_allowed": True,
        "download_url": payload["download_url"],
        "pdf_path": payload["pdf_path"],
        "hall_ticket_number": payload["hall_ticket_number"],
    }), 200


@hall_ticket_bp.route("/download/<application_id>", methods=["GET"])
@role_required(["Student", "Exam Cell", "Admin"])
def download_hall_ticket(application_id):
    application = _application_by_id(application_id)
    if not application:
        return jsonify({"message": "Application not found"}), 404
    if not _ensure_access(application):
        return jsonify({"message": "Unauthorized"}), 403

    student = _resolve_student(application)
    exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
    if not student or not exam:
        return jsonify({"message": "Student or exam data missing"}), 404

    payload = _build_hall_ticket_payload(application, student, exam)
    if not payload["is_allowed"]:
        return jsonify({"message": "Hall ticket is not available.", "warnings": payload["warnings"]}), 403

    pdf_path = application.get("hall_ticket_pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        payload = _generate_and_store_pdf(application, payload)
        pdf_path = payload["pdf_path"]

    log_audit("HALL_TICKET_DOWNLOAD", {"application_id": application_id, "student_id": str(student["_id"])})
    return send_file(pdf_path, as_attachment=True, download_name=f"{payload['hall_ticket_number']}.pdf")


@hall_ticket_bp.route("/check/<exam_id>", methods=["GET"])
@role_required(["Student"])
def check_hall_ticket_availability(exam_id):
    email = _identity_email()
    student = mongo.db.students.find_one({"email": email})
    if not student:
        return jsonify({"message": "Student not found"}), 404

    application = mongo.db.exam_applications.find_one({
        "exam_id": _to_object_id(exam_id),
        "$or": [{"student_id": student["_id"]}, {"studentId": student["_id"]}],
    })
    if not application:
        return jsonify({"available": False, "message": "No application found"}), 200

    exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
    payload = _build_hall_ticket_payload(application, student, exam) if exam else {"is_allowed": False, "warnings": ["Exam not found."]}
    return jsonify({
        "available": payload.get("is_allowed", False),
        "application_id": str(application["_id"]),
        "status": application.get("status"),
        "fees_paid": payload.get("fees_paid", False),
        "hall_ticket_generated": bool(application.get("hall_ticket_pdf_path")),
        "warnings": payload.get("warnings", []),
        "download_url": application.get("hall_ticket_url") or f"/api/hall-ticket/download/{application['_id']}",
    }), 200


@hall_ticket_bp.route("/bulk-mark-generated", methods=["POST"])
@role_required(["Exam Cell", "Admin"])
def bulk_mark_generated():
    data = request.get_json() or {}
    ids = data.get("application_ids", [])
    if not ids:
        return jsonify({"message": "No application IDs provided"}), 400

    generated = 0
    failed = []
    for application_id in ids:
        application = _application_by_id(application_id)
        if not application:
            failed.append({"application_id": application_id, "reason": "Application not found"})
            continue
        student = _resolve_student(application)
        exam = mongo.db.exams.find_one({"_id": application["exam_id"]})
        if not student or not exam:
            failed.append({"application_id": application_id, "reason": "Student or exam data missing"})
            continue
        payload = _build_hall_ticket_payload(application, student, exam)
        if not payload["is_allowed"]:
            failed.append({"application_id": application_id, "reason": ", ".join(payload["warnings"])})
            continue
        _generate_and_store_pdf(application, payload)
        generated += 1

    log_audit("HALL_TICKET_BULK_GENERATED", {"count": generated})
    return jsonify({
        "message": f"{generated} hall tickets generated.",
        "generated_count": generated,
        "failed": failed,
    }), 200
