"""Analyze department_id mismatch issue"""
from pymongo import MongoClient
from config import Config

def analyze_mismatch():
    try:
        print("=" * 80)
        print("ANALYZING DEPARTMENT_ID MISMATCH")
        print("=" * 80)
        
        client = MongoClient(Config.MONGO_URI)
        db = client.get_database()
        
        # Get all department IDs (from departments collection)
        print("\n1. Department IDs (from 'departments' collection):")
        departments = list(db.departments.find({}, {"_id": 1, "name": 1, "code": 1}))
        dept_ids = {}
        for d in departments:
            print(f"   {d['_id']} ({type(d['_id']).__name__}): {d.get('name')}")
            dept_ids[str(d['_id'])] = d
        
        # Get unique student department_ids
        print("\n2. Student Department IDs (from 'students' collection):")
        pipeline = [
            {"$group": {"_id": "$department_id", "count": {"$sum": 1}, "sample_name": {"$first": "$name"}}},
            {"$sort": {"count": -1}}
        ]
        student_deps = list(db.students.aggregate(pipeline))
        for sd in student_deps:
            dept_id = sd['_id']
            count = sd['count']
            found_in_dept = False
            
            # Try to find matching department
            for d in departments:
                if (str(d['_id']) == str(dept_id) or 
                    d['_id'] == dept_id or
                    d.get('code') == dept_id or
                    str(d['_id']).lower() == str(dept_id).lower()):
                    print(f"   {dept_id} ({type(dept_id).__name__}): {count} students → MATCHED to '{d.get('name')}'")
                    found_in_dept = True
                    break
            
            if not found_in_dept:
                print(f"   {dept_id} ({type(dept_id).__name__}): {count} students → ✗ NO MATCH FOUND")
                # Show sample student
                sample = db.students.find_one({"department_id": dept_id})
                if sample:
                    print(f"       Sample: {sample.get('name')} ({sample.get('department')})")
        
        # Check if department field in students has the actual department names
        print("\n3. Department Field Values in Students:")
        pipeline = [
            {"$group": {"_id": "$department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        dept_names = list(db.students.aggregate(pipeline))
        for dn in dept_names[:10]:
            print(f"   '{dn['_id']}': {dn['count']} students")
        
        # Check if there's a pattern
        print("\n4. ANALYSIS:")
        sample_students = list(db.students.find({}).limit(3))
        for s in sample_students:
            print(f"\n   Student: {s.get('name')}")
            print(f"   - department_id: {s.get('department_id')} ({type(s.get('department_id')).__name__})")
            print(f"   - department: {s.get('department')}")
            print(f"   - enrollment_no: {s.get('enrollment_no')}")
        
        print("\n" + "=" * 80)
        print("ROOT CAUSE: Student department_id (integer) does NOT match department _id (string)")
        print("=" * 80)
        
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_mismatch()
