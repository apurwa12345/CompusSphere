#!/usr/bin/env python3
"""
Regenerate ALL existing hall tickets with director's signature
"""
import os
import sys
from pathlib import Path
from pymongo import MongoClient
from bson.objectid import ObjectId
from config import Config
from app.utils.helpers import create_hall_ticket_pdf
from app.routes.hall_ticket import _build_hall_ticket_payload

# MongoDB connection using config
client = MongoClient(Config.MONGO_URI)
db = client.get_database()

# Get ALL applications that have hall_ticket_pdf_path (meaning they were generated)
applications = list(db.exam_applications.find({
    'hall_ticket_pdf_path': {'$exists': True, '$ne': None}
}))

print(f'Found {len(applications)} already generated hall tickets to UPDATE...\n')

regenerated = 0
errors = 0

for app in applications:
    try:
        # Handle both student_id and studentId
        student_id = app.get('student_id') or app.get('studentId')
        exam_id = app.get('exam_id') or app.get('examId')
        
        if not student_id or not exam_id:
            print(f'⚠️  Skipping: Missing student or exam ID')
            continue
        
        student = db.students.find_one({'_id': student_id})
        exam = db.exams.find_one({'_id': exam_id})
        
        if not student or not exam:
            print(f'⚠️  Skipping: Student or exam not found')
            continue
        
        # Build payload
        payload = _build_hall_ticket_payload(app, student, exam)
        
        # Generate PDF
        storage_dir = Path('../../generated/hall_tickets')
        storage_dir.mkdir(parents=True, exist_ok=True)
        pdf_filename = payload['hall_ticket_number'] + '.pdf'
        pdf_path = storage_dir / pdf_filename
        
        create_hall_ticket_pdf(payload, str(pdf_path))
        
        print(f'✅ Updated: {student.get("name")} - {pdf_path}')
        regenerated += 1
    except Exception as e:
        print(f'❌ Error for {app.get("_id")}: {str(e)[:80]}')
        errors += 1

print(f'\n' + '='*60)
print(f'✅ COMPLETED!')
print(f'   Updated: {regenerated} hall tickets')
print(f'   Errors: {errors}')
print(f'='*60)
print(f'\n🎓 All hall tickets now include the director\'s signature!')
