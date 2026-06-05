#!/usr/bin/env python3
from config import Config
from pymongo import MongoClient

client = MongoClient(Config.MONGO_URI)
db = client.get_database()

# Get applications that have PDF path
applications = list(db.exam_applications.find({
    'hall_ticket_pdf_path': {'$exists': True, '$ne': None}
}))

print(f'Found {len(applications)} applications with PDF path\n')

for app in applications:
    print(f'Application ID: {app.get("_id")}')
    print(f'  Hall Ticket Number: {app.get("hall_ticket_number")}')
    print(f'  student_id: {app.get("student_id")}')
    print(f'  studentId: {app.get("studentId")}')
    print(f'  exam_id: {app.get("exam_id")}')
    print(f'  PDF Path: {app.get("hall_ticket_pdf_path")}')
    print()
