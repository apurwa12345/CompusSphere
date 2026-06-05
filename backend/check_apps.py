#!/usr/bin/env python3
from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['mgm_cen']

# Count all applications
total = db.exam_applications.count_documents({})
print(f'Total applications: {total}\n')

# Get applications
apps = list(db.exam_applications.find().limit(20))
print(f'Applications (first 20):')
for i, app in enumerate(apps, 1):
    app_id = app.get('_id')
    status = app.get('status')
    generated = app.get('hall_ticket_generated')
    ht_number = app.get('hall_ticket_number')
    student_id = app.get('student_id')
    
    print(f'{i}. ID: {app_id}')
    print(f'   Status: {status}, Generated: {generated}, HT#: {ht_number}')
    print()
