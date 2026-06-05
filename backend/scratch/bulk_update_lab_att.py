import os
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv(override=True)
MONGO_URI = os.environ.get('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.get_database() # Uses database from URI (student_management)

# 1. Find all Practical Lab subjects
lab_subjects = list(db.subjects.find({'type': 'Practical Lab'}))
lab_subject_ids = [s['_id'] for s in lab_subjects]

print(f"Found {len(lab_subjects)} Practical Lab subjects: {[s['name'] for s in lab_subjects]}")

# 2. Update all internal marks for these subjects
# Set attendance to 100% (6 marks) and update total marks accordingly

internal_marks = db.internal_marks.find({'subject_id': {'$in': lab_subject_ids}})

count = 0
for mark in internal_marks:
    components = mark.get('components', {})
    
    # Set attendance
    components['theory_att_pct'] = '100'
    components['theory_att_marks'] = 6
    components['prac_att_pct'] = '100'
    components['prac_att_marks'] = 6
    
    # Recalculate total
    # marks = 6 + 6 + journal + project + performance + assessment
    try:
        j = float(components.get('journal', 0) or 0)
        p = float(components.get('project', 0) or 0)
        perf = float(components.get('performance', 0) or 0)
        a = float(components.get('assessment', 0) or 0)
    except (ValueError, TypeError):
        j = p = perf = a = 0

    total = 6 + 6 + j + p + perf + a
    
    db.internal_marks.update_one(
        {'_id': mark['_id']},
        {'$set': {
            'components': components,
            'marks': str(total)
        }}
    )
    count += 1

print(f"Successfully updated {count} student records across all Practical Lab subjects.")
