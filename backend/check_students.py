import os
import pymongo

MONGO_URI = "mongodb+srv://ashaikh49096_db_user:Shaikh401234567@cluster0.a5iwugk.mongodb.net/?appName=Cluster0"

client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]
students = list(db.users.find({"role": "Student"}, {"email": 1, "_id": 0}))
print(students)
