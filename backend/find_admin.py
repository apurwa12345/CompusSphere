import pymongo, os
from dotenv import load_dotenv

load_dotenv()
client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['student_management']

admin = db.users.find_one({'role': 'Admin'})
if admin:
    print(f"ADMIN_EMAIL: {admin['email']}")
else:
    print("Admin not found")
