"""
Module 16: Notifications (Exam-focused)
Send targeted notifications for exam events: hall ticket release, result publish, deadlines.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

exam_notify_bp = Blueprint('exam_notify', __name__)


def _send_notification(user_ids, title, message, notif_type='Exam'):
    """Helper to insert notifications for a list of user_ids."""
    if not user_ids:
        return 0
    now = datetime.datetime.utcnow()
    docs = []
    for uid in user_ids:
        docs.append({
            'user_id': uid,
            'title': title,
            'message': message,
            'type': notif_type,
            'is_read': False,
            'created_at': now
        })
    if docs:
        mongo.db.notifications.insert_many(docs)
    return len(docs)


@exam_notify_bp.route('/send', methods=['POST'])
@role_required(['Exam Cell'])
def send_notification():
    """Send a targeted notification to specific users or all students."""
    data = request.get_json()
    title = data.get('title', '').strip()
    message = data.get('message', '').strip()
    target = data.get('target', 'all')  # 'all', 'semester:<n>', 'exam:<exam_id>', list of user_ids
    notif_type = data.get('type', 'Exam')

    if not title or not message:
        return jsonify({'message': 'title and message are required'}), 400

    user_ids = []

    if target == 'all':
        users = list(mongo.db.users.find({'role': 'Student'}, {'_id': 1}))
        user_ids = [u['_id'] for u in users]

    elif isinstance(target, str) and target.startswith('semester:'):
        sem = int(target.split(':')[1])
        students = list(mongo.db.students.find({'semester': sem}, {'user_id': 1}))
        for s in students:
            if s.get('user_id'):
                user_ids.append(s['user_id'])

    elif isinstance(target, str) and target.startswith('exam:'):
        exam_id = target.split(':')[1]
        apps = list(mongo.db.exam_applications.find({'exam_id': ObjectId(exam_id), 'status': 'Approved'}))
        for a in apps:
            student = mongo.db.students.find_one({'_id': a['student_id']})
            if student and student.get('user_id'):
                user_ids.append(student['user_id'])

    elif isinstance(target, list):
        user_ids = [ObjectId(uid) for uid in target]

    count = _send_notification(user_ids, title, message, notif_type)
    log_audit('EXAM_NOTIFICATION_SENT', {'title': title, 'target': str(target), 'count': count})
    return jsonify({'message': f'Notification sent to {count} users'}), 200


@exam_notify_bp.route('/my', methods=['GET'])
@jwt_required()
def my_notifications():
    """Get notifications for the current user."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    user = mongo.db.users.find_one({'email': email})
    if not user:
        return jsonify([]), 200

    notifs = list(mongo.db.notifications.find(
        {'user_id': user['_id']}
    ).sort('created_at', -1).limit(50))

    result = []
    for n in notifs:
        n['_id'] = str(n['_id'])
        n['user_id'] = str(n['user_id'])
        if 'created_at' in n and n['created_at']:
            if hasattr(n['created_at'], 'isoformat'):
                n['created_at'] = n['created_at'].isoformat()
            else:
                n['created_at'] = str(n['created_at'])
        result.append(n)
    return jsonify(result), 200


@exam_notify_bp.route('/mark-read/<notif_id>', methods=['PATCH'])
@jwt_required()
def mark_read(notif_id):
    """Mark a notification as read."""
    mongo.db.notifications.update_one(
        {'_id': ObjectId(notif_id)},
        {'$set': {'is_read': True}}
    )
    return jsonify({'message': 'Marked as read'}), 200


@exam_notify_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    """Get unread notification count for current user."""
    identity = get_jwt_identity()
    email = identity['email'] if isinstance(identity, dict) else identity
    user = mongo.db.users.find_one({'email': email})
    if not user:
        return jsonify({'count': 0}), 200
    count = mongo.db.notifications.count_documents({'user_id': user['_id'], 'is_read': False})
    return jsonify({'count': count}), 200
