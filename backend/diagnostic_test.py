#!/usr/bin/env python3
"""
Diagnostic test script to verify database, API connectivity, and JWT auth flow for all 5 roles.
"""
import os
import sys
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("[-] MONGO_URI not found in .env")
    sys.exit(1)

print("=" * 80)
print("SYSTEM DIAGNOSTICS & INTEGRITY VERIFICATION")
print("=" * 80)

# 1. Test Database Connectivity and Stats
try:
    client = MongoClient(MONGO_URI)
    db = client["student_management"]
    
    print("\n[1] DATABASE INTEGRITY CHECK:")
    print("---------------------------------------------")
    print(f"Server Version: {client.server_info().get('version')}")
    print(f"Connected to Cluster: {MONGO_URI.split('@')[-1].split('/')[0]}")
    
    collections = ['users', 'students', 'faculties', 'departments', 'subjects']
    for coll in collections:
        count = db[coll].count_documents({})
        print(f" -> Collection '{coll:12}' contains: {count} documents")
        
except Exception as e:
    print(f"[-] Database Error: {e}")
    sys.exit(1)

# 2. Test Server and Auth APIs
print("\n[2] AUTHENTICATION & PORTAL API CHECK:")
print("---------------------------------------------")

API_BASE = "http://127.0.0.1:5000/api"

logins = {
    'Admin': 'admin@mgmcen.ac.in',
    'Exam Cell': 'examcell@mgmcen.ac.in',
    'Faculty': 'sanjay.gupta@mgmcen.ac.in',
    'Student': 's25_abdul_rahman@mgmcen.ac.in',
    'Accountant': 'accountant4@mgmcen.ac.in'
}

all_passed = True

for role, email in logins.items():
    print(f"\nTesting Login flow for role: [{role}]")
    print(f"   Email: {email}")
    
    # Call Login Endpoint
    login_payload = {"email": email, "password": "password@1234"}
    try:
        login_res = requests.post(f"{API_BASE}/auth/login", json=login_payload)
        if login_res.status_code == 200:
            print(f"   [OK] Login API responded: 200 SUCCESS")
            token_data = login_res.json()
            token = token_data.get("access_token")
            returned_role = token_data.get("role")
            user_name = token_data.get("name")
            print(f"   [OK] Logged in as: '{user_name}' (Role in response: {returned_role})")
            
            # Call Profile Endpoint with JWT token
            headers = {"Authorization": f"Bearer {token}"}
            profile_res = requests.get(f"{API_BASE}/auth/profile", headers=headers)
            if profile_res.status_code == 200:
                print(f"   [OK] Profile GET responded: 200 SUCCESS")
                profile_data = profile_res.json()
                print(f"   [OK] Profile name from JWT: '{profile_data.get('name')}'")
            else:
                print(f"   [-] Profile GET failed: {profile_res.status_code} - {profile_res.text}")
                all_passed = False
        else:
            print(f"   [-] Login API failed: {login_res.status_code} - {login_res.text}")
            all_passed = False
            
    except Exception as e:
        print(f"   [-] API Connection failed: {e}")
        all_passed = False

print("\n" + "=" * 80)
if all_passed:
    print("SUCCESS: ALL 5 ROLES WORKED PERFECTLY!")
    print("   Database is synchronized, backend is responsive, and passwords are set.")
else:
    print("FAILURE: SOME TESTS FAILED. Please review output logs.")
print("=" * 80)
