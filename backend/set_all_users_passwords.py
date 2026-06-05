#!/usr/bin/env python3
"""
Set all user passwords to 'password@1234' in the student_management database
"""

import os
import sys
from werkzeug.security import generate_password_hash
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables from the backend/.env file
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, '.env')
load_dotenv(env_path)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("Error: MONGO_URI not found in environment!")
    sys.exit(1)

DB_NAME = "student_management"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
users_collection = db["users"]

PASSWORD = "password@1234"
PASSWORD_HASH = generate_password_hash(PASSWORD)

print(f"Database: {DB_NAME}")
print(f"Target Password: {PASSWORD}")
print("-" * 60)

try:
    # Find all users
    total_users = users_collection.count_documents({})
    print(f"Found {total_users} total users in database.")
    
    if total_users == 0:
        print("Error: No users found in the database!")
        sys.exit(1)
        
    # Update passwords for ALL users
    result = users_collection.update_many(
        {},
        {"$set": {"password": PASSWORD_HASH}}
    )
    
    print(f"Successfully matched: {result.matched_count} users")
    print(f"Successfully updated: {result.modified_count} users")
    print("-" * 60)
    print("Success: All user passwords have been updated to 'password@1234'")

except Exception as e:
    print(f"Error occurred: {str(e)}")
    sys.exit(1)
