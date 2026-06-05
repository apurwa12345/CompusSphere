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

print("[INFO] Loading sample users for each role from the database...")

# Get distinct roles in users collection
roles = db.users.distinct("role")
print(f"[INFO] Found roles: {roles}")

# Group users by role and pick up to 2 samples for each
role_samples = {}
for role in roles:
    samples = list(db.users.find({"role": role}, {"email": 1, "name": 1}).limit(2))
    role_samples[role] = samples

print("\n--- Starting Login Verification for All Roles ---")

for role, samples in role_samples.items():
    print(f"\n[Role: {role}] Checking up to {len(samples)} accounts:")
    if not samples:
        print("  No accounts found for this role.")
        continue

    for user in samples:
        email = user.get("email")
        name = user.get("name")
        
        # Test login
        payload = {
            "email": email,
            "password": "password@1234"
        }
        
        try:
            response = requests.post(login_url, json=payload)
            if response.status_code == 200:
                print(f"  [SUCCESS] Login OK for '{name}' ({email})")
                
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

print("\n[INFO] All-role login checks complete!")
