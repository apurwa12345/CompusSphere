"""
Check what student profile data is missing
"""
import os
import pymongo
from dotenv import load_dotenv
import json

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

test_email = "s25_abdul_rahman@mgmcen.ac.in"

print(f"\n🔍 Checking profile data for: {test_email}\n")

# Check user data
user = db.users.find_one({"email": test_email})
if user:
    user.pop('_id', None)
    user.pop('password', None)
    print("✅ User Collection Data:")
    print(json.dumps(user, indent=2, default=str))
else:
    print("❌ User not found")

# Check student data
student = db.students.find_one({"email": test_email})
if student:
    student.pop('_id', None)
    print("\n✅ Student Collection Data:")
    print(json.dumps(student, indent=2, default=str))
else:
    print("\n❌ Student not found")

# Check what fields are expected
print("\n📋 Expected Profile Fields:")
expected = [
    "email", "name", "role", "enrollment_number", "enrollment_no", "prn",
    "department", "department_id", "year", "batch_year", "current_semester",
    "mobile", "phone", "gender", "dob", "group", "student_id", "abc_id"
]

user_keys = set(user.keys()) if user else set()
student_keys = set(student.keys()) if student else set()
all_keys = user_keys | student_keys

print(f"   Found in database: {sorted(all_keys)}")
print(f"   Missing: {sorted(set(expected) - all_keys)}")
