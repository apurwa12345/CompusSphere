import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(override=True)
MONGO_URI = os.environ.get('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.get_database() 

# 1. Find all Practical Lab subjects
lab_subjects = list(db.subjects.find({'type': 'Practical Lab'}))
lab_subject_ids = [s['_id'] for s in lab_subjects]

print(f"Forwarding marks for {len(lab_subjects)} Practical Lab subjects...")

# 2. Forward Internal Practical Marks
res_internal = db.internal_marks.update_many(
    {'exam_type': 'practical_internal', 'subject_id': {'$in': lab_subject_ids}},
    {'$set': {
        'is_submitted_by_faculty': True, 
        'is_locked': True, 
        'submitted_at': datetime.utcnow()
    }}
)

# 3. Forward External Practical Marks
res_external = db.external_marks.update_many(
    {'subject_id': {'$in': lab_subject_ids}},
    {'$set': {
        'is_submitted_by_faculty': True, 
        'is_locked': True, 
        'submitted_at': datetime.utcnow()
    }}
)

print(f"Success!")
print(f"- Internal Records Forwarded: {res_internal.modified_count}")
print(f"- External Records Forwarded: {res_external.modified_count}")
print("All Practical Lab marks are now LOCKED and forwarded to the Exam Cell.")
