import datetime
from flask import request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request, get_jwt
from app import mongo

def log_audit(action, details=None):
    """
    Utility function to log user actions to the database.
    Should be called within a request context context.
    """
    user_email = "Anonymous"
    user_role = "System"
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        claims = get_jwt()
        if identity:
            user_email = identity['email'] if isinstance(identity, dict) else identity
            # Get role from claims or identity
            user_role = claims.get('role')
            if not user_role and isinstance(identity, dict):
                user_role = identity.get('role', 'Unknown')
            if not user_role:
                user_role = 'Unknown'
    except Exception:
        pass # Ignore errors if JWT is missing/invalid

    log_entry = {
        "timestamp": datetime.datetime.utcnow(),
        "user_email": user_email,
        "user_role": user_role,
        "action": action,
        "details": details or {},
        "ip_address": request.remote_addr,
        "endpoint": request.endpoint
    }
    
    # Save asynchronously or directly to DB
    mongo.db.audit_logs.insert_one(log_entry)

def setup_audit_logging(app):
    """
    Registers the after_request handler to automatically log requests if needed,
    or we can just manually call `log_audit()` in specific endpoints where mutative actions occur.
    For this system, explicit logging in mutative endpoints might be cleaner to avoid noise.
    """
    pass
