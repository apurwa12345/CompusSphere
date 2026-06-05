"""
Module 18: Exam Settings
Grading rules, passing marks, and exam policies configurable by admin.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import role_required
from app.utils.logger import log_audit

exam_settings_bp = Blueprint('exam_settings', __name__)

DEFAULT_SETTINGS = {
    'passing_percentage': 40,
    'min_internal_marks': 12,
    'max_internal_marks': 20,
    'max_external_marks': 60,
    'grading_scheme': [
        {'min_pct': 90, 'grade': 'EX', 'grade_point': 10, 'label': 'Outstanding'},
        {'min_pct': 80, 'grade': 'AA', 'grade_point': 9, 'label': 'Excellent'},
        {'min_pct': 75, 'grade': 'AB', 'grade_point': 8.5, 'label': 'Very Good (AB)'},
        {'min_pct': 70, 'grade': 'BB', 'grade_point': 8, 'label': 'Very Good (BB)'},
        {'min_pct': 65, 'grade': 'BC', 'grade_point': 7.5, 'label': 'Good (BC)'},
        {'min_pct': 60, 'grade': 'CC', 'grade_point': 7, 'label': 'Good (CC)'},
        {'min_pct': 55, 'grade': 'CD', 'grade_point': 6.5, 'label': 'Above Average (CD)'},
        {'min_pct': 50, 'grade': 'DD', 'grade_point': 6, 'label': 'Above Average (DD)'},
        {'min_pct': 45, 'grade': 'DE', 'grade_point': 5.5, 'label': 'Average (DE)'},
        {'min_pct': 40, 'grade': 'EE', 'grade_point': 5, 'label': 'Average (EE)'},
        {'min_pct': 0, 'grade': 'FF', 'grade_point': 0, 'label': 'Fail'}
    ],
    'allow_revaluation': True,
    'revaluation_fee': 500,
    'hall_ticket_visibility': 'approved_only',
    'result_visibility': 'published_only'
}


@exam_settings_bp.route('/', methods=['GET'])
@jwt_required()
def get_settings():
    """Get current exam settings (merged with defaults)."""
    saved = mongo.db.exam_settings.find_one({})
    settings = {**DEFAULT_SETTINGS}
    if saved:
        saved['_id'] = str(saved['_id'])
        settings.update(saved)
    return jsonify(settings), 200


@exam_settings_bp.route('/', methods=['PUT'])
@role_required(['Exam Cell'])
def update_settings():
    """Update exam settings. Partial updates supported."""
    data = request.get_json()
    allowed_keys = [
        'passing_percentage', 'min_internal_marks',
        'max_internal_marks', 'max_external_marks', 'grading_scheme',
        'allow_revaluation', 'revaluation_fee', 'hall_ticket_visibility',
        'result_visibility'
    ]
    updates = {k: v for k, v in data.items() if k in allowed_keys}

    # Validation
    if 'passing_percentage' in updates:
        if not (0 <= updates['passing_percentage'] <= 100):
            return jsonify({'message': 'passing_percentage must be 0-100'}), 400

    updates['updated_at'] = datetime.datetime.utcnow()

    existing = mongo.db.exam_settings.find_one({})
    if existing:
        mongo.db.exam_settings.update_one({'_id': existing['_id']}, {'$set': updates})
    else:
        defaults = {**DEFAULT_SETTINGS, **updates}
        mongo.db.exam_settings.insert_one(defaults)

    log_audit('EXAM_SETTINGS_UPDATED', {'updated_fields': list(updates.keys())})
    return jsonify({'message': 'Settings updated successfully'}), 200


@exam_settings_bp.route('/reset', methods=['POST'])
@role_required(['Admin'])
def reset_settings():
    """Reset all settings to defaults."""
    mongo.db.exam_settings.delete_many({})
    mongo.db.exam_settings.insert_one({**DEFAULT_SETTINGS, 'updated_at': datetime.datetime.utcnow()})
    log_audit('EXAM_SETTINGS_RESET', {})
    return jsonify({'message': 'Settings reset to defaults'}), 200
