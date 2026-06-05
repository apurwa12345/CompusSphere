import os
import random
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

# 2. Find all approved applications for these subjects
# We need to create marks for each student-subject pair in each exam session
exams = list(db.exams.find({'status': {'$in': ['Upcoming', 'Ongoing', 'Completed']}}))

count = 0
for exam in exams:
    exam_id = exam['_id']
    apps = list(db.exam_applications.find({'exam_id': exam_id, 'status': 'Approved'}))
    
    for app in apps:
        student_id = app.get('studentId') or app.get('student_id')
        if not student_id: continue
        
        # Check which lab subjects this student is registered for
        student_labs = [sid for sid in app.get('subjects', []) if sid in lab_subject_ids]
        
        for sub_id in student_labs:
            # Check if marks already exist
            existing = db.internal_marks.find_one({
                'exam_id': exam_id,
                'student_id': student_id,
                'subject_id': sub_id,
                'exam_type': 'practical_internal'
            })
            
            if not existing:
                # Create random lab marks
                j = random.randint(8, 12)
                p = random.randint(8, 12)
                perf = random.randint(8, 12)
                a = random.randint(8, 12)
                
                components = {
                    'theory_att_pct': '100',
                    'theory_att_marks': 6,
                    'prac_att_pct': '100',
                    'prac_att_marks': 6,
                    'journal': str(j),
                    'project': str(p),
                    'performance': str(perf),
                    'assessment': str(a)
                }
                
                total = 6 + 6 + j + p + perf + a
                
                db.internal_marks.insert_one({
                    'exam_id': exam_id,
                    'student_id': student_id,
                    'subject_id': sub_id,
                    'exam_type': 'practical_internal',
                    'marks': str(total),
                    'max_marks': 60.0,
                    'components': components,
                    'is_pass': total >= 24,
                    'is_locked': False,
                    'is_submitted_by_faculty': False,
                    'entered_by': 'system_bulk_fill',
                    'entered_at': datetime.utcnow()
                })
                count += 1

print(f"Done! Successfully created and saved {count} internal lab records in the database.")
