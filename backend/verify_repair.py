import os
import pymongo
from dotenv import load_dotenv

# Load database URI
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["student_management"]

print("[INFO] Starting optimized database relationship verification...")

# Load all active student and subject _ids into sets for O(1) local lookup
print("[INFO] Loading students and subjects into memory...")
active_student_ids = set(db.students.distinct("_id"))
active_subject_ids = set(db.subjects.distinct("_id"))
print(f"[INFO] Loaded {len(active_student_ids)} students and {len(active_subject_ids)} subjects.")

# 1. Verify Student references in other collections
def verify_student_refs():
    print("\n--- Verifying Student References ---")
    collections_with_student = [
        ('internal_marks', 'student_id'),
        ('external_marks', 'student_id'),
        ('results', 'student_id'),
        ('exam_applications', 'student_id'),
        ('fee_submissions', 'student_id'),
        ('marks', 'student_id'),
        ('backlogs', 'student_id')
    ]

    for coll_name, field in collections_with_student:
        coll = db[coll_name]
        docs = list(coll.find({field: {'$exists': True}}, {field: 1}))
        if not docs:
            print(f"  [INFO] No documents in '{coll_name}' with '{field}'")
            continue

        broken_count = 0
        total_checked = 0
        for doc in docs:
            student_id = doc.get(field)
            if not student_id:
                continue
            total_checked += 1
            
            # O(1) local lookup
            if student_id not in active_student_ids:
                broken_count += 1
                if broken_count <= 3:
                    print(f"    [ERROR] Broken link in '{coll_name}' doc {doc['_id']}: student_id {student_id} not found in 'students'")

        if broken_count == 0:
            print(f"  [SUCCESS] All {total_checked} references in '{coll_name}' match active students!")
        else:
            print(f"  [FAILURE] Found {broken_count} broken student references out of {total_checked} in '{coll_name}'!")

# 2. Verify Subject references in other collections
def verify_subject_refs():
    print("\n--- Verifying Subject References ---")
    collections_with_subject = [
        ('internal_marks', 'subject_id'),
        ('external_marks', 'subject_id'),
        ('marks', 'subject_id'),
        ('timetable', 'subject_id'),
        ('faculty_allocations', 'subject_id')
    ]

    for coll_name, field in collections_with_subject:
        coll = db[coll_name]
        docs = list(coll.find({field: {'$exists': True}}, {field: 1}))
        if not docs:
            print(f"  [INFO] No documents in '{coll_name}' with '{field}'")
            continue

        broken_count = 0
        total_checked = 0
        for doc in docs:
            subject_id = doc.get(field)
            if not subject_id:
                continue
            total_checked += 1
            
            # O(1) local lookup
            if subject_id not in active_subject_ids:
                broken_count += 1
                if broken_count <= 3:
                    print(f"    [ERROR] Broken link in '{coll_name}' doc {doc['_id']}: subject_id {subject_id} not found in 'subjects'")

        if broken_count == 0:
            print(f"  [SUCCESS] All {total_checked} references in '{coll_name}' match active subjects!")
        else:
            print(f"  [FAILURE] Found {broken_count} broken subject references out of {total_checked} in '{coll_name}'!")

if __name__ == "__main__":
    verify_student_refs()
    verify_subject_refs()
    print("\n[INFO] Relationship verification complete!")
