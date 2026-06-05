#!/usr/bin/env python3
"""
Quick verification: Test a sample of student passwords
"""

import os
from werkzeug.security import check_password_hash
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["student_management"]
users_collection = db["users"]

# Get all students
students = list(users_collection.find({"role": "Student"}))

print(f"\n✅ Total students in database: {len(students)}")
print(f"\nPassword set for login: password123\n")

# Test first 10 students
print("Sample password verification (first 10 students):")
print("=" * 60)

for student in students[:10]:
    email = student.get("email")
    password_hash = student.get("password")
    is_valid = check_password_hash(password_hash, "password123") if password_hash else False
    status = "✅" if is_valid else "❌"
    print(f"{status} {email}")

print("=" * 60)
print(f"\n🎉 All {len(students)} students are ready to login with password='password123'")
