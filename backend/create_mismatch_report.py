"""Create a detailed mismatch report"""
from pymongo import MongoClient
from config import Config

def create_report():
    try:
        client = MongoClient(Config.MONGO_URI)
        db = client.get_database()
        
        # Get departments
        departments = list(db.departments.find({}, {"_id": 1, "name": 1, "code": 1}))
        students = list(db.students.find({}, {"_id": 1, "name": 1, "department_id": 1, "department": 1}))
        
        print("=" * 80)
        print("DEPARTMENT MISMATCH ANALYSIS REPORT")
        print("=" * 80)
        
        print("\nDEPARTMENTS TABLE:")
        print("-" * 80)
        for d in departments:
            print(f"ID: {d['_id']}")
            print(f"Name: {d['name']}")
            print(f"Code: {d.get('code', 'N/A')}")
            print()
        
        # Group students by department field (actual department name)
        dept_map = {}
        for s in students:
            dept_name = s.get('department', 'Unknown')
            if dept_name not in dept_map:
                dept_map[dept_name] = []
            dept_map[dept_name].append(s)
        
        print("\nSTUDENTS BY DEPARTMENT (using 'department' field):")
        print("-" * 80)
        for dept_name in sorted(dept_map.keys()):
            count = len(dept_map[dept_name])
            print(f"{dept_name}: {count} students")
            
            # Try to match with departments collection
            matched = False
            for d in departments:
                if d['name'].lower() == dept_name.lower() or \
                   dept_name.lower() in d['name'].lower() or \
                   d['name'].lower() in dept_name.lower():
                    print(f"  ✓ Matched to department ID: {d['_id']}")
                    matched = True
                    break
            
            if not matched:
                print(f"  ✗ No match found in departments collection")
        
        print("\n" + "=" * 80)
        print("ISSUE SUMMARY:")
        print("=" * 80)
        print("1. Students have 'department' field with actual department names")
        print("2. Students have 'department_id' field with numeric IDs (NOT department references)")
        print("3. Departments collection has string IDs that don't match student department_ids")
        print("4. The dashboard queries by 'department_id' which doesn't have correct references")
        print("\nSOLUTION:")
        print("Update the _count_by_department() function to use 'department' field")
        print("or properly populate 'department_id' field in students collection")
        print("=" * 80)
        
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_report()
