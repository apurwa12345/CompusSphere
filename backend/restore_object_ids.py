import os
import pandas as pd
import pymongo
from bson.objectid import ObjectId
from dotenv import load_dotenv

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

def add_to_objectid(base_str, offset):
    base_int = int(base_str, 16)
    new_int = base_int + offset
    new_hex = hex(new_int)[2:].zfill(24)
    return ObjectId(new_hex)

def restore_students():
    print("[INFO] Restoring Student ObjectIds...")
    csv_path = r"c:\Users\91997\OneDrive\Desktop\Final1\students_export.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing {csv_path}")

    # Read students CSV to get exact row order
    df = pd.read_csv(csv_path, dtype=str)
    
    base_student_id_str = "69ca258a16a733b7fdccbf9c"
    updated_count = 0

    for idx, row in df.iterrows():
        email = str(row['email']).strip().lower()
        if not email:
            continue
        
        # Find current student document in DB
        current_doc = db.students.find_one({"email": email})
        if not current_doc:
            print(f"[WARNING] Student not found in DB: {email}")
            continue

        # Compute original sequential ObjectId
        original_id = add_to_objectid(base_student_id_str, idx)

        if current_doc['_id'] == original_id:
            continue # Already correct

        # Re-create document with original ObjectId
        doc_copy = dict(current_doc)
        doc_copy['_id'] = original_id
        
        # Remove and re-insert
        db.students.delete_one({"_id": current_doc['_id']})
        db.students.insert_one(doc_copy)
        updated_count += 1

    print(f"[SUCCESS] Successfully restored ObjectIds for {updated_count} student documents.")

def restore_subjects():
    print("[INFO] Restoring Subject ObjectIds...")
    SUBJECT_MAP = {
        "Engineering Mathematics – I": ObjectId("69ca258d16a733b7fdccc23c"),
        "Engineering Chemistry": ObjectId("69ca258d16a733b7fdccc23d"),
        "Engineering Chemistry Lab": ObjectId("69ca258d16a733b7fdccc23e"),
        "Engineering Mechanics": ObjectId("69ca258d16a733b7fdccc23f"),
        "Engineering Mechanics Lab": ObjectId("69ca258d16a733b7fdccc240"),
        "Programming for Problem Solving": ObjectId("69ca258d16a733b7fdccc241"),
        "Programming for Problem Solving Lab": ObjectId("69ca258d16a733b7fdccc242"),
        "Workshop Practices": ObjectId("69ca258d16a733b7fdccc243"),
        "Communication Skills": ObjectId("69ca258d16a733b7fdccc244"),
        "Communication Skills Lab": ObjectId("69ca258d16a733b7fdccc245"),
        "A. Yoga Education": ObjectId("69ca258d16a733b7fdccc246"),
        "B. NSS-I": ObjectId("69ca258d16a733b7fdccc247"),
        "C. NCC": ObjectId("69ca258d16a733b7fdccc248")
    }

    updated_count = 0
    for name, original_id in SUBJECT_MAP.items():
        # Match name case-insensitively and strip whitespace
        current_doc = db.subjects.find_one({"name": {"$regex": f"^{name.strip()}$", "$options": "i"}})
        if not current_doc:
            print(f"[WARNING] Subject not found in DB: '{name}'")
            continue

        if current_doc['_id'] == original_id:
            continue

        doc_copy = dict(current_doc)
        doc_copy['_id'] = original_id

        db.subjects.delete_one({"_id": current_doc['_id']})
        db.subjects.insert_one(doc_copy)
        updated_count += 1

    print(f"[SUCCESS] Successfully restored ObjectIds for {updated_count} subject documents.")

if __name__ == "__main__":
    restore_students()
    restore_subjects()
    print("[SUCCESS] Database relationship repair complete!")
