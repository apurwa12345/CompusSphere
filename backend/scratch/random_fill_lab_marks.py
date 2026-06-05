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

print(f"Targeting {len(lab_subjects)} Practical Lab subjects...")

# 2. Update all internal marks for these subjects
# Set attendance to 100% and fill all other components with random values (8-12)

internal_marks = db.internal_marks.find({'subject_id': {'$in': lab_subject_ids}})

count = 0
for mark in internal_marks:
    components = mark.get('components', {})
    
    # Attendance (Full marks)
    components['theory_att_pct'] = '100'
    components['theory_att_marks'] = 6
    components['prac_att_pct'] = '100'
    components['prac_att_marks'] = 6
    
    # Random marks for Lab components (8-12)
    j = random.randint(8, 12)
    p = random.randint(8, 12)
    perf = random.randint(8, 12)
    a = random.randint(8, 12)
    
    components['journal'] = str(j)
    components['project'] = str(p)
    components['performance'] = str(perf)
    components['assessment'] = str(a)
    
    # Recalculate total
    total = 6 + 6 + j + p + perf + a
    
    db.internal_marks.update_one(
        {'_id': mark['_id']},
        {'$set': {
            'components': components,
            'marks': str(total)
        }}
    )
    count += 1

print(f"Done! Successfully filled {count} student records with random marks (8-12) for all Lab components.")
