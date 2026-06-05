import os
import tempfile
import urllib.error
import urllib.request
from datetime import datetime

import qrcode
from fpdf import FPDF
from PIL import Image


def generate_qr_code(data, filepath):
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    img.save(filepath)
    return filepath


def _safe_text(value, default=""):
    if value is None:
        return default
    text = str(value)
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.encode("latin-1", "ignore").decode("latin-1")


def _format_date(value):
    if not value:
        return ""
    raw = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return _safe_text(raw)


def _download_image(source, prefix):
    if not source:
        return None
    source = str(source).strip()
    if not source:
        return None
    if os.path.exists(source):
        return source
    if not source.startswith(("http://", "https://")):
        return None
    try:
        suffix = os.path.splitext(source.split("?")[0])[1] or ".jpg"
        fd, temp_path = tempfile.mkstemp(prefix=prefix, suffix=suffix)
        os.close(fd)
        urllib.request.urlretrieve(source, temp_path)
        return temp_path
    except (urllib.error.URLError, ValueError):
        return None


class HallTicketPDF(FPDF):
    def header(self):
        pass

    def footer(self):
        pass


def _line_count(pdf, width, text):
    normalized = _safe_text(text, "-") or "-"
    text_width = max(pdf.get_string_width(normalized), 1)
    usable_width = max(width - 2, 1)
    return max(1, int(text_width / usable_width) + 1)


def _table_cell(pdf, width, height, text, align="L", bold=False):
    x = pdf.get_x()
    y = pdf.get_y()
    pdf.rect(x, y, width, height)
    pdf.set_font("Helvetica", "B" if bold else "", 8)
    pdf.set_xy(x + 1, y + 1.5)
    pdf.multi_cell(width - 2, 4, _safe_text(text, "-"), border=0, align=align)
    pdf.set_xy(x + width, y)


def _subject_row_height(pdf, subject, widths):
    counts = [
        _line_count(pdf, widths[0], subject.get("subject_code", "-")),
        _line_count(pdf, widths[1], subject.get("subject_name", "-")),
        _line_count(pdf, widths[2], _format_date(subject.get("exam_date")) or "-"),
        _line_count(pdf, widths[3], subject.get("exam_time", "-")),
    ]
    return max(12, max(counts) * 4)


