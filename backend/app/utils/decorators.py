from functools import wraps
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request, get_jwt
from flask import jsonify

def role_required(roles):
    """
    Decorator to ensure the logged-in user has one of the required roles.
    `roles` can be a string or a list of strings: ['Admin', 'HOD', 'Exam Cell', 'Faculty', 'Student']
    """
    if isinstance(roles, str):
        roles = [roles]
        
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            identity = get_jwt_identity()
            claims = get_jwt()
            
            # Extract role from claims (standard) or identity (my previous attempt)
            role = claims.get('role')
            if not role and isinstance(identity, dict):
                role = identity.get('role')
            
            if not role:
                return jsonify({"message": "Missing role in token"}), 403
            
            if role not in roles:
                return jsonify({"message": f"Access denied. Requires one of: {', '.join(roles)}"}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator
