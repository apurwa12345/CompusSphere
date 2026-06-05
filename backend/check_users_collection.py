import pymongo
import os
from dotenv import load_dotenv

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

print("[INFO] Fetching all user accounts in the users collection...")
users = list(db.users.find({}, {"_id": 0, "email": 1, "role": 1, "name": 1}))

print(f"[INFO] Total users found: {len(users)}")
print("\n--- Users by Role ---")

by_role = {}
for u in users:
    role = u.get("role", "Unknown")
    by_role.setdefault(role, []).append(u)

for role, u_list in by_role.items():
    print(f"\n[Role: {role}] Count: {len(u_list)}")
    # Print up to 10 users for this role
    for u in u_list[:10]:
        print(f"  - Name: '{u.get('name')}', Email: '{u.get('email')}'")
    if len(u_list) > 10:
        print(f"  ... and {len(u_list) - 10} more")
