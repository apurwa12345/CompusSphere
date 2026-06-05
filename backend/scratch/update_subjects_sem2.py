import os
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Define the exact categorized subject data based on the official DBATU/NEP syllabus
categorized_data = [
    {
        "code": "24AF1000BS201",
        "name": "Engineering Mathematics – II",
        "credits": "3.0",
        "semester": "2",
        "l": "3",
        "t": "0",
        "p": "0",
        "ca": "20",
        "mse": "20",
        "ese": "60",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1PHYBS202",
        "name": "Engineering Physics",
        "credits": "3.0",
        "semester": "2",
        "l": "3",
        "t": "0",
        "p": "0",
        "ca": "20",
        "mse": "20",
        "ese": "60",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1PHYBSL203",
        "name": "Engineering Physics Lab",
        "credits": "1.0",
        "semester": "2",
        "l": "0",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Practical Lab"
    },
    {
        "code": "24AF1EGES204",
        "name": "Engineering Graphics",
        "credits": "2.0",
        "semester": "2",
        "l": "2",
        "t": "0",
        "p": "0",
        "ca": "20",
        "mse": "20",
        "ese": "60",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1EGESL205",
        "name": "Engineering Graphics Lab",
        "credits": "1.0",
        "semester": "2",
        "l": "0",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Practical Lab"
    },
    {
        "code": "24AF1000ES206A",
        "name": "Basic Electrical and Electronics Engineering",
        "credits": "3.0",
        "semester": "2",
        "l": "3",
        "t": "0",
        "p": "0",
        "ca": "20",
        "mse": "20",
        "ese": "60",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1000ESL207A",
        "name": "Basic Electrical and Electronics Engineering Lab",
        "credits": "1.0",
        "semester": "2",
        "l": "0",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Practical Lab"
    },
    {
        "code": "24AF1000ES208",
        "name": "Basic Civil and Mechanical Engineering",
        "credits": "3.0",
        "semester": "2",
        "l": "3",
        "t": "0",
        "p": "0",
        "ca": "20",
        "mse": "20",
        "ese": "60",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1EEEES209",
        "name": "Energy and Environmental Engineering",
        "credits": "",
        "semester": "2",
        "l": "2",
        "t": "0",
        "p": "0",
        "ca": "50",
        "mse": "",
        "ese": "",
        "total": "50",
        "type": "Theory"
    },
    {
        "code": "24AF1000IKS210",
        "name": "IKS Bucket #",
        "credits": "2.0",
        "semester": "2",
        "l": "2",
        "t": "0",
        "p": "0",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1000VS211",
        "name": "Design Thinking",
        "credits": "2.0",
        "semester": "2",
        "l": "2",
        "t": "0",
        "p": "0",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1000CC212A",
        "name": "A. Integrated Personality Development",
        "credits": "2.0",
        "semester": "2",
        "l": "1",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1000CC212B",
        "name": "B. NSS-II",
        "credits": "",
        "semester": "2",
        "l": "1",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Theory"
    },
    {
        "code": "24AF1000CC212C",
        "name": "C. Health and Wellness",
        "credits": "",
        "semester": "2",
        "l": "1",
        "t": "0",
        "p": "2",
        "ca": "60",
        "mse": "",
        "ese": "40",
        "total": "100",
        "type": "Theory"
    }
]

# 1. Update subject_export2.csv
export2_df = pd.DataFrame(categorized_data)
# Reorder columns to match the header: ca,code,credits,ese,l,mse,name,p,semester,t,total,type
columns_order = ["ca", "code", "credits", "ese", "l", "mse", "name", "p", "semester", "t", "total", "type"]
export2_df = export2_df[columns_order]
export2_path = "../subject_export2.csv"
export2_df.to_csv(export2_path, index=False)
print("Updated subject_export2.csv successfully!")

# 2. Update subjects_export.csv
export_path = "../subjects_export.csv"
if os.path.exists(export_path):
    export_df = pd.read_csv(export_path, dtype=str, keep_default_na=False)
    for s in categorized_data:
        code = s["code"]
        # check if this code exists in export_df
        idx = export_df[export_df["code"] == code].index
        if len(idx) > 0:
            for col in columns_order:
                export_df.loc[idx, col] = s[col]
        else:
            # append new row
            new_row = {col: s[col] for col in columns_order}
            export_df = pd.concat([export_df, pd.DataFrame([new_row])], ignore_index=True)
    export_df.to_csv(export_path, index=False)
    print("Updated subjects_export.csv successfully!")

# 3. Update MongoDB
mongo_uri = os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
client = MongoClient(mongo_uri)
db = client["student_management"]

updated_count = 0
for s in categorized_data:
    code = s["code"]
    res = db.subjects.update_one(
        {"code": code},
        {"$set": {
            "ca": s["ca"],
            "credits": s["credits"],
            "ese": s["ese"],
            "l": s["l"],
            "mse": s["mse"],
            "name": s["name"],
            "p": s["p"],
            "semester": s["semester"],
            "t": s["t"],
            "total": s["total"],
            "type": s["type"]
        }},
        upsert=True
    )
    if res.modified_count > 0 or res.upserted_id:
        updated_count += 1

print(f"MongoDB subjects updated: {updated_count}")
