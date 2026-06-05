import pymongo, os
from dotenv import load_dotenv
load_dotenv()
client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['student_management']

u = db.users.find_one({'role': 'Faculty'})
if u:
    f = db.faculties.find_one({'email': u['email']})
    print(f"User email: '{u['email']}'")
    print(f"Faculty email in profile: '{f['email']}'" if f else "Faculty NOT FOUND for this user email")
    
    # Check specifically for Rahul
    rahul_u = db.users.find_one({'email': 'rahul.singh@mgmcen.ac.in'})
    rahul_f = db.faculties.find_one({'email': 'rahul.singh@mgmcen.ac.in'})
    print(f"Rahul User: {rahul_u['email'] if rahul_u else 'NOT FOUND'}")
    print(f"Rahul Faculty: {rahul_f['email'] if rahul_f else 'NOT FOUND'}")
else:
    print("No Faculty user found!")
