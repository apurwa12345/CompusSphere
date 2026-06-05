import os
import random
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv(override=True)
MONGO_URI = os.environ.get('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.get_database() 

# 1. Find all Practical Lab subjects
lab_subjects = list(db.subjects.find({'type': 'Practical Lab'}))
lab_subject_ids = [s['_id'] for s in lab_subjects]

print(f"Targeting {len(lab_subjects)} Practical Lab subjects for EXTERNAL marks...")

# 2. Update all external marks for these subjects
# Fill with random values (30-40)

external_marks = db.external_marks.find({'subject_id': {'$in': lab_subject_ids}})

count = 0
for mark in external_marks:
    # Random marks (30-40)
    m = random.randint(30, 40)
    
    # Simple pass check (30/40 is 75%, definitely a pass)
    db.external_marks.update_one(
        {'_id': mark['_id']},
        {'$set': {
            'marks': m,
            'max_marks': 40.0,
            'is_pass': True,
            'special_case': 'None',
            'is_verified': False,
            'verification_status': 'Pending'
        }}
    )
    count += 1

print(f"Done! Successfully filled {count} external records with random marks (30-40) for all Lab subjects.")
