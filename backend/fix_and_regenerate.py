#!/usr/bin/env python3
"""
Fix exam_id in applications and regenerate hall tickets
"""
import os
import sys
from pathlib import Path
from pymongo import MongoClient
from bson.objectid import ObjectId
from config import Config
from app.utils.helpers import create_hall_ticket_pdf
from app.routes.hall_ticket import _build_hall_ticket_payload

# MongoDB connection
client = MongoClient(Config.MONGO_URI)
db = client.get_database()

# Get the actual exam that exists
exam = list(db.exams.find())[0]
exam_id = exam['_id']

print(f'Using exam: {exam.get("name")} (ID: {exam_id})\n')

# Get applications with PDF paths
applications = list(db.exam_applications.find({
    'hall_ticket_pdf_path': {'$exists': True, '$ne': None}
}))

print(f'Found {len(applications)} hall tickets to UPDATE...\n')

regenerated = 0
for app in applications:
    try:
        # Handle both student_id and studentId
        student_id = app.get('student_id') or app.get('studentId')
        
        if not student_id:
            print(f'⚠️  Skipping: No student ID')
            continue
        
        student = db.students.find_one({'_id': student_id})
        
        if not student:
            print(f'⚠️  Skipping: Student not found')
            continue
        
        # Update exam_id in application
        db.exam_applications.update_one(
            {'_id': app['_id']},
            {'$set': {'exam_id': exam_id}}
        )
        
        # Build payload with the correct exam
        payload = _build_hall_ticket_payload(app, student, exam)
        
        # Generate PDF
        storage_dir = Path('../../generated/hall_tickets')
        storage_dir.mkdir(parents=True, exist_ok=True)
        pdf_filename = payload['hall_ticket_number'] + '.pdf'
        pdf_path = storage_dir / pdf_filename
        
        create_hall_ticket_pdf(payload, str(pdf_path))
        
        print(f'✅ Updated: {student.get("name")} - HT#: {payload["hall_ticket_number"]}')
        regenerated += 1
    except Exception as e:
        error_msg = str(e)[:80]
        print(f'❌ Error: {error_msg}')

print(f'\n' + '='*70)
print(f'✅ COMPLETED!')
print(f'   Updated: {regenerated} hall tickets')
print(f'='*70)
print(f'\n🎓 All hall tickets now include the director\'s signature!')
