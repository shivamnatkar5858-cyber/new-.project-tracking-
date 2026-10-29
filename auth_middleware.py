import os
from functools import wraps
from datetime import datetime, timedelta
import jwt
from flask import request, jsonify, g, session, current_app
from models import User

JWT_SECRET = os.environ.get('SECRET_KEY', 'projecttrack_secret_key_change_in_production_2026')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

def generate_token(user):
    payload = {
        'user_id': user.id,
        'email': user.email,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user_from_request():
    auth_header = request.headers.get('Authorization', '')
    token = None

    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    elif 'token' in request.cookies:
        token = request.cookies.get('token')
    elif 'token' in request.args:
        token = request.args.get('token')

    if token:
        payload = decode_token(token)
        if payload and 'user_id' in payload:
            return User.query.get(payload['user_id'])

    # Fallback to session
    user_id = session.get('user_id')
    if user_id:
        return User.query.get(user_id)

    return None

def token_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user_from_request()
            if not user:
                return jsonify({
                    'success': False,
                    'error': 'Authentication required. Please log in.'
                }), 401

            if role:
                roles = [role] if isinstance(role, str) else role
                if user.role not in roles and user.role != 'admin':
                    return jsonify({
                        'success': False,
                        'error': f'Access forbidden. Requires {role} role.'
                    }), 403

            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator
