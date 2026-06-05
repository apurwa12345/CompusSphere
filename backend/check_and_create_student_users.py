import pymongo
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

print("[INFO] Checking user accounts for all student profiles...")

students = list(db.students.find({}, {
    "email": 1, "name": 1, "enrollment_no": 1, "department_id": 1, 
    "current_semester": 1, "batch_year": 1, "gender": 1, "roll_no": 1, "group": 1, "dob": 1, "mobile": 1
}))
print(f"[INFO] Loaded {len(students)} student profiles from the database.")

missing_accounts = []
existing_count = 0

for student in students:
    email = student.get("email")
    if not email:
        continue
    
    # Check if user exists
    user_doc = db.users.find_one({"email": email})
    if user_doc:
        existing_count += 1
    else:
        missing_accounts.append(student)

print(f"[INFO] Found {existing_count} existing student user accounts.")
print(f"[INFO] Found {len(missing_accounts)} student profiles missing user accounts.")

if missing_accounts:
    print("\n[INFO] Creating missing student user accounts with password 'password@1234'...")
    hashed_pw = generate_password_hash("password@1234", method="pbkdf2:sha256")
    
    docs_to_insert = []
    for student in missing_accounts:
        new_user = {
            "email": student.get("email").strip().lower(),
            "password": hashed_pw,
            "role": "Student",
            "name": student.get("name"),
            "mobile": student.get("mobile") or "",
            "phone": student.get("mobile") or "",
            "gender": student.get("gender") or "",
            "enrollment_number": student.get("enrollment_no") or "",
            "roll_no": student.get("roll_no") or "",
            "group": student.get("group") or "A",
            "dob": student.get("dob") or "",
            "year": student.get("batch_year") or "2025-26",
            "department_id": student.get("department_id") or ""
        }
        docs_to_insert.append(new_user)
        
    if docs_to_insert:
        result = db.users.insert_many(docs_to_insert)
        print(f"[SUCCESS] Successfully created {len(result.inserted_ids)} new student user accounts!")
else:
    print("[SUCCESS] All students already have fully functional user accounts!")

# Final check of counts
total_students = db.students.count_documents({})
total_student_users = db.users.count_documents({"role": "Student"})
print(f"\n--- Final Summary ---")
print(f"Total Student Profiles: {total_students}")
print(f"Total Student User Logins: {total_student_users}")
