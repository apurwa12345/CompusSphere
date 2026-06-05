import pymongo
import requests
import os
from dotenv import load_dotenv

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

BASE_URL = "http://127.0.0.1:5000/api"
login_url = f"{BASE_URL}/auth/login"

print("[INFO] Testing login for real student accounts that have student profiles...")

# Get 5 student profiles from the students collection
student_profiles = list(db.students.find({}, {"email": 1, "name": 1}).limit(5))

for profile in student_profiles:
    email = profile.get("email")
    name = profile.get("name")
    
    # Check if a corresponding user document exists in users collection
    user_doc = db.users.find_one({"email": email})
    if not user_doc:
        print(f"  [WARNING] No user account found in users collection for student: '{name}' ({email})")
        continue

    # Test login
    payload = {
        "email": email,
        "password": "password@1234"
    }
    
    try:
        response = requests.post(login_url, json=payload)
        if response.status_code == 200:
            print(f"  [SUCCESS] Login OK for real student '{name}' ({email})")
            
            # Fetch profile to verify profile endpoints work
            token = response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            profile_res = requests.get(f"{BASE_URL}/auth/profile", headers=headers)
            
            if profile_res.status_code == 200:
                print(f"    Profile fetch: OK")
            else:
                print(f"    [ERROR] Profile fetch failed: HTTP {profile_res.status_code}")
        else:
            print(f"  [FAILURE] Login FAILED for '{name}' ({email}) - HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print(f"  [ERROR] Network/Request failed for {email}: {e}")

print("\n[INFO] Real student login checks complete!")
