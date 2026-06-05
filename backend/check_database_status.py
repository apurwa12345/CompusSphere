"""Check MongoDB connection and database status"""
from pymongo import MongoClient
from config import Config

def check_database():
    try:
        print("=" * 80)
        print("MONGODB CONNECTION STATUS")
        print("=" * 80)
        
        print(f"\nConnecting to: {Config.MONGO_URI[:80]}...")
        client = MongoClient(Config.MONGO_URI)
        
        # Test connection
        client.admin.command('ping')
        print("✓ Connection successful")
        
        # Get database
        db = client.get_database()
        print(f"✓ Connected to database: {db.name}")
        
        # List all collections
        collections = db.list_collection_names()
        print(f"\nCollections in '{db.name}':")
        for coll in collections:
            count = db[coll].count_documents({})
            print(f"  - {coll}: {count} documents")
        
        # If departments and students exist, show details
        if 'departments' in collections:
            print("\n--- DEPARTMENTS ---")
            departments = list(db.departments.find({}))
            print(f"Total: {len(departments)}")
            for d in departments[:5]:
                print(f"  {d.get('name')} (ID: {d['_id']})")
        
        if 'students' in collections:
            print("\n--- STUDENTS ---")
            students_count = db.students.count_documents({})
            print(f"Total: {students_count}")
            if students_count > 0:
                sample = db.students.find_one({})
                print(f"Sample student keys: {list(sample.keys())}")
                print(f"  Name: {sample.get('name')}")
                print(f"  Department ID: {sample.get('department_id')}")
                print(f"  Email: {sample.get('email')}")
        
        # Check if this is a test/demo database
        print("\n--- DATABASE ANALYSIS ---")
        if not collections or db.students.count_documents({}) == 0:
            print("⚠ Database appears to be EMPTY or contains no student data")
            print("✗ The 'Department-wise Result Analysis' cannot display data without students")
            print("\nSuggestions:")
            print("1. Run a data seeding script to populate the database")
            print("2. Check if you're connected to the correct database/cluster")
            print("3. Verify that departments and students have been imported")
        else:
            print("✓ Database contains data")
        
        client.close()
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_database()
