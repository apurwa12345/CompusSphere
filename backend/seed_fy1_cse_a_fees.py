"""
Seed fee category + college fee status for FY 1 CSE A students (first 70 CSE by roll no).
Run: python seed_fy1_cse_a_fees.py
"""
import datetime
import os
import random

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

CSE_DEPT = "COMPUTER SCIENCE & ENGINEERING(B.Tech)"
SECTION_SIZE = 70
CATEGORIES = ["General", "OBC", "SC", "ST"]
CATEGORY_FEES = {
    "GENERAL": 100000,
    "OPEN": 100000,
    "OBC": 60000,
    "SC": 10000,
    "ST": 5000,
    "EWS": 90000,
    "TFWS": 20000,
}


def fee_amount_for_category(category):
    key = (category or "").strip().upper()
    return float(CATEGORY_FEES.get(key, 100000))


def get_fy1_cse_a_students(db):
    students = list(db.students.find({"department": CSE_DEPT}))
    students.sort(key=lambda s: str(s.get("roll_no") or s.get("enrollment_no") or "").lower())
    return students[:SECTION_SIZE]


def pick_fee_status(index, total):
    """Mostly Paid / Partially Paid so Exam Cell can approve; leave a few Pending."""
    ratio = index / max(total, 1)
    if ratio < 0.5:
        return "Paid"
    if ratio < 0.85:
        return "Partially Paid"
    return "Pending"


def build_student_update(category, status):
    fees_amount = fee_amount_for_category(category)
    update = {
        "category": category,
        "fees_amount": fees_amount,
        "fee_status": status,
    }
    if status == "Paid":
        update["fees_paid"] = True
        update["fees_paid_amount"] = fees_amount
    elif status == "Partially Paid":
        paid = round(fees_amount * random.uniform(0.45, 0.85), 2)
        update["fees_paid"] = False
        update["fees_paid_amount"] = paid
    else:
        update["fees_paid"] = False
        update["fees_paid_amount"] = 0.0
    return update


def upsert_fee_submission(db, student, category, status, fees_amount, paid_amount):
    now = datetime.datetime.utcnow()
    submission = {
        "student_id": student["_id"],
        "student_name": student.get("name", ""),
        "email": student.get("email", ""),
        "category": category,
        "fees_amount": fees_amount,
        "status": status,
        "scheme_applied": "",
        "verified_at": now,
        "updated_at": now,
    }
    db.fee_submissions.update_one(
        {"student_id": student["_id"], "category": category},
        {"$set": submission, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )


def main():
    random.seed(42)
    client = MongoClient(os.environ.get("MONGO_URI"))
    db = client.get_default_database()

    students = get_fy1_cse_a_students(db)
    if not students:
        print("No CSE students found.")
        return

    stats = {"category_set": 0, "fee_updated": 0, "users_synced": 0, "submissions": 0}
    status_counts = {"Paid": 0, "Partially Paid": 0, "Pending": 0}

    for idx, student in enumerate(students):
        category = student.get("category")
        if not category:
            category = random.choice(CATEGORIES)
            stats["category_set"] += 1

        status = pick_fee_status(idx, len(students))
        update = build_student_update(category, status)
        status_counts[status] += 1

        db.students.update_one({"_id": student["_id"]}, {"$set": update})
        stats["fee_updated"] += 1

        email = student.get("email")
        if email:
            db.users.update_one(
                {"email": email},
                {"$set": {"category": category}},
            )
            stats["users_synced"] += 1

        upsert_fee_submission(
            db,
            student,
            category,
            status,
            update["fees_amount"],
            update.get("fees_paid_amount", 0),
        )
        stats["submissions"] += 1

    # Ensure pending exam applications for these students can show college fee as paid/partial
    student_ids = [s["_id"] for s in students]
    exam_fix = db.exam_applications.update_many(
        {
            "$or": [{"studentId": {"$in": student_ids}}, {"student_id": {"$in": student_ids}}],
            "status": "Pending",
            "fees_paid": {"$ne": True},
        },
        {
            "$set": {
                "fees_paid": True,
                "paymentStatus": "VERIFIED",
                "payment_verified_at": datetime.datetime.utcnow(),
            }
        },
    )

    print(f"FY 1 CSE A students processed: {len(students)}")
    print(f"Fee status mix: {status_counts}")
    print(f"Updates: {stats}")
    print(f"Exam applications exam-fee flag fixed: {exam_fix.modified_count}")


if __name__ == "__main__":
    main()
