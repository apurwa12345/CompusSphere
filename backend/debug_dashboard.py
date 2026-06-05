"""Debug script to check Department-wise Result Analysis data"""
import sys
from pymongo import MongoClient
from bson.objectid import ObjectId
from config import Config

def debug_dashboard():
    try:
        client = MongoClient(Config.MONGO_URI)
        db = client['academic_portal']
        
        print("=" * 80)
        print("DEBUGGING DASHBOARD DATA")
        print("=" * 80)
        
        # Check departments
        print("\n1. DEPARTMENTS Collection:")
        departments = list(db.departments.find({}, {"_id": 1, "name": 1, "code": 1}))
        print(f"   Total departments: {len(departments)}")
        for d in departments:
            print(f"   - {d['name']} (Code: {d.get('code', 'N/A')}), ID: {d['_id']} (Type: {type(d['_id']).__name__})")
        
        # Check students
        print("\n2. STUDENTS Collection:")
        total_students = db.students.count_documents({})
        print(f"   Total students: {total_students}")
        
        if total_students > 0:
            # Get sample students
            sample_students = list(db.students.find({}).limit(5))
            print(f"\n   Sample students (first 5):")
            for s in sample_students:
                print(f"   - {s.get('name', 'N/A')}")
                print(f"     department_id: {s.get('department_id')} (Type: {type(s.get('department_id')).__name__ if s.get('department_id') else 'None'})")
                print(f"     email: {s.get('email')}")
                print(f"     Fields: {list(s.keys())}")
                print()
        
        # Check students by department (using current logic)
        print("\n3. STUDENTS BY DEPARTMENT (using current dashboard logic):")
        for d in departments:
            dep_id = d["_id"]
            # Current logic from dashboard.py
            count = db.students.count_documents({"department_id": {"$in": [dep_id, str(dep_id)]}})
            print(f"   {d['name']}: {count} students")
            
            # Debug: Show what department_ids exist for this department
            if count == 0:
                # Try finding any student that might have this department
                sample = db.students.find_one({"department_id": dep_id})
                if not sample:
                    sample = db.students.find_one({"department_id": str(dep_id)})
                if sample:
                    print(f"      ✓ Found student with exact match: {sample.get('name')}")
                else:
                    print(f"      ✗ No students found for this department")
                    # Show what department_ids actually exist
                    sample_student = db.students.find_one({})
                    if sample_student and sample_student.get('department_id'):
                        print(f"      Example existing department_id: {sample_student.get('department_id')} (Type: {type(sample_student.get('department_id')).__name__})")
        
        # Check if there are students with unmatched department_ids
        print("\n4. UNIQUE DEPARTMENT_IDs IN STUDENTS:")
        pipeline = [
            {"$group": {"_id": "$department_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        unique_deps = list(db.students.aggregate(pipeline))
        print(f"   Found {len(unique_deps)} unique department_ids:")
        for udep in unique_deps:
            print(f"   - {udep['_id']} (Type: {type(udep['_id']).__name__}): {udep['count']} students")
            # Try to match with actual department
            matching_dept = None
            for d in departments:
                if d['_id'] == udep['_id'] or str(d['_id']) == str(udep['_id']):
                    matching_dept = d
                    break
            if matching_dept:
                print(f"     → Matched to: {matching_dept['name']}")
            else:
                print(f"     → NOT MATCHED to any department")
        
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            client.close()
        except:
            pass

if __name__ == "__main__":
    debug_dashboard()
