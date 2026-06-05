"""
Module 5: Seating Arrangement (Optional)
Assign room and seat number per student per exam.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

seating_bp = Blueprint('seating', __name__)


@seating_bp.route('/<exam_id>', methods=['GET'])
@role_required(['Exam Cell'])
def get_seating(exam_id):
    """List all seat assignments for an exam."""
    seats = list(mongo.db.seating.find({'exam_id': ObjectId(exam_id)}))
    result = []
    for s in seats:
        s['_id'] = str(s['_id'])
        s['exam_id'] = str(s['exam_id'])
        s['student_id'] = str(s['student_id'])
        student = mongo.db.students.find_one({'_id': ObjectId(s['student_id'])})
        if student:
            s['student_name'] = student.get('name', '')
            s['enrollment_no'] = student.get('enrollment_no', '')
        result.append(s)
    return jsonify(result), 200


@seating_bp.route('/my/<exam_id>', methods=['GET'])
@role_required(['Student'])
def my_seat(exam_id):
    """Student views their own seat assignment."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    student = mongo.db.students.find_one({'email': email})
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    seat = mongo.db.seating.find_one({'exam_id': ObjectId(exam_id), 'student_id': student['_id']})
    if not seat:
        return jsonify({'message': 'No seat assigned yet'}), 404
    seat['_id'] = str(seat['_id'])
    seat['exam_id'] = str(seat['exam_id'])
    seat['student_id'] = str(seat['student_id'])
    return jsonify(seat), 200


@seating_bp.route('/', methods=['POST'])
@role_required(['Exam Cell'])
def assign_seat():
    """Assign a seat to a student."""
    data = request.get_json()
    exam_id = data.get('exam_id')
    student_id = data.get('student_id')
    room = data.get('room', '')
    seat_no = data.get('seat_no', '')

    if not all([exam_id, student_id]):
        return jsonify({'message': 'exam_id and student_id are required'}), 400

    mongo.db.seating.update_one(
        {'exam_id': ObjectId(exam_id), 'student_id': ObjectId(student_id)},
        {'$set': {
            'exam_id': ObjectId(exam_id),
            'student_id': ObjectId(student_id),
            'room': room,
            'seat_no': seat_no,
            'assigned_at': datetime.datetime.utcnow()
        }},
        upsert=True
    )
    log_audit('SEAT_ASSIGN', {'exam_id': exam_id, 'student_id': student_id, 'seat_no': seat_no})
    return jsonify({'message': 'Seat assigned'}), 200


@seating_bp.route('/auto-assign/<exam_id>', methods=['POST'])
@role_required(['Exam Cell'])
def auto_assign(exam_id):
    """Auto-assign seats to all eligible/approved students sequentially."""
    data = request.get_json()
    rooms = data.get('rooms', ['Room 101'])
    seats_per_room = int(data.get('seats_per_room', 30))

    # Get approved applications
    apps = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id), 'status': 'Approved'}))
    if not apps:
        return jsonify({'message': 'No approved applications found'}), 404

    seat_num = 1
    room_idx = 0
    assigned = 0

    for app in apps:
        if room_idx >= len(rooms):
            break
        current_room = rooms[room_idx]
        seat_no = f'{current_room}-{seat_num}'

        mongo.db.seating.update_one(
            {'exam_id': ObjectId(exam_id), 'student_id': app['student_id']},
            {'$set': {
                'exam_id': ObjectId(exam_id),
                'student_id': app['student_id'],
                'room': current_room,
                'seat_no': seat_no,
                'assigned_at': datetime.datetime.utcnow()
            }},
            upsert=True
        )
        assigned += 1
        seat_num += 1
        if seat_num > seats_per_room:
            seat_num = 1
            room_idx += 1

    log_audit('SEATING_AUTO_ASSIGN', {'exam_id': exam_id, 'assigned': assigned})
    return jsonify({'message': f'{assigned} seats auto-assigned'}), 200


@seating_bp.route('/<exam_id>/<student_id>', methods=['DELETE'])
@role_required(['Exam Cell'])
def remove_seat(exam_id, student_id):
    """Remove a seat assignment."""
    mongo.db.seating.delete_one({'exam_id': ObjectId(exam_id), 'student_id': ObjectId(student_id)})
    log_audit('SEAT_REMOVE', {'exam_id': exam_id, 'student_id': student_id})
    return jsonify({'message': 'Seat assignment removed'}), 200
