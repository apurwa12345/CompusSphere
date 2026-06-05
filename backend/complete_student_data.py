"""
Bulk update student profile data with missing fields
"""
import os
import pymongo
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

print("\n📊 Bulk updating student profile data...\n")

# Bulk update - add missing fields to all students at once
result = db.students.update_many(
    {},  # Update all documents
    [
        {
            "$set": {
                "mobile": {"$ifNull": ["$mobile", {"$ifNull": ["$phone", ""]}]},
                "phone": {"$ifNull": ["$phone", {"$ifNull": ["$mobile", ""]}]},
                "dob": {"$ifNull": ["$dob", ""]},
                "group": {"$ifNull": ["$group", "A"]},
                "abc_id": {"$ifNull": ["$abc_id", ""]},
                "updated_at": datetime.utcnow()
            }
        }
    ]
)

print(f"✅ Updated {result.modified_count} student records")
print(f"   Matched: {result.matched_count} records")

# Verify
test_student = db.students.find_one({"email": "s25_abdul_rahman@mgmcen.ac.in"})
if test_student:
    print("\n✅ Sample updated student record:")
    test_student.pop('_id', None)
    import json
    print(json.dumps(test_student, indent=2, default=str))
    
    # Check for missing fields
    required_fields = ["mobile", "phone", "dob", "group", "abc_id"]
    missing = [f for f in required_fields if not test_student.get(f)]
    if missing:
        print(f"\n⚠️  Still missing: {missing}")
    else:
        print(f"\n✅ All required fields present!")
