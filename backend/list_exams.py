#!/usr/bin/env python3
from config import Config
from pymongo import MongoClient

client = MongoClient(Config.MONGO_URI)
db = client.get_database()

# Get all exams
exams = list(db.exams.find().limit(10))

print(f'Found {len(exams)} exams in database:\n')
for exam in exams:
    print(f'  ID: {exam.get("_id")}')
    print(f'  Name: {exam.get("name")}')
    print()
