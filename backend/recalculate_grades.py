import os
from bson.objectid import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Import the helper function (or redefine it here to avoid import issues)
def calculate_grade(marks_obtained, total_marks=100):
    """
    Calculate B.Tech grade based on percentage.
    Scale: EX=10, AA=9, AB=8.5, BB=8, BC=7.5, CC=7, CD=6.5, DD=6, DE=5.5, EE=5, FF=0
    """
    if total_marks == 0: return 'FF', 0.0
    percentage = (marks_obtained / total_marks) * 100
    if percentage >= 90: return 'EX', 10.0
    if percentage >= 80: return 'AA', 9.0
    if percentage >= 75: return 'AB', 8.5
    if percentage >= 70: return 'BB', 8.0
    if percentage >= 65: return 'BC', 7.5
    if percentage >= 60: return 'CC', 7.0
    if percentage >= 55: return 'CD', 6.5
    if percentage >= 50: return 'DD', 6.0
    if percentage >= 45: return 'DE', 5.5
    if percentage >= 40: return 'EE', 5.0
    return 'FF', 0.0

def run_migration():
    load_dotenv()
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/exam_system')
    client = MongoClient(mongo_uri)
    db = client.get_default_database()

    print("Starting grade recalculation migration...")

    # 1. Update internal_marks
    internal_count = 0
    for doc in db.internal_marks.find({}):
        marks = doc.get('marks', 0)
        max_marks = doc.get('max_marks', 20)
        grade, grade_point = calculate_grade(marks, max_marks)
        db.internal_marks.update_one({'_id': doc['_id']}, {'$set': {'grade': grade, 'grade_point': grade_point}})
        internal_count += 1
    print(f"Updated {internal_count} internal_marks records.")

    # 2. Update external_marks
    external_count = 0
    for doc in db.external_marks.find({}):
        marks = doc.get('marks', 0)
        max_marks = doc.get('max_marks', 60)
        special_case = doc.get('special_case', 'None')
        
        if special_case != 'None':
            grade, grade_point = 'FF', 0.0
        else:
            grade, grade_point = calculate_grade(marks, max_marks)
            
        db.external_marks.update_one({'_id': doc['_id']}, {'$set': {'grade': grade, 'grade_point': grade_point}})
        external_count += 1
    print(f"Updated {external_count} external_marks records.")

    # 3. Update marks (combined)
    combined_count = 0
    for doc in db.marks.find({}):
        # In the combined marks collection, total_marks is usually out of 100 (or internal+external)
        # We need to find the actual max_marks or assume 100 if not present
        total_marks = doc.get('total_marks', 0)
        # Assuming combined marks are usually scaled to 100 or follow a specific max
        # If max_marks isn't stored, we might need to be careful.
        # Let's check a few records first or assume 100.
        grade, grade_point = calculate_grade(total_marks, 100) 
        db.marks.update_one({'_id': doc['_id']}, {'$set': {'grade': grade, 'grade_point': grade_point, 'is_backlog': (grade == 'FF')}})
        combined_count += 1
    print(f"Updated {combined_count} combined marks records.")

    print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
