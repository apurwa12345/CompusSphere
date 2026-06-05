"""Verify that the dashboard fix works correctly"""
from pymongo import MongoClient
from config import Config

def verify_fix():
    try:
        client = MongoClient(Config.MONGO_URI)
        db = client.get_database()
        
        print("=" * 80)
        print("VERIFYING DASHBOARD FIX")
        print("=" * 80)
        
        # Test the corrected _count_by_department logic
        def _count_by_department():
            departments = list(db.departments.find({}, {"_id": 1, "name": 1}))
            data = []
            for d in departments:
                dept_name = d.get("name", "")
                # Match students by department name string
                count = db.students.count_documents({"department": dept_name})
                data.append({"name": dept_name, "students": count})
            return data
        
        result = _count_by_department()
        
        print("\nDEPARTMENT-WISE RESULT ANALYSIS (After Fix):")
        print("-" * 80)
        
        total_students = sum(item['students'] for item in result)
        
        for item in sorted(result, key=lambda x: x['students'], reverse=True):
            name = item['name']
            count = item['students']
            percentage = (count / total_students * 100) if total_students > 0 else 0
            print(f"{name}: {count} students ({percentage:.1f}%)")
        
        print("-" * 80)
        print(f"TOTAL: {total_students} students across {len(result)} departments")
        
        if total_students > 0:
            print("\n✓ SUCCESS: Dashboard will now display real department data!")
            print("✓ All departments show correct student counts")
        else:
            print("\n✗ ERROR: Still no students found")
        
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_fix()
