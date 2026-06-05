"""
Database Seed Script
Populates MongoDB with sample data for all roles and academic entities using the official @mgmcen.ac.in domain.
Run: python seed_db.py
"""
import os
import pymongo
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import datetime

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI") or "mongodb+srv://ashaikh49096_db_user:<db_password>@cluster0.a5iwugk.mongodb.net/?appName=Cluster0"
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

# Clear existing data
collections = ['users', 'departments', 'courses', 'subjects', 'students', 'faculties',
               'exams', 'exam_applications', 'marks', 'results', 'notifications', 'audit_logs']
for col in collections:
    db[col].drop()

print("🗑️  Cleared existing data.")

# --- USERS ---
hashed_password = generate_password_hash("password@1234")
users = [
    {"email": "admin@mgmcen.ac.in", "password": hashed_password, "role": "Admin", "name": "System Admin (MGM)", "created_at": datetime.datetime.utcnow()},
    {"email": "hod@mgmcen.ac.in", "password": hashed_password, "role": "HOD", "name": "Head of Department (CSE) (MGM)", "created_at": datetime.datetime.utcnow()},
    {"email": "examcell@mgmcen.ac.in", "password": hashed_password, "role": "Exam Cell", "name": "Exam Cell Controller (MGM)", "created_at": datetime.datetime.utcnow()},
    {"email": "faculty1@mgmcen.ac.in", "password": hashed_password, "role": "Faculty", "name": "Prof. Rajesh Verma", "created_at": datetime.datetime.utcnow()},
    {"email": "faculty2@mgmcen.ac.in", "password": hashed_password, "role": "Faculty", "name": "Dr. Anita Mehta", "created_at": datetime.datetime.utcnow()},
    {"email": "student1@mgmcen.ac.in", "password": hashed_password, "role": "Student", "name": "Rahul Gupta", "created_at": datetime.datetime.utcnow()},
    {"email": "student2@mgmcen.ac.in", "password": hashed_password, "role": "Student", "name": "Priya Patel", "created_at": datetime.datetime.utcnow()},
    {"email": "student3@mgmcen.ac.in", "password": hashed_password, "role": "Student", "name": "Amit Singh", "created_at": datetime.datetime.utcnow()},
]
db.users.insert_many(users)
print(f"✅ Inserted {len(users)} users.")

# --- DEPARTMENTS ---
dept_cs = db.departments.insert_one({"name": "Computer Science and Engineering", "code": "CSE"}).inserted_id
dept_ece = db.departments.insert_one({"name": "Electronics and Communication Engineering", "code": "ECE"}).inserted_id
dept_me = db.departments.insert_one({"name": "Mechanical Engineering", "code": "ME"}).inserted_id
print("✅ Inserted 3 departments.")

# --- COURSES ---
course_btech_cs = db.courses.insert_one({"name": "B.Tech Computer Science", "code": "BTCS", "department_id": str(dept_cs), "semesters": 8}).inserted_id
course_btech_ece = db.courses.insert_one({"name": "B.Tech Electronics", "code": "BTECE", "department_id": str(dept_ece), "semesters": 8}).inserted_id
print("✅ Inserted 2 courses.")

# --- SUBJECTS ---
subjects_data = [
    {"name": "Data Structures", "code": "CS301", "course_id": str(course_btech_cs), "semester": 3, "credits": 4, "type": "Theory"},
    {"name": "Operating Systems", "code": "CS302", "course_id": str(course_btech_cs), "semester": 3, "credits": 4, "type": "Theory"},
    {"name": "Computer Networks", "code": "CS401", "course_id": str(course_btech_cs), "semester": 4, "credits": 3, "type": "Theory"},
    {"name": "Database Systems", "code": "CS402", "course_id": str(course_btech_cs), "semester": 4, "credits": 4, "type": "Theory"},
    {"name": "DS Lab", "code": "CS303L", "course_id": str(course_btech_cs), "semester": 3, "credits": 2, "type": "Practical"},
    {"name": "Digital Electronics", "code": "EC301", "course_id": str(course_btech_ece), "semester": 3, "credits": 4, "type": "Theory"},
]
subject_ids = db.subjects.insert_many(subjects_data).inserted_ids
print(f"✅ Inserted {len(subjects_data)} subjects.")

# --- FACULTIES ---
fac1 = db.faculties.insert_one({"name": "Prof. Rajesh Verma", "email": "faculty1@mgmcen.ac.in", "department_id": str(dept_cs), "employee_id": "FAC001", "designation": "Assistant Professor"}).inserted_id
fac2 = db.faculties.insert_one({"name": "Dr. Anita Mehta", "email": "faculty2@mgmcen.ac.in", "department_id": str(dept_cs), "employee_id": "FAC002", "designation": "Associate Professor"}).inserted_id
print("✅ Inserted 2 faculty profiles.")

# --- STUDENTS ---
stu1 = db.students.insert_one({"name": "Rahul Gupta", "email": "student1@mgmcen.ac.in", "enrollment_no": "2023CSE001", "course_id": str(course_btech_cs), "department_id": str(dept_cs), "current_semester": 3, "batch_year": 2023}).inserted_id
stu2 = db.students.insert_one({"name": "Priya Patel", "email": "student2@mgmcen.ac.in", "enrollment_no": "2023CSE002", "course_id": str(course_btech_cs), "department_id": str(dept_cs), "current_semester": 3, "batch_year": 2023}).inserted_id
stu3 = db.students.insert_one({"name": "Amit Singh", "email": "student3@mgmcen.ac.in", "enrollment_no": "2023CSE003", "course_id": str(course_btech_cs), "department_id": str(dept_cs), "current_semester": 3, "batch_year": 2023}).inserted_id
print("✅ Inserted 3 student profiles.")

# --- EXAMS ---
exam1 = db.exams.insert_one({
    "name": "End Semester Examination - Sem 3 (Dec 2025)",
    "course_id": course_btech_cs,
    "semester": 3,
    "start_date": "2025-12-01",
    "end_date": "2025-12-15",
    "status": "Upcoming",
    "timetable": [
        {"subject_id": str(subject_ids[0]), "date": "2025-12-01", "time": "10:00 AM"},
        {"subject_id": str(subject_ids[1]), "date": "2025-12-05", "time": "10:00 AM"},
        {"subject_id": str(subject_ids[4]), "date": "2025-12-10", "time": "02:00 PM"},
    ]
}).inserted_id
print("✅ Inserted 1 exam.")

# --- NOTIFICATIONS ---
notifications = [
    {"title": "Exam Schedule Released", "message": "End Semester Exam for Dec 2025 schedule has been published.", "target_role": "Student", "target_email": None, "created_at": datetime.datetime.utcnow()},
    {"title": "Faculty Meeting", "message": "A faculty meeting is scheduled for Nov 28, 2025 at 3 PM.", "target_role": "Faculty", "target_email": None, "created_at": datetime.datetime.utcnow()},
    {"title": "Results Declaration", "message": "Sem 2 results will be declared on Nov 30, 2025.", "target_role": "All", "target_email": None, "created_at": datetime.datetime.utcnow()},
]
db.notifications.insert_many(notifications)
print(f"✅ Inserted {len(notifications)} notifications.")

print("\n🎉 Database seeded successfully!")
print("\n--- Login Credentials ---")
print("Admin:     admin@mgmcen.ac.in / password@1234")
print("HOD:       hod@mgmcen.ac.in / password@1234")
print("Exam Cell: examcell@mgmcen.ac.in / password@1234")
print("Faculty:   faculty1@mgmcen.ac.in / password@1234")
print("Student:   student1@mgmcen.ac.in / password@1234")
