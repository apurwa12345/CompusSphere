import base64
import datetime
import io
import mimetypes
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mongo
from app.utils.decorators import role_required
from bson.objectid import ObjectId
from typing import cast
from pymongo.database import Database

accountant_bp = Blueprint('accountant', __name__)

# Cast to avoid type checker issues
db = cast(Database, mongo.db)

TOTAL_FEES = 100000
CATEGORY_WISE_FEES = {
    'GENERAL': 100000,
    'OPEN': 100000,
    'OBC': 60000,
    'SC': 10000,
    'ST': 5000,
    'EWS': 90000,
    'TFWS': 20000
}


def _safe_oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return value


def _serialize_submission(submission, include_receipt=False):
    submission['_id'] = str(submission['_id'])
    submission['student_id'] = str(submission.get('student_id', ''))
    
    # Try multiple field names for timestamps
    created_at = submission.get('created_at') or submission.get('createdAt') or submission.get('applied_on')
    verified_at = submission.get('verified_at') or submission.get('verifiedAt')
    
    # If they are strings already, keep them; if they are datetime, convert to ISO
    if created_at:
        submission['created_at'] = created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at
    if verified_at:
        submission['verified_at'] = verified_at.isoformat() if hasattr(verified_at, 'isoformat') else verified_at
        
    if not include_receipt:
        submission.pop('receipt_data', None)
    return submission


def _fee_amount_for_category(category):
    key = (category or '').strip().upper()
    return CATEGORY_WISE_FEES.get(key, TOTAL_FEES)


def _build_department_maps():
    departments = list(db.departments.find({}))
    by_id = {}
    by_code = {}
    by_name = {}
    for dept in departments:
        dept_id = str(dept.get('_id'))
        code = (dept.get('code') or '').strip().upper()
        name = (dept.get('name') or '').strip()
        payload = {'department_id': dept_id, 'department_code': code, 'department_name': name}
        if dept_id:
            by_id[dept_id] = payload
        if code:
            by_code[code] = payload
        if name:
            by_name[name.strip().lower()] = payload
    return by_id, by_code, by_name


def _resolve_department(student, by_id, by_code, by_name, user_data=None):
    dept_id = str(student.get('department_id', '') or '').strip()
    if dept_id and dept_id in by_id:
        return by_id[dept_id]

    code_guess = (
        str(student.get('department_code', '') or '').strip()
        or str(student.get('department', '') or '').strip()
        or str(student.get('branch', '') or '').strip()
        or str((user_data or {}).get('department', '') or '').strip()
        or str((user_data or {}).get('dept', '') or '').strip()
    )
    if code_guess:
        key = code_guess.upper()
        if key in by_code:
            return by_code[key]

    name_guess = (
        str(student.get('department_name', '') or '').strip()
        or str((user_data or {}).get('department_name', '') or '').strip()
        or str(student.get('department', '') or '').strip()
        or str((user_data or {}).get('department', '') or '').strip()
        or str(student.get('branch', '') or '').strip()
    )
    if name_guess and name_guess.lower() in by_name:
        return by_name[name_guess.lower()]

    return {'department_id': dept_id, 'department_code': code_guess.upper() if code_guess else '', 'department_name': name_guess}