def create_hall_ticket_pdf(hall_ticket_data, output_path):
    pdf = HallTicketPDF("P", "mm", "A4")
    pdf.set_auto_page_break(auto=False)
    pdf.set_margins(10, 10, 10)
    pdf.add_page()

    logo_path = hall_ticket_data.get("college_logo_path")
    photo_path = _download_image(hall_ticket_data.get("student_photo_url"), "hall_ticket_photo_")
    qr_path = generate_qr_code(
        hall_ticket_data.get("hall_ticket_number", hall_ticket_data.get("hall_ticket_id", "")),
        os.path.join(os.path.dirname(output_path), f"{hall_ticket_data.get('hall_ticket_number', 'hall-ticket')}_qr.png"),
    )

    x0 = 10
    page_width = 190

    pdf.set_draw_color(40, 40, 40)
    pdf.set_line_width(0.45)
    pdf.rect(x0, 10, page_width, 277)

    pdf.rect(x0, 10, 190, 22)
    pdf.rect(x0, 10, 22, 22)
    pdf.rect(170, 10, 30, 22)

    if logo_path and os.path.exists(logo_path):
        pdf.image(logo_path, x=12, y=12, w=18, h=18)
    else:
        pdf.set_xy(10, 10)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(22, 22, "LOGO", border=1, align="C")

    if photo_path and os.path.exists(photo_path):
        try:
            Image.open(photo_path).close()
            pdf.image(photo_path, x=172, y=12, w=26, h=18)
        except Exception:
            pdf.set_xy(170, 10)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(30, 22, "PHOTO", border=1, align="C")
    else:
        pdf.set_xy(170, 10)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(30, 22, "PHOTO", border=1, align="C")

    pdf.set_xy(32, 11)
    pdf.set_font("Helvetica", "B", 12)
    pdf.multi_cell(138, 5, _safe_text(hall_ticket_data.get("university_name")), align="C")
    pdf.set_xy(32, 20)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.cell(138, 4.5, _safe_text(hall_ticket_data.get("header_subtitle", "")), align="C")
    pdf.set_xy(32, 24.5)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(138, 4.5, "EXAMINATION HALL TICKET", align="C")

    info_top = 32
    row_h = 8
    widths = [34, 75, 22, 59]
    rows = [
        [("Degree/Semester", hall_ticket_data.get("degree_semester")), ("Medium", hall_ticket_data.get("medium"))],
        [("Hall Ticket No", hall_ticket_data.get("hall_ticket_number")), ("", "")],
        [("College Name", hall_ticket_data.get("college_name")), ("", "")],
        [("Student Name", hall_ticket_data.get("student_name")), ("", "")],
        [("PRN Number", hall_ticket_data.get("prn")), ("Seat Number", hall_ticket_data.get("seat_number"))],
        [("Phone Number", hall_ticket_data.get("phone_number")), ("Email ID", hall_ticket_data.get("email_id"))],
        [("Exam Center Name/City", hall_ticket_data.get("exam_center")), ("", "")],
    ]

    y = info_top
    for row in rows:
        pdf.set_xy(x0, y)
        if row[0][0] in {"Hall Ticket No", "College Name", "Student Name", "Exam Center Name/City"}:
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(widths[0], row_h, row[0][0], border=1)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(sum(widths[1:]), row_h, _safe_text(row[0][1], "-"), border=1)
        else:
            for index, (label, value) in enumerate(row):
                if not label and not value:
                    continue
                pdf.set_font("Helvetica", "B", 8)
                pdf.cell(widths[index * 2], row_h, label, border=1)
                pdf.set_font("Helvetica", "", 8)
                pdf.cell(widths[index * 2 + 1], row_h, _safe_text(value, "-"), border=1)
        y += row_h

    y += 2
    header_height = 10
    col_widths = [28, 62, 24, 26, 25, 25]
    headers = ["Subject Code", "Subject Name", "Exam Date", "Exam Time", "Student Signature", "Supervisor Signature"]
    pdf.set_xy(x0, y)
    pdf.set_font("Helvetica", "B", 8)
    for idx, header in enumerate(headers):
        pdf.multi_cell(col_widths[idx], header_height / 2, header, border=1, align="C", new_x="RIGHT", new_y="TOP", max_line_height=4)
    y += header_height

    for subject in hall_ticket_data.get("subjects", []):
        subject_row_height = _subject_row_height(pdf, subject, col_widths)
        pdf.set_xy(x0, y)
        start_y = y
        _table_cell(pdf, col_widths[0], subject_row_height, subject.get("subject_code", "-"), align="C")
        pdf.set_xy(x0 + col_widths[0], start_y)
        _table_cell(pdf, col_widths[1], subject_row_height, subject.get("subject_name", "-"))
        pdf.set_xy(x0 + col_widths[0] + col_widths[1], start_y)
        _table_cell(pdf, col_widths[2], subject_row_height, _format_date(subject.get("exam_date")) or "-", align="C")
        pdf.set_xy(x0 + col_widths[0] + col_widths[1] + col_widths[2], start_y)
        _table_cell(pdf, col_widths[3], subject_row_height, subject.get("exam_time", "-"), align="C")
        pdf.set_xy(x0 + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3], start_y)
        pdf.rect(pdf.get_x(), start_y, col_widths[4], subject_row_height)
        pdf.rect(pdf.get_x() + col_widths[4], start_y, col_widths[5], subject_row_height)
        y = start_y + subject_row_height

    qr_y = y + 6
    pdf.rect(x0, qr_y, 26, 26)
    pdf.image(qr_path, x=x0 + 1.5, y=qr_y + 1.5, w=23, h=23)

    pdf.rect(38, qr_y, 162, 42)
    pdf.set_xy(40, qr_y + 2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 5, "Important Instructions to Student")
    pdf.set_xy(40, qr_y + 8)
    pdf.set_font("Helvetica", "", 7.5)
    instructions = hall_ticket_data.get("instructions", [])
    for index, instruction in enumerate(instructions, start=1):
        pdf.multi_cell(156, 4.5, f"{index}. {instruction}")

    sign_y = qr_y + 56
    sign_w = 42
    gap = 32
    positions = [20, 20 + sign_w + gap, 20 + ((sign_w + gap) * 2)]
    labels = ["College Stamp", "Principal Sign", "Eligible Student"]
    values = hall_ticket_data.get("signature_labels", labels)
    
    # Try to load director's signature image
    director_sig_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "assets", "signatures", "director_signature.png")
    )
    
    for idx, x in enumerate(positions):
        # For Principal Sign (idx=1), try to embed signature image
        if idx == 1 and os.path.exists(director_sig_path):
            try:
                # Draw box for signature area
                pdf.rect(x, sign_y - 16, sign_w, 18)
                # Embed the signature image
                pdf.image(director_sig_path, x=x + 0.5, y=sign_y - 15.5, w=sign_w - 1, h=17)
            except Exception:
                # Fallback to empty line if image fails
                pdf.line(x, sign_y, x + sign_w, sign_y)
        elif idx == 2:
            pdf.set_draw_color(22, 163, 74)
            pdf.set_line_width(1.1)
            pdf.ellipse(x + 14, sign_y - 22, 14, 14)
            pdf.line(x + 17.5, sign_y - 15, x + 20.5, sign_y - 12)
            pdf.line(x + 20.5, sign_y - 12, x + 25, sign_y - 19)
            pdf.set_draw_color(0, 0, 0)
            pdf.set_line_width(0.2)
        else:
            # Draw empty line for other signatures
            pdf.line(x, sign_y, x + sign_w, sign_y)
        
        pdf.set_xy(x, sign_y + 2)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(sign_w, 4, values[idx] if idx < len(values) else labels[idx], align="C")

    footer_y = 280
    pdf.set_xy(10, footer_y)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(190, 4, "Note : Please bring this acknowledgement to the College / University in case of any query.")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf.output(output_path)
    return output_path

