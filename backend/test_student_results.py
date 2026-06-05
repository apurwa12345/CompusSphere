import pandas as pd
import requests
import json

# Read students CSV
csv_path = r"c:\Users\91997\OneDrive\Desktop\Final1\students_export.csv"
df = pd.read_csv(csv_path)

# Student index 445
idx = 445
student_row = df.iloc[idx]
email = student_row['email']
name = student_row['name']

print(f"[INFO] Student at row {idx}:")
print(f"  Name: {name}")
print(f"  Email: {email}")

# Now log in as this student
BASE_URL = "http://127.0.0.1:5000/api"
login_url = f"{BASE_URL}/auth/login"
login_payload = {
    "email": email,
    "password": "password@1234"
}

try:
    print(f"\n[INFO] Logging in as {email}...")
    response = requests.post(login_url, json=login_payload)
    if response.status_code != 200:
        print(f"[ERROR] Login failed: HTTP {response.status_code} - {response.text}")
        exit(1)
        
    login_data = response.json()
    token = login_data.get("access_token")
    print("[SUCCESS] Login successful!")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Get Profile
    profile_url = f"{BASE_URL}/auth/profile"
    prof_response = requests.get(profile_url, headers=headers)
    prof_data = prof_response.json()
    student_id = prof_data.get("student_id")
    print(f"  Verified student_id: {student_id}")

    # Get Dashboard Summary
    summary_url = f"{BASE_URL}/dashboard/summary"
    sum_response = requests.get(summary_url, headers=headers)
    sum_data = sum_response.json()
    print("\n[SUCCESS] Dashboard fetched:")
    print(f"  CGPA: {sum_data['stats']['cgpa']}")
    print(f"  Name: {sum_data['stats']['name']}")
    print(f"  PRN: {sum_data['stats']['enrollment_no']}")

except Exception as e:
    print(f"[ERROR] Request failed: {e}")
