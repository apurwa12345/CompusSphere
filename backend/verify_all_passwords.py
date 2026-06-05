#!/usr/bin/env python3
"""
Verify that all student passwords are set correctly to 'password123'
"""

import os
import sys
from werkzeug.security import check_password_hash
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

PASSWORD_TO_CHECK = "password123"

print("=" * 80)
print("VERIFYING STUDENT PASSWORDS")
print("=" * 80)

try:
    # Get all students
    students = list(users_collection.find({"role": "Student"}))
    
    if not students:
        print("❌ No students found in the database!")
        sys.exit(1)
    
    print(f"\nTotal students: {len(students)}")
    
    # Check passwords for a sample of students
    print("\nTesting password verification on sample students:\n")
    
    successful = 0
    failed = 0
    
    for i, student in enumerate(students[:20]):  # Test first 20 students
        email = student.get("email", "N/A")
        password_hash = student.get("password", None)
        
        if password_hash:
            is_valid = check_password_hash(password_hash, PASSWORD_TO_CHECK)
            status = "✅ PASS" if is_valid else "❌ FAIL"
            successful += 1 if is_valid else 0
            failed += 0 if is_valid else 1
            print(f"{status} - {email}")
        else:
            print(f"❌ NO HASH - {email}")
            failed += 1
    
    print(f"\n{'=' * 80}")
    print(f"Sample Test Results: {successful} passed, {failed} failed out of 20 students")
    
    # Check all students
    print(f"\nChecking all {len(students)} students...")
    all_pass = 0
    all_fail = 0
    
    for student in students:
        password_hash = student.get("password", None)
        if password_hash and check_password_hash(password_hash, PASSWORD_TO_CHECK):
            all_pass += 1
        else:
            all_fail += 1
    
    print(f"\n{'=' * 80}")
    print(f"FINAL VERIFICATION RESULTS:")
    print(f"✅ Correct passwords: {all_pass}/{len(students)}")
    print(f"❌ Incorrect/missing: {all_fail}/{len(students)}")
    print(f"{'=' * 80}")
    
    if all_fail == 0:
        print("\n🎉 SUCCESS! All {0} students can login with password='password123'".format(len(students)))
    else:
        print(f"\n⚠️  WARNING: {all_fail} students have incorrect passwords")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
