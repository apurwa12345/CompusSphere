import importlib.util
from pathlib import Path

import pandas as pd
import re
import io

from app.utils.marks_import_utils import normalize_marks_import_identifier

EXCEL_CSV_ENCODINGS = ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']


def normalize_column_name(name):
    if not name or pd.isna(name):
        return ""
    # Remove special chars, spaces, and lowercase
    return re.sub(r'[^a-z0-9]', '', str(name).lower())


def _module_available(module_name):
    return importlib.util.find_spec(module_name) is not None


def _read_excel(stream, filename):
    stream.seek(0)
    ext = Path(filename).suffix.lower() if filename else ''
    engine = None

    if ext in ['.xlsx', '.xlsm'] and _module_available('openpyxl'):
        engine = 'openpyxl'
    elif ext == '.xls' and _module_available('xlrd'):
        engine = 'xlrd'
    elif ext == '.xlsb' and _module_available('pyxlsb'):
        engine = 'pyxlsb'

    if engine:
        return pd.read_excel(stream, header=None, engine=engine)

    return pd.read_excel(stream, header=None)


def _read_csv_with_encodings(stream):
    last_error = None
    for encoding in EXCEL_CSV_ENCODINGS:
        try:
            stream.seek(0)
            return pd.read_csv(stream, header=None, encoding=encoding, engine='python')
        except Exception as err:
            last_error = err
    raise last_error or ValueError('Unable to decode CSV with supported encodings.')


