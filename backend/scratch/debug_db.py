
from app import create_app, mongo
from bson.objectid import ObjectId

app = create_app()
with app.app_context():
    subjects = list(mongo.db.subjects.find().limit(5))
    print(f"Subjects: {len(subjects)}")
    for s in subjects:
        print(f"ID: {s['_id']}, Name: {s.get('name')}")
    
    exams = list(mongo.db.exam_setup.find().limit(5))
    print(f"Exams: {len(exams)}")
    for e in exams:
        print(f"ID: {e['_id']}, Name: {e.get('exam_name')}")

    apps = list(mongo.db.exam_applications.find().limit(5))
    print(f"Applications: {len(apps)}")
