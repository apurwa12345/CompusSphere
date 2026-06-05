import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)
db = MongoClient(os.environ['MONGO_URI'])['student_management']

result = db.exam_applications.update_many({'status': 'Approved'}, {'$set': {'status': 'Pending'}})
print(f"Reverted {result.modified_count} applications to Pending.")
