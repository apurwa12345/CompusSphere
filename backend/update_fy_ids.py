import os
import pandas as pd
from pymongo import MongoClient
from bson.objectid import ObjectId

EXCEL_PATH = r"C:\Users\91997\OneDrive\Desktop\PHASE_2\New FY-PRN List 25-26.xlsx"
MONGO_URI = os.environ.get("MONGO_URI") or "mongodb+srv://ashaikh49096_db_user:<db_password>@cluster0.a5iwugk.mongodb.net/?appName=Cluster0"

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

    dep_cache = {}
    for d in db.departments.find({}, {"_id": 1, "name": 1}):
        dep_cache[d["name"].lower()] = d["_id"]

    updated_users = 0
    updated_students = 0

    for _, row in df.iterrows():
        email = str(row.get("email") or "").strip().lower()
        if not email:
            continue
        prn = str(row.get("prn") or "").strip()
        erp_id = str(row.get("erp_id") or "").strip()

        user_update = {
            "prn": prn,
            "department_id": erp_id
        }
        u_res = db.users.update_one({"email": email}, {"$set": user_update})
        if u_res.modified_count:
            updated_users += 1

        s_update = {
            "enrollment_no": prn,
            "department_id": erp_id
        }
        s_res = db.students.update_one({"email": email}, {"$set": s_update})
        if s_res.modified_count:
            updated_students += 1

    print(f"Users updated: {updated_users}")
    print(f"Students updated: {updated_students}")

if __name__ == "__main__":
    main()
