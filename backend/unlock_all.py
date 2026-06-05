import os
from pymongo import MongoClient
from dotenv import load_dotenv

def unlock_all():
    load_dotenv()
    mongo_uri = os.getenv('MONGO_URI')
    client = MongoClient(mongo_uri)
    db = client.get_default_database()

    print("Unlocking all external marks...")
    result = db.external_marks.update_many({}, {'$set': {'is_locked': False}})
    print(f"Unlocked {result.modified_count} records.")

if __name__ == "__main__":
    unlock_all()
