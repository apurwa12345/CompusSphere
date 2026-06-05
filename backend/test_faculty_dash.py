import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:5000/api"

def check_faculty_dashboard():
    # 1. Login
    login_data = {
        "email": "rahul.singh@mgmcen.ac.in",
        "password": "mgm123"
    }
    print(f"Attempting login for {login_data['email']}...")
    
    req = urllib.request.Request(f"{BASE_URL}/auth/login", 
                                data=json.dumps(login_data).encode('utf-8'),
                                headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as res:
            login_res = json.loads(res.read().decode())
            token = login_res.get("access_token")
            print("Login SUCCESS. Token acquired.")
    except Exception as e:
        print(f"Login FAILED: {e}")
        return

    # 2. Fetch Dashboard Summary
    req = urllib.request.Request(f"{BASE_URL}/dashboard/summary", 
                                headers={"Authorization": f"Bearer {token}"})
    
    try:
        with urllib.request.urlopen(req) as res:
            dash_res = json.loads(res.read().decode())
            print("Dashboard Fetch SUCCESS.")
            print(json.dumps(dash_res, indent=2))
    except Exception as e:
        print(f"Dashboard Fetch FAILED: {e}")

if __name__ == "__main__":
    check_faculty_dashboard()
