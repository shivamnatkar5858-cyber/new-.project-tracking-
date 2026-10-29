from flask import Blueprint, request, jsonify, session
from models import db, User, Student, Teacher, Project
from auth_middleware import generate_token, token_required, get_current_user_from_request

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/student/login', methods=['POST'])
def student_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({
            'success': False,
            'error': 'Email and password are required'
        }), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({
            'success': False,
            'error': 'Invalid email or password'
        }), 401

    if user.role != 'student' and user.role != 'admin':
        return jsonify({
            'success': False,
            'error': 'This account does not have student access. Please use teacher login.'
        }), 403

    token = generate_token(user)
    session['user_id'] = user.id

    student_profile = user.student_profile
    project_data = None
    if student_profile and student_profile.project:
        project_data = student_profile.project.to_dict(include_details=True)
    elif user.role == 'student':
        # Default or first project fallback if not explicitly linked
        first_proj = Project.query.first()
        if first_proj:
            project_data = first_proj.to_dict(include_details=True)

    return jsonify({
        'success': True,
        'message': 'Student login successful',
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': student_profile.name if student_profile else user.email.split('@')[0],
            'roll_no': student_profile.roll_no if student_profile else None,
            'department': student_profile.department if student_profile else 'E&ACT',
            'project_id': student_profile.project_id if student_profile else (project_data['id'] if project_data else None)
        },
        'project': project_data
    }), 200


@auth_bp.route('/api/teacher/login', methods=['POST'])
def teacher_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({
            'success': False,
            'error': 'Email and password are required'
        }), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({
            'success': False,
            'error': 'Invalid email or password'
        }), 401

    if user.role != 'teacher' and user.role != 'admin':
        return jsonify({
            'success': False,
            'error': 'This account does not have teacher access. Please use student login.'
        }), 403

    token = generate_token(user)
    session['user_id'] = user.id

    teacher_profile = user.teacher_profile

    return jsonify({
        'success': True,
        'message': 'Teacher login successful',
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': teacher_profile.name if teacher_profile else 'Faculty Member',
            'designation': teacher_profile.designation if teacher_profile else 'Assistant Professor',
            'department': teacher_profile.department if teacher_profile else 'E&ACT'
        }
    }), 200


@auth_bp.route('/api/student/register', methods=['POST'])
def student_register():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    roll_no = data.get('roll_no', '').strip()
    department = data.get('department', 'E&ACT').strip()
    year = data.get('year', 'Final Year').strip()
    phone = data.get('phone', '').strip()
    project_code = data.get('project_code', '').strip()

    if not email or not password or not name:
        return jsonify({
            'success': False,
            'error': 'Name, email, and password are required'
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            'success': False,
            'error': 'User with this email already exists'
        }), 409

    user = User(email=email, role='student')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    # Link project if code provided
    project_id = None
    if project_code:
        proj = Project.query.filter_by(project_code=project_code).first()
        if proj:
            project_id = proj.id

    student = Student(
        user_id=user.id,
        name=name,
        roll_no=roll_no,
        department=department,
        year=year,
        phone=phone,
        project_id=project_id
    )
    db.session.add(student)
    db.session.commit()

    token = generate_token(user)
    return jsonify({
        'success': True,
        'message': 'Student registered successfully',
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': student.name
        }
    }), 201


@auth_bp.route('/api/teacher/register', methods=['POST'])
def teacher_register():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    department = data.get('department', 'E&ACT').strip()
    designation = data.get('designation', 'Assistant Professor').strip()
    phone = data.get('phone', '').strip()

    if not email or not password or not name:
        return jsonify({
            'success': False,
            'error': 'Name, email, and password are required'
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            'success': False,
            'error': 'User with this email already exists'
        }), 409

    user = User(email=email, role='teacher')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    teacher = Teacher(
        user_id=user.id,
        name=name,
        department=department,
        designation=designation,
        phone=phone
    )
    db.session.add(teacher)
    db.session.commit()

    token = generate_token(user)
    return jsonify({
        'success': True,
        'message': 'Teacher registered successfully',
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': teacher.name
        }
    }), 201


@auth_bp.route('/api/logout', methods=['POST', 'GET'])
def logout():
    session.pop('user_id', None)
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200


@auth_bp.route('/api/me', methods=['GET'])
def get_me():
    user = get_current_user_from_request()
    if not user:
        return jsonify({
            'success': False,
            'authenticated': False
        }), 200

    res = {
        'success': True,
        'authenticated': True,
        'user': user.to_dict()
    }
    return jsonify(res), 200
