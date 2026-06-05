"""
Quick script to update a student's password for testing
"""
import os
import pymongo
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

# Update test student
test_email = "s25_abdul_rahman@mgmcen.ac.in"
test_password = "password123"

hashed_pw = generate_password_hash(test_password, method="pbkdf2:sha256")

result = db.users.update_one(
    {"email": test_email},
    {"$set": {"password": hashed_pw}},
    upsert=True
)

if result.matched_count > 0:
    print(f"✅ Updated password for {test_email}")
else:
    # If user doesn't exist, create it
    user_data = db.students.find_one({"email": test_email})
    if user_data:
        new_user = {
            "email": test_email,
            "password": hashed_pw,
            "role": "Student",
            "name": user_data.get("name"),
            "enrollment_number": user_data.get("enrollment_no"),
            "department": user_data.get("department_id"),
            "year": user_data.get("batch_year")
        }
        db.users.insert_one(new_user)
        print(f"✅ Created user account for {test_email} with password: {test_password}")
    else:
        print(f"❌ Student {test_email} not found")
