#!/usr/bin/env python3
"""
Utility script to create and verify system user accounts for all roles (Admin, Exam Cell, HOD, Faculty).
Sets all of their passwords to 'password@1234'.
"""
import os
import sys
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv('backend/.env')

MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("[-] MONGO_URI not found in .env")
    sys.exit(1)

client = MongoClient(MONGO_URI)
db = client["student_management"]

print("Connecting to MongoDB Atlas...")

# Hashed password for "password@1234"
hashed_password = generate_password_hash("password@1234")

# 1. Standard Role MGM Accounts to ensure exist
standard_accounts = [
    {
        "email": "admin@mgmcen.ac.in",
        "name": "System Admin (MGM)",
        "role": "Admin",
        "department": "Administration"
    },
    {
        "email": "examcell@mgmcen.ac.in",
        "name": "Exam Cell Controller (MGM)",
        "role": "Exam Cell",
        "department": "Examination Cell"
    },
    {
        "email": "hod@mgmcen.ac.in",
        "name": "Head of Department (CSE) (MGM)",
        "role": "HOD",
        "department": "Computer Science"
    }
]

print("\n--- Seeding/Syncing Standard Role Accounts ---")
for acc in standard_accounts:
    existing = db.users.find_one({"email": acc["email"]})
    user_data = {
        "email": acc["email"],
        "name": acc["name"],
        "role": acc["role"],
        "department": acc["department"],
        "password": hashed_password,
        "updated_at": datetime.datetime.now(datetime.timezone.utc)
    }
    if not existing:
        user_data["created_at"] = datetime.datetime.now(datetime.timezone.utc)
        db.users.insert_one(user_data)
        print(f"[CREATED] {acc['role']} user: {acc['email']}")
    else:
        db.users.update_one({"email": acc["email"]}, {"$set": user_data})
        print(f"[UPDATED] {acc['role']} user: {acc['email']}")

# 2. Syncing Faculty members from the 'faculties' collection
print("\n--- Syncing Faculty Accounts from 'faculties' Collection ---")
faculties = list(db.faculties.find({}))
print(f"Found {len(faculties)} faculties in the collection.")

synced_count = 0
for f in faculties:
    email = f.get("email")
    name = f.get("name", "Faculty Member")
    dept = f.get("department_id", "Computer Science")
    
    if not email:
        continue
        
    existing = db.users.find_one({"email": email})
    user_data = {
        "email": email,
        "name": name,
        "role": "Faculty",
        "department": dept,
        "password": hashed_password,
        "updated_at": datetime.datetime.now(datetime.timezone.utc)
    }
    
    if not existing:
        user_data["created_at"] = datetime.datetime.now(datetime.timezone.utc)
        db.users.insert_one(user_data)
    else:
        db.users.update_one({"email": email}, {"$set": user_data})
    
    # Also update their password inside the faculties collection to match
    db.faculties.update_one({"email": email}, {"$set": {"password": hashed_password}})
    synced_count += 1

print(f"[SUCCESS] Synced {synced_count} faculties to the 'users' login collection.")
print("\n[SUCCESS] All system role accounts are successfully seeded, updated, and synchronized!")
