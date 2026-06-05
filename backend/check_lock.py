import os
from pymongo import MongoClient
from dotenv import load_dotenv

def check_lock_status():
    load_dotenv()
    mongo_uri = os.getenv('MONGO_URI')
    client = MongoClient(mongo_uri)
    db = client.get_default_database()

    # Check first 5 external marks
    marks = list(db.external_marks.find({}).limit(5))
    for m in marks:
        print(f"ID: {m['_id']}, Is Locked: {m.get('is_locked')}, Status: {m.get('verification_status')}")

if __name__ == "__main__":
    check_lock_status()
