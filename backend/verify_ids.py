#!/usr/bin/env python3
from config import Config
from pymongo import MongoClient
from bson.objectid import ObjectId

client = MongoClient(Config.MONGO_URI)
db = client.get_database()

# Student and exam IDs from applications
student_ids = ['69ca258a16a733b7fdccbfa3', '69ca258a16a733b7fdccbfa8']
exam_id = '69e9cae901260c32076f7602'

print('Checking students:')
for sid in student_ids:
    try:
        sid_oid = ObjectId(sid)
        student = db.students.find_one({'_id': sid_oid})
        print(f'  {sid}: Found - {student.get("name") if student else "NOT FOUND"}')
    except Exception as e:
        print(f'  {sid}: Error - {e}')

print('\nChecking exam:')
try:
    exam_oid = ObjectId(exam_id)
    exam = db.exams.find_one({'_id': exam_oid})
    print(f'  {exam_id}: Found - {exam.get("name") if exam else "NOT FOUND"}')
except Exception as e:
    print(f'  {exam_id}: Error - {e}')
