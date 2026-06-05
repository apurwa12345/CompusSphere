import os
import pandas as pd
from pymongo import MongoClient
from bson.objectid import ObjectId
import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")

client = MongoClient(MONGO_URI)
db = client["student_management"]

# Map collections to their corresponding CSV export files
FILES_TO_IMPORT = {
    "users": "users_export.csv",
    "students": "students_export.csv",
    "departments": "departments_export.csv",
    "subjects": "subjects_export.csv",
    "audit_logs": "audit_logs_export.csv"
}

# The fields we expect to be ObjectIds (some might be missing from some CSVs)
OID_FIELDS = ["_id", "department_id", "course_id", "subject_id", "student_id", "exam_id", "user_id"]

# Fields to cast to datetime (if present)
DATE_FIELDS = ["created_at", "updated_at", "start_date", "end_date", "timestamp"]

def convert_types(row):
    """
    Given a pandas Series row (converted to a dict), cast IDs to ObjectId
    and dates to datetime. Returns a cleaned dictionary.
    """
    row_dict = row.dropna().to_dict()
    new_doc = {}
    for k, v in row_dict.items():
        if k in OID_FIELDS and isinstance(v, str):
            try:
                if len(v.strip()) == 24:
                    new_doc[k] = ObjectId(v.strip())
                else:
                    new_doc[k] = str(v).strip()
            except Exception:
                new_doc[k] = str(v).strip()
        elif k in DATE_FIELDS and isinstance(v, str):
            try:
                # pandas datetime strings can be cast this way.
                new_doc[k] = pd.to_datetime(v).to_pydatetime()
            except:
                new_doc[k] = v
        else:
            new_doc[k] = v
    return new_doc

print("Starting import of real data from CSV files...")

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

for col_name, file_name in FILES_TO_IMPORT.items():
    file_path = os.path.join(base_dir, file_name)
    
    if os.path.exists(file_path):
        print(f"\\nProcessing {file_name} into collection '{col_name}'...")
        
        # Optionally wipe existing collection so we have exactly the real data
        db[col_name].delete_many({})
        print(f"Cleared existing '{col_name}' collection.")
        
        try:
            # Read CSV
            # Read all columns as strings to preserve IDs like PRN/enrollment numbers
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
            
            if df.empty:
                print(f"{file_name} is empty. Skipping.")
                continue
            
            # Convert rows
            docs_to_insert = [convert_types(row) for _, row in df.iterrows()]
            
            if docs_to_insert:
                result = db[col_name].insert_many(docs_to_insert)
                print(f"Successfully inserted {len(result.inserted_ids)} documents into '{col_name}'.")
        except Exception as e:
            print(f"Error processing {file_name}: {e}")
    else:
        print(f"Warning: File {file_path} not found. Skipping.")

print("\\n✅ Database import completed!")
