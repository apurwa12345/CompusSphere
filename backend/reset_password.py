"""
Reset student password with correct hashing
"""
import os
import pymongo
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

test_email = "s25_abdul_rahman@mgmcen.ac.in"
test_password = "password123"

# Generate hash using pbkdf2:sha256 with 1000000 iterations
hashed_pw = generate_password_hash(test_password, method="pbkdf2:sha256", salt_length=16)

print(f"Generated hash: {hashed_pw[:50]}...")

# Update in database
result = db.users.update_one(
    {"email": test_email},
    {"$set": {"password": hashed_pw}}
)

print(f"Updated {result.modified_count} document(s)")

# Verify it works
user = db.users.find_one({"email": test_email})
if user:
    match = check_password_hash(user['password'], test_password)
    if match:
        print(f"✅ Password reset successful! Login works now.")
    else:
        print(f"❌ Password still doesn't match")
