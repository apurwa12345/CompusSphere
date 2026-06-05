import requests

BASE_URL = "http://127.0.0.1:5000/api"
login_url = f"{BASE_URL}/auth/login"

test_credentials = [
    {"email": "admin@mgmcen.ac.in", "password": "password@1234", "role": "Admin"},
    {"email": "examcell@mgmcen.ac.in", "password": "password@1234", "role": "Exam Cell"},
    {"email": "hod@mgmcen.ac.in", "password": "password@1234", "role": "HOD"},
    {"email": "accountant@mgmcen.ac.in", "password": "password@1234", "role": "Accountant"},
    {"email": "accountant4@mgmcen.ac.in", "password": "password@1234", "role": "Accountant"}
]

print("[INFO] Starting verification of MGM official email authentication...")

all_ok = True
for cred in test_credentials:
    email = cred["email"]
    password = cred["password"]
    expected_role = cred["role"]
    
    payload = {"email": email, "password": password}
    try:
        response = requests.post(login_url, json=payload)
        if response.status_code == 200:
            data = response.json()
            role = data.get("role")
            if role == expected_role:
                print(f"  [SUCCESS] Auth OK for '{email}' (Returned role: '{role}')")
            else:
                print(f"  [ERROR] Auth OK for '{email}' but role mismatch: expected '{expected_role}', got '{role}'")
                all_ok = False
        else:
            print(f"  [ERROR] Auth FAILED for '{email}': HTTP {response.status_code} - {response.text}")
            all_ok = False
    except Exception as e:
        print(f"  [ERROR] Connection failed for '{email}': {e}")
        all_ok = False

if all_ok:
    print("\n[SUCCESS] All MGM official accounts verified successfully!")
else:
    print("\n[WARNING] Some MGM official accounts did not verify successfully. Please check the backend log.")
