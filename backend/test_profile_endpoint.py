"""
Test the profile endpoint
"""
import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

# Test login first
print("🔐 Testing login...\n")
response = requests.post(
    "http://localhost:5000/api/auth/login",
    json={
        "email": "s25_abdul_rahman@mgmcen.ac.in",
        "password": "password123"
    }
)

if response.status_code == 200:
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Login successful!")
    print(f"   Role: {data.get('role')}")
    print(f"   Name: {data.get('name')}\n")
    
    # Test profile endpoint
    print("👤 Testing profile endpoint...\n")
    profile_response = requests.get(
        "http://localhost:5000/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if profile_response.status_code == 200:
        profile = profile_response.json()
        print("✅ Profile data retrieved!")
        print(json.dumps(profile, indent=2, default=str))
        
        # Check required fields
        required = ["email", "name", "role", "prn", "enrollment_no", "batch_year", 
                   "current_semester", "department_id", "mobile", "phone", "dob", "group"]
        missing = [f for f in required if f not in profile or profile[f] is None]
        if missing:
            print(f"\n⚠️  Fields still missing: {missing}")
        else:
            print(f"\n✅ All required fields present!")
    else:
        print(f"❌ Profile error: {profile_response.status_code}")
        print(profile_response.json())
else:
    print(f"❌ Login failed: {response.status_code}")
    print(response.json())
