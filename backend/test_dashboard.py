"""
Test the dashboard endpoint for students
"""
import requests
import json

# Get token from login
print("🔐 Testing dashboard login...\n")
login_response = requests.post(
    "http://localhost:5000/api/auth/login",
    json={
        "email": "s25_abdul_rahman@mgmcen.ac.in",
        "password": "password123"
    }
)

if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    print("✅ Login successful!\n")
    
    # Test dashboard endpoint
    print("📊 Testing dashboard endpoint...\n")
    dashboard_response = requests.get(
        "http://localhost:5000/api/dashboard/summary",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if dashboard_response.status_code == 200:
        dashboard = dashboard_response.json()
        print("✅ Dashboard data retrieved!")
        print(json.dumps(dashboard, indent=2, default=str))
        
        # Check for current_semester
        if "stats" in dashboard and "current_semester" in dashboard["stats"]:
            semester = dashboard["stats"]["current_semester"]
            if semester != "N/A" and semester is not None:
                print(f"\n✅ Current Semester: {semester}")
            else:
                print(f"\n⚠️  Current Semester value: {semester}")
        else:
            print("\n❌ Current Semester not found in dashboard stats")
    else:
        print(f"❌ Dashboard error: {dashboard_response.status_code}")
        print(dashboard_response.json())
else:
    print(f"❌ Login failed: {login_response.status_code}")
    print(login_response.json())
