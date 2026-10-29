import os
import re
from datetime import datetime
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from models import db, User, Student, Teacher, Project, TeamMember, Milestone
from auth_middleware import generate_token
from routes.auth import auth_bp
from routes.student import student_bp
from routes.teacher import teacher_bp
from routes.projects import projects_bp
from routes.milestones import milestones_bp
from routes.reports import reports_bp
from routes.documents import documents_bp
from routes.notifications import notifications_bp

def create_app(test_config=None):
    app = Flask(__name__, static_folder='.', static_url_path='')

    # Configuration
    base_dir = os.path.abspath(os.path.dirname(__file__))
    instance_path = os.path.join(base_dir, 'instance')
    os.makedirs(instance_path, exist_ok=True)

    db_path = os.path.join(instance_path, 'projecttrack.db')
    upload_folder = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'projecttrack_secret_key_change_in_production_2026'),
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URI', f"sqlite:///{db_path}"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=upload_folder,
        MAX_CONTENT_LENGTH=16 * 1024 * 1024  # 16 MB
    )

    if test_config:
        app.config.update(test_config)

    # Initialize CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Initialize DB
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(teacher_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(milestones_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(notifications_bp)

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'ProjectTrack Flask REST API',
            'version': '1.0.0',
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    # =========================================================================
    # Student Registration Route
    # Handles student registration, input validation, and secure SQLite persistence
    # =========================================================================
    @app.route('/api/student/register', methods=['POST'])
    @app.route('/register', methods=['POST'])
    def student_registration():
        data = request.get_json(silent=True) or request.form.to_dict() or {}

        # Extract fields
        name = (data.get('name') or data.get('full_name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        roll_no = (data.get('roll_no') or data.get('roll') or '').strip()
        department = (data.get('department') or data.get('dept') or 'E&ACT').strip()
        year = (data.get('year') or 'Final Year').strip()
        phone = (data.get('phone') or '').strip()
        project_name = (data.get('project_name') or data.get('project_title') or '').strip()
        project_code = (data.get('project_code') or '').strip()
        guide_name = (data.get('guide_name') or 'Prof. D. K. Kadam').strip()
        group_members = data.get('group_members') or []

        # 1. Validation
        errors = []
        if not name or len(name) < 2:
            errors.append('Full name is required and must be at least 2 characters.')

        email_pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        if not email or not re.match(email_pattern, email):
            errors.append('A valid student email address is required (e.g. user@csmss.edu).')

        if not password or len(password) < 6:
            errors.append('Password is required and must be at least 6 characters long.')

        if errors:
            return jsonify({
                'success': False,
                'error': errors[0],
                'errors': errors
            }), 400

        # 2. Check if user already exists in SQLite database
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                'success': False,
                'error': f'An account with email "{email}" already exists. Please sign in.'
            }), 409

        try:
            # 3. Create User and hash password securely
            user = User(email=email, role='student')
            user.set_password(password)  # Secure password hash via werkzeug generate_password_hash
            db.session.add(user)
            db.session.flush()

            # 4. Create or link project if provided
            project = None
            if project_code:
                project = Project.query.filter_by(project_code=project_code).first()

            if not project and project_name:
                auto_code = project_code or f"SIH26{int(datetime.utcnow().timestamp()) % 900 + 100}"
                project = Project(
                    project_code=auto_code,
                    title=project_name,
                    description=f'Project "{project_name}" created by {name} and team ({department} Department).',
                    department=department,
                    progress=20,
                    status='In Progress',
                    start_date=datetime.utcnow().strftime('%d %b %Y'),
                    expected_completion='30 Nov 2026'
                )
                db.session.add(project)
                db.session.flush()

                # Default milestones
                milestones_data = [
                    ('Project Topic & Synopsis Submission', 'Literature review and problem formulation', True, 0),
                    ('System Design & Architecture', 'Database schema, UI mockups, and API design', False, 1),
                    ('Frontend & Backend Implementation', 'Integration and core module testing', False, 2),
                    ('Final Testing & Defense Presentation', 'Documentation and presentation defense', False, 3)
                ]
                for m_title, m_desc, m_comp, m_ord in milestones_data:
                    ms = Milestone(
                        project_id=project.id,
                        title=m_title,
                        description=m_desc,
                        is_completed=m_comp,
                        order_index=m_ord
                    )
                    db.session.add(ms)

            # 5. Create Student profile in SQLite
            student = Student(
                user_id=user.id,
                name=name,
                roll_no=roll_no or '26EACT01',
                department=department,
                year=year,
                phone=phone,
                project_id=project.id if project else None
            )
            db.session.add(student)
            db.session.flush()

            # 6. Save Team Members
            if project:
                # Add leader
                leader_member = TeamMember(
                    project_id=project.id,
                    student_id=student.id,
                    name=name,
                    roll_no=roll_no or '26EACT01',
                    role='Team Leader / Full-Stack'
                )
                db.session.add(leader_member)

                # Add additional members if passed
                if isinstance(group_members, list):
                    for idx, gm in enumerate(group_members):
                        m_name = (gm.get('name') if isinstance(gm, dict) else str(gm)).strip()
                        m_roll = (gm.get('roll_no') if isinstance(gm, dict) else f"{department}0{idx+2}").strip()
                        m_role = (gm.get('role') if isinstance(gm, dict) else 'Team Member').strip()
                        if m_name and m_name.lower() != name.lower():
                            tm = TeamMember(
                                project_id=project.id,
                                name=m_name,
                                roll_no=m_roll,
                                role=m_role
                            )
                            db.session.add(tm)

            # 7. Commit securely to SQLite database
            db.session.commit()

            # Generate authentication token
            token = generate_token(user)

            return jsonify({
                'success': True,
                'message': f'Student account for {name} registered successfully!',
                'token': token,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': student.name,
                    'roll_no': student.roll_no,
                    'department': student.department,
                    'role': 'student',
                    'project_id': student.project_id
                },
                'project': project.to_dict(include_details=True) if project else None
            }), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': f'Database error during registration: {str(e)}'
            }), 500

    # Testimonials API endpoints
    @app.route('/api/testimonials', methods=['GET', 'POST'])
    def handle_testimonials():
        data_file = os.path.join(base_dir, 'instance', 'projecttrack_data.json')
        stored_testimonials = []
        try:
            if os.path.exists(data_file):
                with open(data_file, 'r', encoding='utf-8') as f:
                    import json
                    json_data = json.load(f)
                    stored_testimonials = json_data.get('testimonials', [])
        except Exception as e:
            pass

        if request.method == 'GET':
            role = request.args.get('role')
            if role in ['student', 'teacher']:
                filtered = [t for t in stored_testimonials if t.get('role') == role]
            else:
                filtered = stored_testimonials
            return jsonify({
                'success': True,
                'count': len(filtered),
                'total': len(stored_testimonials),
                'testimonials': filtered
            })

        # POST new testimonial
        data = request.get_json(silent=True) or request.form or {}
        name = (data.get('name') or '').strip()
        quote = (data.get('quote') or '').strip()
        role = 'teacher' if data.get('role') == 'teacher' else 'student'

        if not name or len(name) < 2:
            return jsonify({'success': False, 'error': 'Full name is required (min 2 characters)'}), 400
        if not quote or len(quote) < 10:
            return jsonify({'success': False, 'error': 'Feedback quote must be at least 10 characters long'}), 400

        name_parts = name.split()
        initials = (name_parts[0][0] + name_parts[-1][0]).upper() if len(name_parts) >= 2 else name[:2].upper()
        colors = ['#10b981', '#4f46e5', '#0284c7', '#d97706', '#f43f5e', '#8b5cf6', '#0d9488']
        import random
        avatar_color = random.choice(colors)

        new_t = {
            'id': len(stored_testimonials) + 1,
            'name': name,
            'role': role,
            'role_title': data.get('role_title', 'Faculty Guide' if role == 'teacher' else 'Student Project Member'),
            'department': data.get('department', 'Engineering & Technology'),
            'avatar_initials': initials,
            'avatar_color': avatar_color,
            'rating': int(data.get('rating', 5)),
            'quote': quote,
            'project_or_focus': data.get('project_or_focus', 'Project Monitoring & Evaluation' if role == 'teacher' else 'Final Year Project Work'),
            'impact_tag': data.get('impact_tag', 'Verified Feedback'),
            'date': datetime.utcnow().strftime('%b %Y'),
            'verified': True
        }

        stored_testimonials.insert(0, new_t)
        try:
            if os.path.exists(data_file):
                with open(data_file, 'r', encoding='utf-8') as f:
                    import json
                    json_data = json.load(f)
                json_data['testimonials'] = stored_testimonials
                with open(data_file, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=2)
        except Exception:
            pass

        return jsonify({
            'success': True,
            'message': 'Testimonial submitted successfully!',
            'testimonial': new_t
        }), 201

    # Serve uploaded files
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # Serve frontend HTML / static files when accessed directly via Flask
    @app.route('/')
    def serve_index():
        if os.path.exists(os.path.join(base_dir, 'project monitoring sysytem.html')):
            return send_from_directory(base_dir, 'project monitoring sysytem.html')
        return send_from_directory(base_dir, 'index.html')

    @app.route('/<path:path>')
    def serve_static_file(path):
        # Ignore API calls reaching static router
        if path.startswith('api/'):
            return jsonify({'error': 'Not found'}), 404
        if os.path.exists(os.path.join(base_dir, path)):
            return send_from_directory(base_dir, path)
        return jsonify({'error': 'Resource not found'}), 404

    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'error': 'API route not found'}), 404
        return send_from_directory(base_dir, 'index.html')

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
