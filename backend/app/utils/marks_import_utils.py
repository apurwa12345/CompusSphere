"""
Helpers for marks Excel import: normalize identifiers from spreadsheets
and resolve students when roll/PRN live on users vs students documents.
"""
import re

import numpy as np
import pandas as pd


def normalize_marks_import_identifier(val):
    """
    Turn spreadsheet cell values into stable strings for DB lookup.
    Fixes Excel/pandas reading integers as floats (e.g. 101.0 -> '101').
    """
    if val is None:
        return None
    if isinstance(val, str):
        s = val.strip()
        if not s or s.lower() == "nan":
            return None
        m = re.fullmatch(r"(\d+)\.0+", s)
        if m:
            return m.group(1)
        return s
    if isinstance(val, (bool, np.bool_)):
        return str(int(val))
    if isinstance(val, (int, np.integer)):
        return str(int(val))
    if isinstance(val, (float, np.floating)):
        if pd.isna(val):
            return None
        f = float(val)
        if not (f == f):  # NaN
            return None
        if abs(f - round(f)) < 1e-9:
            return str(int(round(f)))
        s = str(f).rstrip("0").rstrip(".")
        return s if s else None
    s = str(val).strip()
    return s if s and s.lower() != "nan" else None


def find_student_for_marks_import(db, roll_raw, enroll_raw):
    """
    Resolve a student for marks import using students first, then users
    (roll / enrollment_number) linked by email.
    """
    roll = normalize_marks_import_identifier(roll_raw)
    enroll = normalize_marks_import_identifier(enroll_raw)

    def _identifier_variants(value):
        """
        Build resilient variants for identifier lookups.
        Handles values stored as string/int and with/without leading zeros.
        """
        if not value:
            return [], None

        variants = [value]
        numeric = re.fullmatch(r"\d+", value) is not None
        stripped = value.lstrip("0") if numeric else value
        if numeric and stripped and stripped not in variants:
            variants.append(stripped)
        if numeric and value != "0" and "0" not in variants and stripped == "":
            variants.append("0")

        int_variant = None
        if numeric:
            try:
                int_variant = int(value)
            except ValueError:
                int_variant = None

        return variants, int_variant

    def _build_identifier_query(field, value):
        variants, int_variant = _identifier_variants(value)
        if not variants and int_variant is None:
            return None

        clauses = [{field: v} for v in variants]
        if int_variant is not None:
            clauses.append({field: int_variant})
            # Match DB strings that may have any number of leading zeros.
            clauses.append({field: {"$regex": f"^0*{int_variant}$"}})
        return {"$or": clauses} if len(clauses) > 1 else clauses[0]

    def _looks_generic_roll(value):
        """
        Ignore non-unique department-like roll values from sheets (e.g. CSE/IT).
        """
        if not value:
            return True
        token = str(value).strip().upper()
        if not token:
            return True
        generic_tokens = {
            "CSE", "IT", "AIML", "A&R", "AR", "MECH", "CIVIL", "E&TC", "ENTC",
            "--", "-", "NA", "N/A", "NULL"
        }
        if token in generic_tokens:
            return True
        # If value is very short and purely alphabetic, it is usually not a real roll no.
        if token.isalpha() and len(token) <= 5:
            return True
        return False

    student = None
    # Enrollment/PRN is usually unique and should be preferred when present.
    if enroll:
        enroll_query = _build_identifier_query("enrollment_no", enroll)
        student = db.students.find_one(enroll_query) if enroll_query else None
    if not student and enroll:
        prn_query = _build_identifier_query("prn", enroll)
        student = db.students.find_one(prn_query) if prn_query else None
    if not student and roll and not _looks_generic_roll(roll):
        roll_query = _build_identifier_query("roll_no", roll)
        student = db.students.find_one(roll_query) if roll_query else None

    if not student and roll and not _looks_generic_roll(roll):
        user_roll_query = _build_identifier_query("roll_no", roll)
        user_query = {"role": "Student"}
        if user_roll_query:
            user_query.update(user_roll_query)
        user = db.users.find_one(user_query)
        if user and user.get("email"):
            email = (user.get("email") or "").strip().lower()
            if email:
                student = db.students.find_one({"email": email})

    if not student and enroll:
        enrollment_number_query = _build_identifier_query("enrollment_number", enroll)
        prn_query = _build_identifier_query("prn", enroll)
        or_clauses = []
        if enrollment_number_query:
            if "$or" in enrollment_number_query:
                or_clauses.extend(enrollment_number_query["$or"])
            else:
                or_clauses.append(enrollment_number_query)
        if prn_query:
            if "$or" in prn_query:
                or_clauses.extend(prn_query["$or"])
            else:
                or_clauses.append(prn_query)

        user = db.users.find_one(
            {"role": "Student", "$or": or_clauses} if or_clauses else {"role": "Student"}
        )
        if user and user.get("email"):
            email = (user.get("email") or "").strip().lower()
            if email:
                student = db.students.find_one({"email": email})

    return student
