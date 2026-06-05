#!/usr/bin/env python3
"""
Set all student passwords to 'password123' for testing purposes
"""

import os
import sys
from werkzeug.security import generate_password_hash
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "student_management"

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
users_collection = db["users"]

# Password to set
PASSWORD = "password123"
PASSWORD_HASH = generate_password_hash(PASSWORD, method="pbkdf2:sha256")

print(f"Generated password hash: {PASSWORD_HASH}")
print(f"Database: {DB_NAME}")
print("=" * 80)

try:
    # Get all students
    students = list(users_collection.find({"role": "Student"}))
    
    if not students:
        print("❌ No students found in the database!")
        sys.exit(1)
    
    print(f"Found {len(students)} students")
    print("=" * 80)
    
    # Update all student passwords
    result = users_collection.update_many(
        {"role": "Student"},
        {"$set": {"password": PASSWORD_HASH}}
    )
    
    print(f"✅ Updated {result.modified_count} student passwords")
    print("=" * 80)
    
    # Verify by checking a few students
    print("\nVerifying password update for sample students:")
    sample_students = users_collection.find({"role": "Student"}).limit(5)
    
    for student in sample_students:
        email = student.get("email", "N/A")
        password_hash = student.get("password", "N/A")
        print(f"\n📧 {email}")
        print(f"   Password Hash: {password_hash[:50]}..." if password_hash != "N/A" else "   Password Hash: N/A")
    
    print("\n" + "=" * 80)
    print("✅ All student passwords have been set to 'password123'")
    print(f"Total students updated: {result.modified_count}")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)
