"""
Test login credentials and verify mongo setup
"""
import os
import pymongo
from dotenv import load_dotenv
from werkzeug.security import check_password_hash

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

test_email = "s25_abdul_rahman@mgmcen.ac.in"
test_password = "password123"

print(f"\n🔎 Testing login for: {test_email}")
print(f"Password: {test_password}\n")

# Check if user exists
user = db.users.find_one({"email": test_email})
if not user:
    print(f"❌ User NOT found in database!")
else:
    print(f"✅ User found in database")
    print(f"   Name: {user.get('name')}")
    print(f"   Role: {user.get('role')}")
    print(f"   Password hash: {user['password'][:50]}...")
    
    # Test password
    try:
        match = check_password_hash(user['password'], test_password)
        if match:
            print(f"✅ Password matches!")
        else:
            print(f"❌ Password DOES NOT match!")
    except Exception as e:
        print(f"❌ Error checking password: {e}")

# Check if student record exists
student = db.students.find_one({"email": test_email})
if not student:
    print(f"\n❌ Student record NOT found in students collection!")
else:
    print(f"\n✅ Student record found")
    print(f"   Name: {student.get('name')}")
    print(f"   Enrollment: {student.get('enrollment_no')}")

# List all collections
print("\n📚 Collections in database:")
collections = db.list_collection_names()
for col in collections:
    count = db[col].count_documents({})
    print(f"   - {col}: {count} documents")