def calculate_grade(marks_obtained, total_marks=100):
    """
    Calculate B.Tech grade based on percentage.
    Scale: EX=10, AA=9, AB=8.5, BB=8, BC=7.5, CC=7, CD=6.5, DD=6, DE=5.5, EE=5, FF=0
    """
    percentage = (marks_obtained / total_marks) * 100
    if percentage >= 90: return 'EX', 10.0
    if percentage >= 80: return 'AA', 9.0
    if percentage >= 75: return 'AB', 8.5
    if percentage >= 70: return 'BB', 8.0
    if percentage >= 65: return 'BC', 7.5
    if percentage >= 60: return 'CC', 7.0
    if percentage >= 55: return 'CD', 6.5
    if percentage >= 50: return 'DD', 6.0
    if percentage >= 45: return 'DE', 5.5
    if percentage >= 40: return 'EE', 5.0
    return 'FF', 0.0

def calculate_sgpa(subject_marks):
    """
    subject_marks is a list of dicts: {'credits': float, 'grade_point': float}
    """
    def _to_f(v):
        try:
            if v is None or v == '': return 0.0
            return float(v)
        except: return 0.0

    total_credits = sum([_to_f(sub.get('credits', 0)) for sub in subject_marks])
    earned_points = sum([_to_f(sub.get('credits', 0)) * _to_f(sub.get('grade_point', 0)) for sub in subject_marks])
    
    if total_credits == 0: return 0.0
    return round(earned_points / total_credits, 2)

def calculate_cgpa(all_subject_marks):
    """
    Calculates CGPA across all semesters.
    all_subject_marks: flat list of all subjects taken in all semesters.
    """
    return calculate_sgpa(all_subject_marks)

def convert_cgpa_to_percentage(cgpa):
    """
    Formula: Percentage = (CGPA - 0.5) * 10
    """
    if not cgpa: return 0.0
    percentage = (float(cgpa) - 0.5) * 10
    return round(max(0.0, percentage), 2)

def paginate_query(collection, query, page=1, per_page=10, sort_by="_id", sort_order=1):
    """
    Utility for pagination and sorting across collections.
    Returns the items, total counts, and total pages.
    """
    total_items = collection.count_documents(query)
    total_pages = (total_items + per_page - 1) // per_page
    
    cursor = collection.find(query).sort(sort_by, sort_order).skip((page - 1) * per_page).limit(per_page)
    items = list(cursor)
    
    return {
        "items": items,
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": page,
        "per_page": per_page
    }

