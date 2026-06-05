"""
Module 4: Timetable Management
Create subject-wise exam schedule per exam session.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

timetable_bp = Blueprint('timetable', __name__)


def _serialize(doc):
    doc['_id'] = str(doc['_id'])
    doc['exam_id'] = str(doc.get('exam_id', ''))
    doc['subject_id'] = str(doc.get('subject_id', ''))
    doc['class_value'] = doc.get('class_value', '') or ''
    return doc


@timetable_bp.route('/<exam_id>', methods=['GET'])
@jwt_required()
def get_timetable(exam_id):
    """Get full timetable for an exam."""
    class_value = (request.args.get('class_value') or '').strip()
    query = {'exam_id': ObjectId(exam_id)}
    if class_value:
        query['class_value'] = class_value
    entries = list(mongo.db.timetable.find(query).sort([('date', 1), ('start_time', 1)]))
    result = []
    for e in entries:
        e = _serialize(e)
        sub = mongo.db.subjects.find_one({'_id': ObjectId(e['subject_id'])})
        e['subject_name'] = sub.get('name', '') if sub else ''
        e['subject_code'] = sub.get('code', '') if sub else ''
        result.append(e)
    return jsonify(result), 200


@timetable_bp.route('/', methods=['POST'])
@role_required(['Exam Cell'])
def add_timetable_entry():
    """Add a single timetable entry."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    date = data.get('date')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    room = data.get('room', '')
    class_value = (data.get('class_value') or '').strip()

    if not all([exam_id, subject_id, date, start_time]):
        return jsonify({'message': 'exam_id, subject_id, date, start_time are required'}), 400

    exam = mongo.db.exams.find_one({'_id': ObjectId(exam_id)})
    if not exam:
        return jsonify({'message': 'Exam not found'}), 404

    # Prevent duplicate entry for same exam+subject+class_value
    existing = mongo.db.timetable.find_one({
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id),
        'class_value': class_value
    })
    if existing:
        return jsonify({'message': 'Timetable entry for this subject and class/group already exists'}), 409

    entry = {
        'exam_id': ObjectId(exam_id),
        'subject_id': ObjectId(subject_id),
        'class_value': class_value,
        'date': date,
        'start_time': start_time,
        'end_time': end_time,
        'room': room,
        'created_at': datetime.datetime.utcnow()
    }
    result = mongo.db.timetable.insert_one(entry)

    # Also update exams.timetable array for backward compat
    mongo.db.exams.update_one(
        {'_id': ObjectId(exam_id)},
        {'$push': {'timetable': {'subject_id': str(subject_id), 'date': date, 'time': start_time, 'class_value': class_value}}}
    )

    log_audit('TIMETABLE_ADD', {'exam_id': exam_id, 'subject_id': subject_id, 'date': date, 'class_value': class_value})
    return jsonify({'message': 'Timetable entry added', 'id': str(result.inserted_id)}), 201


@timetable_bp.route('/<entry_id>', methods=['PUT'])
@role_required(['Exam Cell'])
def update_timetable_entry(entry_id):
    """Update a timetable entry."""
    data = request.get_json()
    allowed = ['date', 'start_time', 'end_time', 'room']
    updates = {k: v for k, v in data.items() if k in allowed}
    updates['updated_at'] = datetime.datetime.utcnow()
    mongo.db.timetable.update_one({'_id': ObjectId(entry_id)}, {'$set': updates})
    log_audit('TIMETABLE_UPDATE', {'entry_id': entry_id})
    return jsonify({'message': 'Timetable entry updated'}), 200


@timetable_bp.route('/<entry_id>', methods=['DELETE'])
@role_required(['Exam Cell'])
def delete_timetable_entry(entry_id):
    """Delete a timetable entry."""
    mongo.db.timetable.delete_one({'_id': ObjectId(entry_id)})
    log_audit('TIMETABLE_DELETE', {'entry_id': entry_id})
    return jsonify({'message': 'Timetable entry deleted'}), 200


@timetable_bp.route('/bulk/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def bulk_add_timetable(exam_id):
    """Bulk add timetable entries. Expects list of {subject_id, date, start_time, end_time, room}."""
    data = request.get_json()
    entries = data.get('entries', [])
    if not entries:
        return jsonify({'message': 'No entries provided'}), 400

    docs = []
    for e in entries:
        class_value = (e.get('class_value') or '').strip()
        docs.append({
            'exam_id': ObjectId(exam_id),
            'subject_id': ObjectId(e['subject_id']),
            'class_value': class_value,
            'date': e.get('date'),
            'start_time': e.get('start_time'),
            'end_time': e.get('end_time', ''),
            'room': e.get('room', ''),
            'created_at': datetime.datetime.utcnow()
        })
    mongo.db.timetable.insert_many(docs)
    log_audit('TIMETABLE_BULK_ADD', {'exam_id': exam_id, 'count': len(docs)})
    return jsonify({'message': f'{len(docs)} entries added'}), 201
