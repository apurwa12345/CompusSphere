import requests
import json

BASE_URL = "http://localhost:5000/api"

def test_department_ops():
    # 1. Login as Admin
    print("Attempting login...")
    try:
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "verify_admin@test.com",
            "password": "verify_password123"
        })
        if login_res.status_code != 200:
            print(f"Login failed with status {login_res.status_code}: {login_res.text}")
            return
    except Exception as e:
        print(f"Connection error: {e}")
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@college.edu",
            "password": "admin123"
        })
        if login_res.status_code != 200:
            print(f"Fallback Login failed with status {login_res.status_code}: {login_res.text}")
            return
    
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("Login successful.")
    
    # 2. Create a temporary department
    print("Creating department...")
    create_res = requests.post(f"{BASE_URL}/academic/departments", headers=headers, json={
        "name": "Manual Test Department",
        "code": "MTEST"
    })
    if create_res.status_code != 201:
        print(f"Create failed: {create_res.text}")
        return
    dep_id = create_res.json().get("id")
    print(f"Created Department ID: {dep_id}")
    
    # 3. Update the department
    print("Updating department...")
    update_res = requests.put(f"{BASE_URL}/academic/departments/{dep_id}", headers=headers, json={
        "name": "Updated Manual Dept",
        "code": "MTEST_UPD"
    })
    print(f"Update status: {update_res.status_code}")
    if update_res.status_code != 200:
         print(f"Update failed: {update_res.text}")
    
    # 4. Verify update
    print("Verifying update...")
    get_res = requests.get(f"{BASE_URL}/academic/departments", headers=headers)
    departments = get_res.json()
    updated_dep = next((d for d in departments if d["_id"] == dep_id), None)
    if updated_dep and updated_dep["name"] == "Updated Manual Dept" and updated_dep["code"] == "MTEST_UPD":
        print("✅ Verification: Update Successful")
    else:
        print("❌ Verification: Update Failed")
    
    # 5. Delete the department
    print("Deleting department...")
    delete_res = requests.delete(f"{BASE_URL}/academic/departments/{dep_id}", headers=headers)
    print(f"Delete status: {delete_res.status_code}")
    
    # 6. Verify deletion
    print("Verifying deletion...")
    get_res_after = requests.get(f"{BASE_URL}/academic/departments", headers=headers)
    departments_after = get_res_after.json()
    deleted_dep = next((d for d in departments_after if d["_id"] == dep_id), None)
    if not deleted_dep:
        print("✅ Verification: Deletion Successful")
    else:
        print("❌ Verification: Deletion Failed")

if __name__ == "__main__":
    test_department_ops()
