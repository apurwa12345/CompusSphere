import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

# Connect to MongoDB
mongo_uri = os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
client = pymongo.MongoClient(mongo_uri)
db = client["student_management"]

# Exact 13 correct Semester 1 codes provided by the user
correct_sem1_codes = [
    "24AF1000BS101",
    "24AF1CHEBS102",
    "24AF1CHEBSL103",
    "24AF1EMES104",
    "24AF1EMESL105",
    "24AF1000ES106A",
    "24AF1000ESL107A",
    "24AF1000VSL108",
    "24AF1000VS109",
    "24AF1000VSL110",
    "24AF1000CC111A",
    "24AF1000CC111B",
    "24AF1000CC111C"
]

print("Starting clean up of Semester 1 subjects in MongoDB...")

# Find and delete all Semester 1 subjects NOT in the user's correct list
query = {
    "semester": "1",
    "code": {"$nin": correct_sem1_codes}
}

matched_subjects = list(db.subjects.find(query))
print(f"Found {len(matched_subjects)} extra subjects in Semester 1.")
for s in matched_subjects:
    print(f" -> Deleting: {s.get('code')} - {s.get('name')}")

if matched_subjects:
    res = db.subjects.delete_many(query)
    print(f"Successfully deleted {res.deleted_count} extra subjects from MongoDB!")
else:
    print("No extra subjects found to delete.")
