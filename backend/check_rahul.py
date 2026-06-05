import pymongo, os
from dotenv import load_dotenv

load_dotenv()
client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['student_management']

user = db.users.find_one({'email': 'rahul.singh@mgmcen.ac.in'})
if user:
    print(f"ROLE: '{user['role']}'")
    print(f"ROLE len: {len(user['role'])}")
    print(f"ROLE repr: {repr(user['role'])}")
else:
    print("User not found")
