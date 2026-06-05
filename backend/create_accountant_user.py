#!/usr/bin/env python3
"""
Safe script to create an Accountant user for testing
"""
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import datetime

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("❌ MONGO_URI not found in .env")
    sys.exit(1)

client = MongoClient(MONGO_URI)
db = client["student_management"]

# Accountant user data
accountant_data = {
    "email": "accountant4@mgmcen.ac.in",
    "password": generate_password_hash("password123"),
    "role": "Accountant",
    "name": "Accountant 4",
    "department": "Finance",
    "created_at": datetime.datetime.utcnow()
}

try:
    # Check if user already exists
    existing = db.users.find_one({"email": accountant_data["email"]})
    if existing:
        print(f"⚠️  Accountant user already exists with email: {accountant_data['email']}")
        print(f"   MongoDB ID: {existing['_id']}")
    else:
        # Insert the new accountant user
        result = db.users.insert_one(accountant_data)
        print(f"✅ Accountant user created successfully!")
        print(f"   Email: {accountant_data['email']}")
        print(f"   Password: password123")
        print(f"   MongoDB ID: {result.inserted_id}")
        print(f"\n📝 Login with these credentials to test the accountant dashboard.")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
