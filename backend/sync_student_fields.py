import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")

client = MongoClient(MONGO_URI)
db = client["student_management"]

FIELDS = [
    "gender",
    "roll_no",
    "mobile",
    "phone",
    "dob",
    "group",
    "department",
    "department_id",
    "prn",
    "enrollment_number",
    "year",
    "batch_year",
    "current_semester",
]

updated = 0
scanned = 0

for user in db.users.find({"role": "Student"}, {"_id": 0, "email": 1, **{f: 1 for f in FIELDS}}):
    email = (user.get("email") or "").strip().lower()
    if not email:
        continue
    scanned += 1

    student = db.students.find_one({"email": email})
    if not student:
        continue

    updates = {}
    for field in FIELDS:
        if field in ["prn", "enrollment_number", "year", "batch_year"]:
            # Normalize aliases
            if field == "prn":
                value = user.get("enrollment_number") or user.get("prn")
            elif field == "enrollment_number":
                value = user.get("enrollment_number") or user.get("prn")
            elif field == "year":
                value = user.get("year") or user.get("batch_year")
            else:  # batch_year
                value = user.get("batch_year") or user.get("year")
        else:
            value = user.get(field)

        if value is None or value == "":
            continue

        if student.get(field) in [None, ""]:
            updates[field] = value

    # Also ensure enrollment_no exists based on prn/enrollment_number
    if student.get("enrollment_no") in [None, ""]:
        prn_value = user.get("enrollment_number") or user.get("prn")
        if prn_value:
            updates["enrollment_no"] = prn_value

    if updates:
        db.students.update_one({"email": email}, {"$set": updates})
        updated += 1

print(f"Scanned students: {scanned}")
print(f"Updated student records: {updated}")
