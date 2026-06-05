"""
Module 17: Audit Logs
Track and view all admin/exam-cell actions. Read-only for admins.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required

audit_bp = Blueprint('audit', __name__)


@audit_bp.route('/', methods=['GET'])
@role_required(['Exam Cell', 'Admin'])
def list_audit_logs():
    """List audit logs with optional filters."""
    action = request.args.get('action')
    user_email = request.args.get('user')
    limit = int(request.args.get('limit', 100))
    page = int(request.args.get('page', 1))

    query = {}
    if action:
        query['action'] = {'$regex': action, '$options': 'i'}
    if user_email:
        query['user'] = {'$regex': user_email, '$options': 'i'}

    total = mongo.db.audit_logs.count_documents(query)
    logs = list(
        mongo.db.audit_logs
        .find(query)
        .sort('timestamp', -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    result = []
    for log in logs:
        log['_id'] = str(log['_id'])
        if 'timestamp' in log and log['timestamp']:
            ts = log['timestamp']
            log['timestamp'] = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
        result.append(log)

    return jsonify({
        'logs': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }), 200


@audit_bp.route('/actions', methods=['GET'])
@role_required(['Exam Cell', 'Admin'])
def list_action_types():
    """List all distinct action types in audit logs."""
    actions = mongo.db.audit_logs.distinct('action')
    return jsonify(sorted(actions)), 200


@audit_bp.route('/stats', methods=['GET'])
@role_required(['Exam Cell', 'Admin'])
def audit_stats():
    """Stats: total logs, most common actions, most active admins."""
    total = mongo.db.audit_logs.count_documents({})
    pipeline_actions = [
        {'$group': {'_id': '$action', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ]
    pipeline_users = [
        {'$group': {'_id': '$user', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ]
    top_actions = list(mongo.db.audit_logs.aggregate(pipeline_actions))
    top_users = list(mongo.db.audit_logs.aggregate(pipeline_users))

    return jsonify({
        'total_logs': total,
        'top_actions': [{'action': a['_id'], 'count': a['count']} for a in top_actions],
        'top_users': [{'user': u['_id'], 'count': u['count']} for u in top_users]
    }), 200
