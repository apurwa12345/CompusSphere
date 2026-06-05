import pymongo, os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()
client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['student_management']

test_email = 'verify_admin@test.com'
test_password = 'verify_password123'

# Use same hashing as in register
hashed_pw = generate_password_hash(test_password)

db.users.update_one(
    {'email': test_email},
    {'$set': {
        'email': test_email,
        'password': hashed_pw,
        'role': 'Admin',
        'name': 'Verification Admin'
    }},
    upsert=True
)
print(f"Created/Reset admin user: {test_email} / {test_password}")
