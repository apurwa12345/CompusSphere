import os
import re
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

EXCEL_PATH = r"C:\Users\91997\Downloads\subject codes.xlsx"
MONGO_URI = os.environ.get("MONGO_URI") or "mongodb+srv://ashaikh49096_db_user:<db_password>@cluster0.a5iwugk.mongodb.net/?appName=Cluster0"

def find_header_row(df):
    for i in range(min(len(df), 20)):
        row = df.iloc[i].astype(str).str.lower()
        if row.str.contains("course code").any() and row.str.contains("course title").any():
            return i
    return None

def detect_semester(text):
    if not text:
        return None
    s = str(text).lower()
    if "semester i" in s:
        return 1
    if "semester ii" in s:
        return 2
    if "semester iii" in s:
        return 3
    if "semester iv" in s:
        return 4
    if "semester v" in s:
        return 5
    if "semester vi" in s:
        return 6
    if "semester vii" in s:
        return 7
    if "semester viii" in s:
        return 8
    return None

def main():
    df_raw = pd.read_excel(EXCEL_PATH, header=None)
    header_idx = find_header_row(df_raw)
    if header_idx is None:
        raise ValueError("Header row with Course Code/Title not found.")

    df = pd.read_excel(EXCEL_PATH, header=header_idx)
    df.columns = [str(c).strip() for c in df.columns]

    # Normalize column names
    rename_map = {}
    for c in df.columns:
        lc = c.lower()
        if "course category" in lc:
            rename_map[c] = "category"
        elif "course code" in lc:
            rename_map[c] = "code"
        elif "course title" in lc:
            rename_map[c] = "title"
        elif lc.strip() == "l":
            rename_map[c] = "l"
        elif lc.strip() == "t":
            rename_map[c] = "t"
        elif lc.strip() == "p":
            rename_map[c] = "p"
        elif lc.strip() == "ca":
            rename_map[c] = "ca"
        elif lc.strip() == "mse":
            rename_map[c] = "mse"
        elif lc.strip() == "ese":
            rename_map[c] = "ese"
        elif "total" == lc.strip():
            rename_map[c] = "total"
        elif "credit" in lc:
            rename_map[c] = "credits"
        elif "semester" in lc:
            rename_map[c] = "semester"

    df = df.rename(columns=rename_map)
    df = df.dropna(how="all")

    client = MongoClient(MONGO_URI)
    db = client.get_default_database()

    current_sem = None
    inserted = 0
    updated = 0

    for _, row in df.iterrows():
        # detect semester markers in any cell
        sem = None
        for v in row.values:
            sem = detect_semester(v)
            if sem:
                break
        if sem:
            current_sem = sem

        code = str(row.get("code") or "").strip()
        title = str(row.get("title") or "").strip()
        if not code or not title or code.lower() in ["nan", "none"]:
            continue

        category = str(row.get("category") or "").strip()
        credits = row.get("credits")
        try:
            credits = int(credits)
        except Exception:
            credits = None

        subject_doc = {
            "name": title,
            "code": code,
            "semester": current_sem,
            "credits": credits,
            "type": category or "Theory",
            "l": row.get("l"),
            "t": row.get("t"),
            "p": row.get("p"),
            "ca": row.get("ca"),
            "mse": row.get("mse"),
            "ese": row.get("ese"),
            "total": row.get("total")
        }

        result = db.subjects.update_one(
            {"code": code},
            {"$set": subject_doc},
            upsert=True
        )
        if result.upserted_id:
            inserted += 1
        else:
            updated += 1

    print(f"Subjects inserted: {inserted}, updated: {updated}")

if __name__ == "__main__":
    main()
