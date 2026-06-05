import pymongo
import requests
import json
import os
from dotenv import load_dotenv

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

BASE_URL = "http://127.0.0.1:5000/api"
login_url = f"{BASE_URL}/auth/login"

print("[INFO] Starting Exam Cell API endpoint verification...")

# 1. Login as Exam Cell Controller
login_payload = {
    "email": "examcell@mgmcen.ac.in",
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
    print("[SUCCESS] Exam Cell login successful!")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 2. Fetch Exam Cell Dashboard Summary
    summary_url = f"{BASE_URL}/dashboard/summary"
    print(f"\n[INFO] GET to {summary_url}...")
    sum_response = requests.get(summary_url, headers=headers)
    if sum_response.status_code == 200:
        sum_data = sum_response.json()
        print("[SUCCESS] Exam Cell Dashboard Summary fetched successfully!")
        print(json.dumps(sum_data, indent=2))
    else:
        print(f"[ERROR] Dashboard Summary failed: HTTP {sum_response.status_code} - {sum_response.text}")

    # 3. Find an active exam_id in the database to test the exam forms list
    exam_doc = db.exams.find_one({})
    if exam_doc:
        exam_id = str(exam_doc["_id"])
        exam_name = exam_doc.get("name", "Unknown Exam")
        print(f"\n[INFO] Found active exam in DB: '{exam_name}' (ID: {exam_id})")
        
        # 4. Fetch exam applications list
        forms_url = f"{BASE_URL}/exam-forms/exam/{exam_id}"
        print(f"[INFO] GET to {forms_url}...")
        forms_response = requests.get(forms_url, headers=headers)
        if forms_response.status_code == 200:
            forms_data = forms_response.json()
            print(f"[SUCCESS] Fetched {len(forms_data)} exam applications successfully!")
            if forms_data:
                print("[INFO] Sample application details:")
                sample = forms_data[0]
                print(f"  Student Name: {sample.get('student_name')}")
                print(f"  Enrollment No: {sample.get('enrollment_no')}")
                print(f"  Payment Status: {sample.get('paymentStatus')}")
                print(f"  UTR: {sample.get('UTR')}")
                print(f"  College Fee Status: {sample.get('college_fee_status')}")
            else:
                print("  No applications submitted yet for this exam.")
        else:
            print(f"[ERROR] Fetching exam applications failed: HTTP {forms_response.status_code} - {forms_response.text}")
    else:
        print("\n[WARNING] No exams found in the database to test the exam applications endpoint.")

except Exception as e:
    print(f"[ERROR] Request failed: {e}")
