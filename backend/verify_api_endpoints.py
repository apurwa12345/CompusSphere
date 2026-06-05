import requests
import json

BASE_URL = "http://127.0.0.1:5000/api"

print("[INFO] Starting API endpoint verification...")

# 1. Login as student
login_url = f"{BASE_URL}/auth/login"
login_payload = {
    "email": "s25_abdul_rahman@mgmcen.ac.in",
    "password": "password@1234"
}

try:
    print(f"[INFO] POST to {login_url}...")
    response = requests.post(login_url, json=login_payload)
    if response.status_code != 200:
        print(f"[ERROR] Login failed: HTTP {response.status_code} - {response.text}")
        exit(1)
        
    login_data = response.json()
    token = login_data.get("access_token")
    print("[SUCCESS] Login successful!")
    print(f"  Role: {login_data.get('role')}")
    print(f"  Name: {login_data.get('name')}")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 2. Get Profile
    profile_url = f"{BASE_URL}/auth/profile"
    print(f"\n[INFO] GET to {profile_url}...")
    prof_response = requests.get(profile_url, headers=headers)
    if prof_response.status_code == 200:
        prof_data = prof_response.json()
        print("[SUCCESS] Profile fetched successfully!")
        print(f"  Student ID: {prof_data.get('student_id')}")
        print(f"  PRN: {prof_data.get('prn')}")
        print(f"  Department: {prof_data.get('department')}")
        print(f"  Mobile: {prof_data.get('mobile')}")
    else:
        print(f"[ERROR] Profile failed: HTTP {prof_response.status_code} - {prof_response.text}")

    # 3. Get Dashboard Summary
    summary_url = f"{BASE_URL}/dashboard/summary"
    print(f"\n[INFO] GET to {summary_url}...")
    sum_response = requests.get(summary_url, headers=headers)
    if sum_response.status_code == 200:
        sum_data = sum_response.json()
        print("[SUCCESS] Student Dashboard Summary fetched successfully!")
        print(json.dumps(sum_data, indent=2))
    else:
        print(f"[ERROR] Dashboard Summary failed: HTTP {sum_response.status_code} - {sum_response.text}")

except Exception as e:
    print(f"[ERROR] Request failed: {e}")