def process_marks_excel(file_storage):
    """
    Reads an Excel or CSV file, identifies the header row,
    maps columns, and returns cleaned records plus metadata.
    """
    try:
        stream = file_storage.stream if hasattr(file_storage, 'stream') else file_storage
        filename = getattr(file_storage, 'filename', '') or ''
        ext = Path(filename).suffix.lower()

        df_raw = None
        excel_error = None
        csv_error = None

        if ext in ['.xls', '.xlsx', '.xlsm', '.xlsb']:
            try:
                df_raw = _read_excel(stream, filename)
            except Exception as err:
                excel_error = err
        elif ext in ['.csv', '.txt']:
            try:
                df_raw = _read_csv_with_encodings(stream)
            except Exception as err:
                csv_error = err
        else:
            try:
                df_raw = _read_excel(stream, filename)
            except Exception as err:
                excel_error = err

        if df_raw is None:
            try:
                df_raw = _read_csv_with_encodings(stream)
            except Exception as err:
                csv_error = err

        if df_raw is None or df_raw.empty:
            if df_raw is None:
                error_message = None
                if excel_error:
                    error_message = str(excel_error)
                elif csv_error:
                    error_message = str(csv_error)
                else:
                    error_message = 'Could not parse the uploaded file.'
                return [], None, f"Error processing file: {error_message}"
            return [], None, "The file is empty."

        # Extract metadata (Subject, Class, Exam Type) from the top rows
        metadata = {}
        for i in range(min(6, len(df_raw))):
            row = df_raw.iloc[i]
            for col_idx, val in enumerate(row):
                val_str = str(val).lower()
                if 'subject' in val_str:
                    if ':' in str(val):
                        metadata['subject'] = str(val).split(':', 1)[1].strip()
                    elif col_idx + 1 < len(row):
                        metadata['subject'] = str(row[col_idx + 1]).strip()
                elif 'class' in val_str:
                    if ':' in str(val):
                        metadata['class'] = str(val).split(':', 1)[1].strip()
                    elif col_idx + 1 < len(row):
                        metadata['class'] = str(row[col_idx + 1]).strip()
                elif 'exam type' in val_str:
                    if ':' in str(val):
                        metadata['exam_type'] = str(val).split(':', 1)[1].strip()
                    elif col_idx + 1 < len(row):
                        metadata['exam_type'] = str(row[col_idx + 1]).strip()

        # Define target column mapping (normalized)
        target_map = {
            'rollno': 'roll_no',
            'enrollmentid': 'enrollment_no',
            'enrollmentno': 'enrollment_no',
            'prn': 'enrollment_no',
            'usn': 'enrollment_no',
            'obtainedmarks': 'marks',
            'marks': 'marks',
            'status': 'status',
            'remarks': 'remarks',
            'remark': 'remarks'
        }

        # 1. Find the header row by looking for key identifiers
        header_idx = -1
        col_mapping = {}
        
        for i, row in df_raw.iterrows():
            row_normalized = [normalize_column_name(c) for c in row]
            
            # Look for matching columns
            matches = {}
            for col_idx, val in enumerate(row_normalized):
                if not val: continue
                
                # Check for exact matches first
                for target_key, target_field in target_map.items():
                    if val == target_key:
                        matches[target_field] = col_idx
                
                # If no exact match, check if target_key is a significant part of val
                # but avoid matching 'marks' in 'remarks'
                if 'marks' not in matches:
                    if (
                        'obtainedmarks' in val
                        or ('marks' in val and 'remark' not in val)
                        or 'totalmarks' in val
                        or 'marksobtained' in val
                        or 'grandtotal' in val
                        or 'internalmarks' in val
                        or 'externalmarks' in val
                        or val == 'total'
                        or val == 'score'
                    ):
                        matches['marks'] = col_idx
                
                if 'roll_no' not in matches:
                    if (
                        'rollno' in val
                        or 'rollnumber' in val
                        or val == 'seatno'
                        or 'seatnumber' in val
                    ):
                        matches['roll_no'] = col_idx
                        
                if 'enrollment_no' not in matches:
                    if (
                        'enrollmentid' in val
                        or 'enrollmentno' in val
                        or 'prn' in val
                        or val == 'usn'
                        or 'registrationno' in val
                        or 'registerno' in val
                        or 'universityprn' in val
                    ):
                        matches['enrollment_no'] = col_idx
            
            # If we found enough identifying columns, this is the header
            if ('roll_no' in matches or 'enrollment_no' in matches) and 'marks' in matches:
                header_idx = i
                col_mapping = matches
                print(f"[DEBUG] Detected header at row {i+1}. Mapping: {col_mapping}")
                break
        
        if header_idx == -1:
            return [], metadata, "Could not identify header row. Ensure 'Roll No' and 'Marks' columns exist."

        # 2. Extract data starting from row after header
        data_rows = []
        for i in range(header_idx + 1, len(df_raw)):
            row = df_raw.iloc[i]
            
            record = {}
            for field, col_idx in col_mapping.items():
                val = row[col_idx]

                # Clean value
                if pd.isna(val) or str(val).strip() == '':
                    record[field] = None
                elif field in ("roll_no", "enrollment_no"):
                    record[field] = normalize_marks_import_identifier(val)
                else:
                    record[field] = str(val).strip()
            
            # Skip empty rows (where both roll and enrollment are missing)
            if not record.get('roll_no') and not record.get('enrollment_no'):
                continue
                
            # Type conversion and Absent detection for marks
            marks_val = record.get('marks')
            status_val = str(record.get('status') or '').strip().upper()
            
            # Check if marks or status indicate absent
            is_absent = False
            if marks_val:
                marks_raw = str(marks_val).strip().upper()
                if marks_raw in ['A', 'AB', 'ABS', 'ABSENT']:
                    is_absent = True
            
            if status_val in ['A', 'AB', 'ABS', 'ABSENT']:
                is_absent = True
                
            if is_absent:
                record['marks'] = 0.0
                record['status'] = 'ABSENT'
            else:
                if marks_val is not None:
                    try:
                        # Remove any non-numeric chars except .
                        marks_str = re.sub(r'[^0-9.]', '', str(marks_val))
                        record['marks'] = float(marks_str) if marks_str else 0.0
                    except ValueError:
                        record['marks'] = 0.0
                else:
                    record['marks'] = 0.0
                
            data_rows.append(record)

        return data_rows, metadata, None

    except Exception as e:
        return [], None, f"Error processing file: {str(e)}"