# --- STUDENT FEE TRACKING ---
@accountant_bp.route('/dashboard', methods=['GET'])
@role_required(['Accountant'])
def get_dashboard():
    """Get dashboard summary for accountant - fee collection stats."""
    try:
        students = list(db.students.find({}))
        
        # Build a map of user categories to supplement missing student data
        emails = [s.get('email') for s in students if s.get('email')]
        user_map = {}
        if emails:
            users = list(db.users.find({'email': {'$in': emails}}, {'email': 1, 'category': 1}))
            for u in users:
                user_map[u.get('email')] = u.get('category')

        total_students = len(students)
        fees_paid_count = sum(1 for s in students if s.get('fee_status') == 'Paid' or s.get('fees_paid') is True)
        fees_partially_paid_count = sum(1 for s in students if s.get('fee_status') == 'Partially Paid')
        fees_unpaid_count = total_students - fees_paid_count - fees_partially_paid_count
        
        total_fees_collected = 0
        total_fees_due = 0
        
        for student in students:
            # Get category from student doc or user doc
            category = student.get('category') or user_map.get(student.get('email'))
            # Get base amount for this category
            base_amount = student.get('fees_amount') or _fee_amount_for_category(category)
            
            # Use actual paid amount if available
            paid_amount = float(student.get('fees_paid_amount') or 0)
            
            if student.get('fee_status') == 'Paid' or student.get('fees_paid') is True:
                # If fully paid, the collected amount should be the full base amount
                # (or at least what the student paid, but base_amount is the target)
                total_fees_collected += base_amount
            elif student.get('fee_status') == 'Partially Paid':
                # For partial, use the actual recorded paid amount
                actual_paid = paid_amount if paid_amount > 0 else (base_amount / 2)
                total_fees_collected += actual_paid
                total_fees_due += max(0, base_amount - actual_paid)
            else:
                # For unpaid/pending
                total_fees_collected += paid_amount
                total_fees_due += max(0, base_amount - paid_amount)
        
        stats = {
            'total_students': total_students,
            'fees_paid': fees_paid_count,
            'fees_partially_paid': fees_partially_paid_count,
            'fees_unpaid': fees_unpaid_count,
            'total_fees_collected': total_fees_collected,
            'total_fees_due': total_fees_due,
            'collection_percentage': (total_fees_collected / (total_fees_collected + total_fees_due) * 100) if (total_fees_collected + total_fees_due) > 0 else 0
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@accountant_bp.route('/students-fees', methods=['GET'])
@role_required(['Accountant'])
def get_students_fees():
    """Get all students with their fee payment status."""
    try:
        students = list(db.students.find({}, {
            '_id': 1,
            'name': 1,
            'email': 1,
            'enrollment_no': 1,
            'roll_no': 1,
            'phone_no': 1,
            'phone': 1,
            'mobile': 1,
            'department_id': 1,
            'department': 1,
            'department_code': 1,
            'department_name': 1,
            'branch': 1,
            'current_semester': 1,
            'group': 1,
            'class_name': 1,
            'fees_paid': 1,
            'fee_status': 1,
            'fees_amount': 1,
            'fees_paid_amount': 1,
            'batch_year': 1,
            'year': 1,
            'category': 1
        }))
        by_id, by_code, by_name = _build_department_maps()

        emails = list({e for s in students if (e := (s.get('email') or '').strip())})
        users_by_email = {}
        if emails:
            for u in db.users.find(
                {'email': {'$in': emails}},
                {'_id': 0, 'email': 1, 'phone': 1, 'mobile': 1, 'department': 1, 'dept': 1, 'department_name': 1, 'category': 1},
            ):
                key = u.get('email')
                if key:
                    users_by_email[key] = u

        # Convert ObjectIds to strings
        for student in students:
            student['_id'] = str(student['_id'])
            user_data = users_by_email.get(student.get('email'), {})
            dept = _resolve_department(student, by_id, by_code, by_name, user_data=user_data)
            student['department_id'] = dept.get('department_id', '')
            student['department_code'] = dept.get('department_code', '')
            student['department_name'] = dept.get('department_name', '')
            student['category'] = user_data.get('category') or student.get('category', '')
            student['phone_no'] = (
                student.get('phone_no')
                or student.get('phone')
                or student.get('mobile')
                or user_data.get('phone')
                or user_data.get('mobile')
                or ''
            )
            
            # Add category-wise fees_amount if not present
            if 'fees_amount' not in student:
                student['fees_amount'] = _fee_amount_for_category(student.get('category'))
            
            student['fees_paid_amount'] = student.get('fees_paid_amount', 0)
            
            # Determine fee status
            student['fee_status'] = student.get('fee_status')
            if not student['fee_status']:
                student['fee_status'] = 'Paid' if student.get('fees_paid') else 'Pending'
        
        return jsonify(students), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@accountant_bp.route('/update-fee-status/<student_id>', methods=['PUT'])
@role_required(['Accountant', 'Admin'])
def update_fee_status(student_id):
    """Update fee payment status for a student."""
    try:
        data = request.get_json()
        status = data.get('fee_status')
        if not status:
            fees_paid = data.get('fees_paid', False)
            status = 'Paid' if fees_paid else 'Pending'
        
        fees_paid = (status == 'Paid')
        
        # Handle both ObjectId and string IDs
        query_id = student_id
        if len(student_id) == 24:
            try:
                query_id = ObjectId(student_id)
            except Exception:
                pass
        
        student = db.students.find_one({"_id": query_id})
        if not student:
            return jsonify({"message": "Student not found"}), 404
            
        category = student.get('category')
        if not category and student.get('email'):
            user = db.users.find_one({'email': student['email']}, {'category': 1})
            if user:
                category = user.get('category')
                
        fees_amount = float(student.get('fees_amount') or _fee_amount_for_category(category))
        
        update_fields = {
            "fees_paid": fees_paid,
            "fee_status": status
        }
        
        if status == 'Paid':
            update_fields["fees_paid_amount"] = fees_amount
        elif status == 'Pending':
            update_fields["fees_paid_amount"] = 0.0
            
        if category:
            update_fields["category"] = category
            update_fields["fees_amount"] = fees_amount
            
        db.students.update_one(
            {"_id": query_id},
            {"$set": update_fields}
        )
        
        # Sync category to users collection
        if category and student.get('email'):
            db.users.update_one(
                {'email': student['email']},
                {'$set': {'category': category}}
            )
        
        return jsonify({"message": "Fee status updated successfully"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@accountant_bp.route('/update-partial-amount/<student_id>', methods=['PUT'])
@role_required(['Accountant', 'Admin'])
def update_partial_amount(student_id):
    """Update partially paid fee amount for a student."""
    try:
        data = request.get_json()
        paid_amount = float(data.get('fees_paid_amount', 0))
        
        query_id = student_id
        if len(student_id) == 24:
            try:
                query_id = ObjectId(student_id)
            except Exception:
                pass
                
        student = db.students.find_one({"_id": query_id})
        if not student:
            return jsonify({"message": "Student not found"}), 404
            
        # Get category from user collection if missing in student doc
        category = student.get('category')
        if not category and student.get('email'):
            user = db.users.find_one({'email': student['email']}, {'category': 1})
            if user:
                category = user.get('category')

        total_amount = float(student.get('fees_amount') or _fee_amount_for_category(category))
        
        status = student.get('fee_status', 'Pending')
        if paid_amount >= total_amount:
            status = 'Paid'
            fees_paid = True
        elif paid_amount > 0:
            status = 'Partially Paid'
            fees_paid = False
        else:
            status = 'Pending'
            fees_paid = False
            
        db.students.update_one(
            {"_id": query_id},
            {"$set": {
                "fees_paid_amount": paid_amount,
                "fee_status": status,
                "fees_paid": fees_paid,
                "category": category,
                "fees_amount": total_amount
            }}
        )

        if category and student.get('email'):
            db.users.update_one(
                {'email': student['email']},
                {'$set': {'category': category}}
            )
        
        return jsonify({
            "message": "Fee amount updated successfully", 
            "status": status,
            "fees_paid_amount": paid_amount
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@accountant_bp.route('/fee-summary', methods=['GET'])
@role_required(['Accountant', 'Admin'])
def get_fee_summary():
    """Get detailed fee summary by department."""
    try:
        students = list(db.students.find({}))
        departments = list(db.departments.find({}))
        by_id, by_code, by_name = _build_department_maps()
        
        # Build email to user category map for accuracy
        emails = [s.get('email') for s in students if s.get('email')]
        user_map = {}
        if emails:
            users = list(db.users.find({'email': {'$in': emails}}, {'email': 1, 'category': 1, 'department': 1}))
            for u in users:
                user_map[u.get('email')] = u

        # Summary by department
        dept_summary = {}
        for dept in departments:
            dept_id = str(dept['_id'])
            dept_name = dept.get('name', 'Unknown')
            
            # Use robust resolution to find students for this dept
            dept_students = []
            for s in students:
                user_data = user_map.get(s.get('email'), {})
                resolved = _resolve_department(s, by_id, by_code, by_name, user_data=user_data)
                if resolved.get('department_id') == dept_id:
                    dept_students.append(s)
            
            total = len(dept_students)
            paid = sum(1 for s in dept_students if s.get('fee_status') == 'Paid' or s.get('fees_paid') is True)
            partial = sum(1 for s in dept_students if s.get('fee_status') == 'Partially Paid')
            unpaid = total - paid - partial
            
            dept_summary[dept_name] = {
                'total_students': total,
                'fees_paid': paid,
                'fees_partial': partial,
                'fees_unpaid': unpaid,
                # Percentage based on any collection (partial or full)
                'percentage_paid': ((paid + (partial * 0.5)) / total * 100) if total > 0 else 0
            }
        
        return jsonify(dept_summary), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/submit-fee', methods=['POST'])
@role_required(['Student'])
def submit_fee():
    """Student uploads fee details and receipt document."""
    try:
        identity = get_jwt_identity()
        email = identity['email'] if isinstance(identity, dict) else identity
        student = db.students.find_one({'email': email})
        if not student:
            return jsonify({"message": "Student not found"}), 404

        form = request.form
        name = form.get('name', '').strip()
        email_value = form.get('email', '').strip()
        phone_no = form.get('phone_no', '').strip()
        category = form.get('category', '').strip()
        receipt = request.files.get('receipt')

        allowed_categories = {'GENERAL', 'OPEN', 'OBC', 'SC', 'ST', 'EWS', 'TFWS'}
        normalized_category = category.upper()
        if normalized_category not in allowed_categories:
            return jsonify({"message": "Invalid category selected"}), 400
        if not receipt:
            return jsonify({"message": "Fee receipt document is required"}), 400

        receipt_bytes = receipt.read()
        if not receipt_bytes:
            return jsonify({"message": "Uploaded receipt is empty"}), 400

        receipt_b64 = base64.b64encode(receipt_bytes).decode('utf-8')
        guessed_mime = mimetypes.guess_type(receipt.filename or '')[0]
        content_type = receipt.content_type or guessed_mime or 'application/octet-stream'
        now = datetime.datetime.utcnow()

        computed_amount = _fee_amount_for_category(normalized_category)

        payload = {
            'student_id': student['_id'],
            'name': name or student.get('name', ''),
            'email': email_value or student.get('email', ''),
            'phone_no': phone_no or student.get('phone_no', ''),
            'category': 'General' if normalized_category in ('GENERAL', 'OPEN') else normalized_category,
            'fees_amount': computed_amount,
            'receipt_filename': receipt.filename,
            'receipt_mime': content_type,
            'receipt_data': receipt_b64,
            'status': 'Pending',
            'created_at': now,
            'verified_at': None
        }

        # Always insert a new submission to support multiple receipts from the same student
        result = db.fee_submissions.insert_one(payload)
        submission_id = result.inserted_id

        db.students.update_one(
            {'_id': student['_id']},
            {'$set': {
                'phone_no': payload['phone_no'],
                'category': payload['category'],
                'fees_amount': payload['fees_amount'],
                'fees_paid': False
            }}
        )

        return jsonify({
            "message": "Fee details submitted successfully",
            "submission_id": str(submission_id),
            "status": "Pending"
        }), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/my-fee-submission', methods=['GET'])
@role_required(['Student'])
def my_fee_submission():
    """Student views own fee submissions (all uploaded receipts)."""
    try:
        identity = get_jwt_identity()
        email = identity['email'] if isinstance(identity, dict) else identity
        student = db.students.find_one({'email': email})
        if not student:
            return jsonify({"message": "Student not found"}), 404

        # Get all submissions for this student, sorted by most recent first
        submissions = list(db.fee_submissions.find({'student_id': student['_id']}).sort('created_at', -1))
        if not submissions:
            return jsonify({"exists": False, "submissions": []}), 200

        data_list = [_serialize_submission(sub, include_receipt=False) for sub in submissions]
        return jsonify({
            "exists": True,
            "submissions": data_list
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/my-fee-status', methods=['GET'])
@role_required(['Student'])
def my_fee_status():
    """Student views their fee totals (paid vs remaining)."""
    try:
        identity = get_jwt_identity()
        email = identity['email'] if isinstance(identity, dict) else identity
        student = db.students.find_one({'email': email})
        if not student:
            return jsonify({"message": "Student not found"}), 404

        total_amount = float(student.get('fees_amount') or _fee_amount_for_category(student.get('category')))
        paid_amount = float(student.get('fees_paid_amount') or 0)
        remaining_amount = max(0.0, total_amount - paid_amount)
        status = student.get('fee_status') or ('Paid' if bool(student.get('fees_paid')) else 'Pending')

        return jsonify({
            "fees_amount": total_amount,
            "fees_paid_amount": paid_amount,
            "remaining_amount": remaining_amount,
            "fee_status": status
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/students-submissions', methods=['GET'])
@role_required(['Accountant', 'Admin'])
def students_submissions():
    """Accountant views student fee submissions and receipts."""
    try:
        uploaded_only = request.args.get('uploaded_only', 'false').lower() == 'true'
        query = {'receipt_data': {'$exists': True, '$ne': ''}} if uploaded_only else {}
        submissions = list(db.fee_submissions.find(query).sort('created_at', -1))
        by_id, by_code, by_name = _build_department_maps()
        result = []
        for sub in submissions:
            student = db.students.find_one({'_id': sub.get('student_id')}) or {}
            user_data = db.users.find_one(
                {'email': student.get('email')},
                {'_id': 0, 'phone': 1, 'mobile': 1, 'department': 1, 'dept': 1, 'department_name': 1}
            ) or {}
            row = _serialize_submission(sub, include_receipt=True)
            dept = _resolve_department(student, by_id, by_code, by_name, user_data=user_data)
            row['student_name'] = student.get('name', row.get('name', ''))
            row['student_email'] = student.get('email', row.get('email', ''))
            row['enrollment_no'] = student.get('enrollment_no', '')
            row['phone_no'] = (
                student.get('phone_no')
                or student.get('phone')
                or student.get('mobile')
                or user_data.get('phone')
                or user_data.get('mobile')
                or row.get('phone_no', '')
            )
            row['fees_paid'] = bool(student.get('fees_paid', False))
            row['fee_status'] = student.get('fee_status') or row.get('status') or ('Paid' if row['fees_paid'] else 'Pending')
            row['department_name'] = dept.get('department_name', '')
            row['department_id'] = dept.get('department_id', '')
            row['department_code'] = dept.get('department_code', '')
            row['has_receipt'] = bool(row.get('receipt_data'))
            result.append(row)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/fee-submissions/by-student/<student_id>', methods=['GET'])
@role_required(['Accountant', 'Admin'])
def fee_submission_by_student(student_id):
    """Accountant views all of a student's fee submissions (all uploaded receipts)."""
    try:
        student = db.students.find_one({'_id': _safe_oid(student_id)}) or {}
        if not student:
            return jsonify({"exists": False, "message": "Student not found"}), 404

        # Get all submissions for this student, sorted by most recent first
        submissions = list(db.fee_submissions.find({'student_id': student.get('_id')}).sort('created_at', -1))
        if not submissions:
            return jsonify({"exists": False, "submissions": []}), 200

        submissions_data = [_serialize_submission(sub, include_receipt=False) for sub in submissions]
        
        # attach key student fields
        student_info = {
            '_id': str(student.get('_id', '')),
            'name': student.get('name', ''),
            'email': student.get('email', ''),
            'enrollment_no': student.get('enrollment_no', ''),
            'phone_no': student.get('phone_no', ''),
            'category': student.get('category', ''),
            'fees_paid': bool(student.get('fees_paid', False)),
            'fee_status': student.get('fee_status') or ('Paid' if student.get('fees_paid') else 'Pending'),
            'fees_amount': student.get('fees_amount', _fee_amount_for_category(student.get('category')))
        }
        
        return jsonify({
            "exists": True,
            "student": student_info,
            "submissions": submissions_data
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/fee-submissions/<submission_id>/mark-paid', methods=['PUT'])
@role_required(['Accountant', 'Admin'])
def mark_submission_paid(submission_id):
    """Accountant marks student fee as paid/unpaid from submission."""
    try:
        data = request.get_json() or {}
        if 'status' in data:
            status = data.get('status')
            paid = (status == 'Paid')
        else:
            paid = bool(data.get('paid', True))
            status = 'Paid' if paid else 'Pending'
            
        submission = db.fee_submissions.find_one({'_id': _safe_oid(submission_id)})
        if not submission:
            return jsonify({"message": "Submission not found"}), 404

        identity = get_jwt_identity()
        verifier = identity['email'] if isinstance(identity, dict) else identity

        db.fee_submissions.update_one(
            {'_id': submission['_id']},
            {'$set': {
                'status': status,
                'verified_at': datetime.datetime.utcnow(),
                'verified_by': verifier
            }}
        )

        student_id = submission['student_id']
        student = db.students.find_one({'_id': student_id})
        if student:
            # Sync category and fees_amount
            category = student.get('category') or submission.get('category')
            if category:
                category = 'General' if str(category).upper() in ('GENERAL', 'OPEN') else category
                
            fees_amount = float(_fee_amount_for_category(category))
            
            # Fetch all submissions to sum up verified ones
            all_subs = list(db.fee_submissions.find({'student_id': student_id}))
            fees_paid_amount = 0.0
            for s in all_subs:
                s_status = status if s['_id'] == submission['_id'] else s.get('status')
                if s_status in ('Paid', 'Partially Paid'):
                    fees_paid_amount += float(s.get('fees_amount') or _fee_amount_for_category(s.get('category')) or 0)
            
            if status == 'Paid':
                final_status = 'Paid'
                final_paid = True
                fees_paid_amount = max(fees_paid_amount, fees_amount)
            elif status == 'Partially Paid':
                final_status = 'Partially Paid'
                final_paid = False
                sub_amount = float(submission.get('fees_amount') or _fee_amount_for_category(submission.get('category')) or 0)
                fees_paid_amount = max(fees_paid_amount, sub_amount)
                if fees_paid_amount >= fees_amount:
                    final_status = 'Paid'
                    final_paid = True
            else:
                final_status = 'Pending'
                final_paid = False

            student_update = {
                'fees_paid': final_paid,
                'fee_status': final_status,
                'fees_paid_amount': fees_paid_amount
            }
            if category:
                student_update['category'] = category
                student_update['fees_amount'] = fees_amount

            db.students.update_one(
                {'_id': student_id},
                {'$set': student_update}
            )

            # Sync category to users collection
            if category and student.get('email'):
                db.users.update_one(
                    {'email': student['email']},
                    {'$set': {'category': category}}
                )

        return jsonify({"message": f"Student marked as {status}"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@accountant_bp.route('/fee-submissions/<submission_id>/receipt', methods=['GET'])
@role_required(['Accountant', 'Admin'])
def download_receipt(submission_id):
    """View/download uploaded fee receipt document."""
    try:
        submission = db.fee_submissions.find_one({'_id': _safe_oid(submission_id)})
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        if not submission.get('receipt_data'):
            return jsonify({"message": "Receipt not uploaded"}), 404

        binary = base64.b64decode(submission.get('receipt_data'))
        mime = submission.get('receipt_mime') or mimetypes.guess_type(submission.get('receipt_filename', ''))[0] or 'application/octet-stream'
        filename = submission.get('receipt_filename', f"receipt_{submission_id}")
        return send_file(
            io.BytesIO(binary),
            mimetype=mime,
            as_attachment=False,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"message": str(e)}), 500
