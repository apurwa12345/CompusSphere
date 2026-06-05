#!/usr/bin/env python3
"""
Regenerate all hall tickets with director's signature
"""
import os
import sys
from pathlib import Path
from pymongo import MongoClient
from app.utils.helpers import create_hall_ticket_pdf
from app.routes.hall_ticket import _build_hall_ticket_payload

# MongoDB connection
client = MongoClient('mongodb://localhost:27017')
db = client['mgm_cen']

# Get all approved applications
applications = list(db.exam_applications.find({'status': 'Approved'}).limit(10))

print(f'Found {len(applications)} applications to regenerate...\n')

regenerated = 0
for app in applications:
    try:
        student_id = app.get('student_id')
        exam_id = app.get('exam_id')
        
        student = db.students.find_one({'_id': student_id})
        exam = db.exams.find_one({'_id': exam_id})
        
        if not student or not exam:
            continue
        
        # Build payload
        payload = _build_hall_ticket_payload(app, student, exam)
        
        # Generate PDF
        storage_dir = Path('../../generated/hall_tickets')
        storage_dir.mkdir(parents=True, exist_ok=True)
        pdf_filename = payload['hall_ticket_number'] + '.pdf'
        pdf_path = storage_dir / pdf_filename
        
        create_hall_ticket_pdf(payload, str(pdf_path))
        
        print(f'✅ {student.get("name")}: {pdf_path}')
        regenerated += 1
    except Exception as e:
        print(f'❌ Error: {str(e)[:100]}')

print(f'\n✅ Regenerated {regenerated} hall tickets with signature!')
