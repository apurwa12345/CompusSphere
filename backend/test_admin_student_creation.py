"""
Test script for admin student creation endpoint
Tests creating a complete student record with all data keys
"""
import requests
import json

BASE_URL = "http://localhost:5000/api"

# Admin credentials (update with your admin account)
ADMIN_LOGIN = {
    "email": "admin@mgmcen.ac.in",
    "password": "Admin@123"
}

# Test student data with all keys
TEST_STUDENT = {
    "name": "Test Student Zero",
    "email": "s99_test_student@mgmcen.ac.in",
    "enrollment_no": "99TEST001",
    "department_id": "CSE",
    "class_name": "FY 1 A (CSE)",
    "current_semester": 1,
    "batch_year": "2025",
    "roll_no": "999",
    "mobile": "9876543210",
    "gender": "Male",
    "dob": "2005-01-15",
    "group": "A",
    "password": "TestPass@123"
}

def test_admin_student_creation():
    print("\n" + "="*60)
    print("Testing Admin Student Creation Endpoint")
    print("="*60)
    
    # Step 1: Login as admin
    print("\n[STEP 1] Authenticating as admin...")
    login_url = f"{BASE_URL}/auth/login"
    login_response = requests.post(login_url, json=ADMIN_LOGIN)
    
    if login_response.status_code != 200:
        print(f"❌ Admin login failed: {login_response.status_code}")
        print(f"   Response: {login_response.text}")
        return False
    
    admin_token = login_response.json().get('access_token')
    print(f"✅ Admin authenticated successfully")
    print(f"   Token: {admin_token[:20]}...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 2: Create student with all data keys
    print(f"\n[STEP 2] Creating student with all data keys...")
    create_url = f"{BASE_URL}/academic/admin/students"
    
    print(f"   Endpoint: POST {create_url}")
    print(f"   Payload: {json.dumps(TEST_STUDENT, indent=2)}")
    
    create_response = requests.post(create_url, json=TEST_STUDENT, headers=headers)
    
    if create_response.status_code not in [200, 201]:
        print(f"❌ Student creation failed: {create_response.status_code}")
        print(f"   Response: {create_response.text}")
        return False
    
    result = create_response.json()
    print(f"✅ Student created successfully!")
    print(f"   User ID: {result.get('user_id')}")
    print(f"   Student ID: {result.get('student_id')}")
    print(f"   Email: {result.get('email')}")
    print(f"   Enrollment: {result.get('enrollment_no')}")
    print(f"   Temporary Password: {result.get('temporary_password')}")
    
    # Step 3: Verify student was created in both collections
    print(f"\n[STEP 3] Verifying student in database...")
    
    # Get students list
    students_url = f"{BASE_URL}/academic/students"
    students_response = requests.get(students_url, headers=headers)
    
    if students_response.status_code == 200:
        students = students_response.json()
        created_student = next((s for s in students if s.get('email') == TEST_STUDENT['email']), None)
        
        if created_student:
            print(f"✅ Student found in academic/students list")
            print(f"   Name: {created_student.get('name')}")
            print(f"   Email: {created_student.get('email')}")
            print(f"   Enrollment: {created_student.get('enrollment_no')}")
            print(f"   Class: {created_student.get('class_name')}")
            print(f"   Semester: {created_student.get('current_semester')}")
            print(f"   All data keys in student:")
            for key in sorted(created_student.keys()):
                if key not in ['_id']:
                    print(f"      - {key}: {created_student[key]}")
        else:
            print(f"❌ Student not found in academic/students list")
            return False
    else:
        print(f"❌ Failed to fetch students: {students_response.status_code}")
    
    # Step 4: Try to login with the created student account
    print(f"\n[STEP 4] Testing student login with new credentials...")
    
    student_login = {
        "email": TEST_STUDENT['email'],
        "password": TEST_STUDENT['password']
    }
    
    student_login_response = requests.post(login_url, json=student_login)
    
    if student_login_response.status_code == 200:
        student_token = student_login_response.json().get('access_token')
        print(f"✅ Student login successful!")
        print(f"   Token: {student_token[:20]}...")
        
        # Get student's own profile
        profile_url = f"{BASE_URL}/auth/profile"
        student_headers = {"Authorization": f"Bearer {student_token}"}
        profile_response = requests.get(profile_url, headers=student_headers)
        
        if profile_response.status_code == 200:
            profile = profile_response.json()
            print(f"✅ Student profile retrieved successfully!")
            print(f"   Profile keys:")
            for key in sorted(profile.keys()):
                if key not in ['_id', 'password']:
                    print(f"      - {key}: {profile[key]}")
        else:
            print(f"❌ Failed to get student profile: {profile_response.status_code}")
    else:
        print(f"❌ Student login failed: {student_login_response.status_code}")
        print(f"   Response: {student_login_response.text}")
        return False
    
    print("\n" + "="*60)
    print("✅ All tests passed!")
    print("="*60 + "\n")
    return True

if __name__ == "__main__":
    success = test_admin_student_creation()
    exit(0 if success else 1)
