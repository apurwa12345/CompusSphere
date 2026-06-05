"""Validators for email, data formats, and institutional constraints."""


def validate_institutional_email(email):
    """
    Validate that email is institutional (@mgmcen.ac.in).
    
    Args:
        email: Email string to validate
        
    Returns:
        tuple: (is_valid: bool, message: str)
    """
    if not email:
        return False, "Email is required"
    if not email.endswith('@mgmcen.ac.in'):
        return False, "Only institutional emails (@mgmcen.ac.in) are allowed"
    return True, "Valid"
