import os
from pymongo import MongoClient
from dotenv import load_dotenv

def check_student():
    load_dotenv()
    mongo_uri = os.getenv('MONGO_URI')
    client = MongoClient(mongo_uri)
    db = client.get_default_database()

    student = db.students.find_one({'enrollment_no': '2502127111242048'})
    if not student:
        print("Student not found")
        return

    print(f"Student: {student['name']}")
    
    marks = list(db.external_marks.find({'student_id': student['_id']}))
    for m in marks:
        print(f"Subject ID: {m['subject_id']}, Marks: {m['marks']}, Grade: {m['grade']}")

if __name__ == "__main__":
    check_student()
