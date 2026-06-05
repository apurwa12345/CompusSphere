import os
import re
import datetime
import pandas as pd
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

EXCEL_PATH = r"C:\Users\91997\OneDrive\Desktop\PHASE_2\New FY-PRN List 25-26.xlsx"
MONGO_URI = os.environ.get("MONGO_URI") or "mongodb+srv://ashaikh49096_db_user:<db_password>@cluster0.a5iwugk.mongodb.net/?appName=Cluster0"
DEFAULT_PASSWORD = "Student@123"

ROMAN_MAP = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8
}

def parse_semester(value):
    if not value:
        return None
    s = str(value).strip()
    # match digits
    m = re.search(r"(\d+)", s)
    if m:
        return int(m.group(1))
    # match roman numerals
    m = re.search(r"Semester[-\s]*([IVX]+)", s, re.IGNORECASE)
    if m:
        roman = m.group(1).upper()
        return ROMAN_MAP.get(roman)
    return None

def find_header_row(df):
    for i in range(min(len(df), 10)):
        row = df.iloc[i].astype(str).str.strip().str.lower()
        if "group" in row.values and "student name" in row.values and "student off. email id" in row.values:
            return i
    return None

def main():
    df_raw = pd.read_excel(EXCEL_PATH, header=None)
    header_idx = find_header_row(df_raw)
    if header_idx is None:
        raise ValueError("Header row not found in the Excel file.")

    df = pd.read_excel(EXCEL_PATH, header=header_idx)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")

    col_map = {
        "Group": "group",
        "Branch": "branch",
        "Roll No": "roll_no",
        "ERP_ID": "erp_id",
        "Student Name": "name",
        "PRN": "prn",
        "Branch Name": "branch_name",
        "Semester": "semester",
        "Student Off. Email ID": "email",
        "Student Mobile No.": "mobile",
        "Gender": "gender",
        "Year": "year",
        "ABC ID": "abc_id"
    }

    df = df.rename(columns=col_map)
    df = df[list(col_map.values())]

    client = MongoClient(MONGO_URI)
    db = client.get_default_database()

    # Ensure departments exist
    dep_cache = {}
    for _, row in df.iterrows():
        dep_name = str(row.get("branch_name") or row.get("branch") or "").strip()
        dep_code = str(row.get("branch") or "").strip()
        if not dep_name:
            continue
        dep_key = dep_name.lower()
        if dep_key in dep_cache:
            continue
        existing = db.departments.find_one({"name": dep_name})
        if existing:
            dep_cache[dep_key] = existing["_id"]
        else:
            dep_id = db.departments.insert_one({"name": dep_name, "code": dep_code}).inserted_id
            dep_cache[dep_key] = dep_id

    inserted_users = 0
    updated_users = 0
    inserted_students = 0
    updated_students = 0

    hashed_pw = generate_password_hash(DEFAULT_PASSWORD)

    for _, row in df.iterrows():
        email = str(row.get("email") or "").strip().lower()
        if not email:
            continue
        name = str(row.get("name") or "").strip()
        mobile = str(row.get("mobile") or "").strip()
        gender = str(row.get("gender") or "").strip()
        branch_name = str(row.get("branch_name") or row.get("branch") or "").strip()
        year = str(row.get("year") or "").strip()
        prn = str(row.get("prn") or "").strip()
        roll_no = str(row.get("roll_no") or "").strip()
        group = str(row.get("group") or "").strip()
        semester = parse_semester(row.get("semester"))
        abc_id = str(row.get("abc_id") or "").strip()

        department_id = dep_cache.get(branch_name.lower()) if branch_name else None

        user_update = {
            "email": email,
            "name": name,
            "role": "Student",
            "mobile": mobile,
            "phone": mobile,
            "gender": gender,
            "department": branch_name,
            "enrollment_number": prn,
            "year": year,
            "roll_no": roll_no,
            "group": group,
            "abc_id": abc_id
        }

        result = db.users.update_one(
            {"email": email},
            {"$set": user_update, "$setOnInsert": {"password": hashed_pw, "created_at": datetime.datetime.utcnow()}},
            upsert=True
        )
        if result.upserted_id:
            inserted_users += 1
        else:
            updated_users += 1

        student_update = {
            "name": name,
            "email": email,
            "enrollment_no": prn,
            "department_id": department_id or branch_name,
            "current_semester": semester,
            "batch_year": year,
            "abc_id": abc_id
        }

        s_result = db.students.update_one(
            {"email": email},
            {"$set": student_update, "$setOnInsert": {"created_at": datetime.datetime.utcnow()}},
            upsert=True
        )
        if s_result.upserted_id:
            inserted_students += 1
        else:
            updated_students += 1

    print(f"Users inserted: {inserted_users}, updated: {updated_users}")
    print(f"Students inserted: {inserted_students}, updated: {updated_students}")

if __name__ == "__main__":
    main()
