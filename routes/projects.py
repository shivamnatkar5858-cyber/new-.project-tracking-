from datetime import datetime
from flask import Blueprint, request, jsonify, g
from models import db, Project, TeamMember, Milestone, Teacher, Student, Notification
from auth_middleware import token_required, get_current_user_from_request

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/api/projects', methods=['GET'])
def get_projects():
    status = request.args.get('status')
    search = request.args.get('search')
    department = request.args.get('department')

    query = Project.query

    if status and status.lower() != 'all':
        if status.lower() == 'active':
            query = query.filter(Project.status.in_(['In Progress', 'Active']))
        elif status.lower() == 'completed':
            query = query.filter(Project.status == 'Completed')
        elif status.lower() == 'risk':
            query = query.filter(Project.status == 'At Risk')
        else:
            query = query.filter(Project.status.ilike(f"%{status}%"))

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            db.or_(
                Project.title.ilike(search_filter),
                Project.project_code.ilike(search_filter),
                Project.department.ilike(search_filter)
            )
        )

    if department:
        query = query.filter(Project.department.ilike(f"%{department}%"))

    projects = query.order_by(Project.created_at.desc()).all()
    return jsonify({
        'success': True,
        'count': len(projects),
        'projects': [p.to_dict(include_details=False) for p in projects]
    }), 200


@projects_bp.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json() or {}
    project_code = data.get('project_code', '').strip()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    department = data.get('department', 'E&ACT').strip()
    guide_id = data.get('guide_id')
    start_date = data.get('start_date', '01 Sep 2026')
    expected_completion = data.get('expected_completion', '30 Nov 2026')
    status = data.get('status', 'In Progress')
    progress = int(data.get('progress', 0))

    if not project_code or not title:
        return jsonify({'success': False, 'error': 'project_code and title are required'}), 400

    existing = Project.query.filter_by(project_code=project_code).first()
    if existing:
        return jsonify({'success': False, 'error': f'Project code {project_code} already exists'}), 409

    project = Project(
        project_code=project_code,
        title=title,
        description=description,
        department=department,
        guide_id=guide_id,
        progress=progress,
        status=status,
        start_date=start_date,
        expected_completion=expected_completion
    )
    db.session.add(project)
    db.session.flush()

    # Create standard initial milestones
    default_milestones = [
        ("Project Topic Selection", True),
        ("Requirement Analysis", True),
        ("System Design", True),
        ("Frontend Development", True),
        ("Backend Development", False),
        ("Testing & Final Report", False)
    ]
    for idx, (m_title, completed) in enumerate(default_milestones):
        m = Milestone(
            project_id=project.id,
            title=m_title,
            is_completed=completed,
            order_index=idx
        )
        db.session.add(m)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Project created successfully',
        'project': project.to_dict(include_details=True)
    }), 201


@projects_bp.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project_by_id(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404
    return jsonify({'success': True, 'project': project.to_dict(include_details=True)}), 200


@projects_bp.route('/api/projects/code/<string:project_code>', methods=['GET'])
def get_project_by_code(project_code):
    project = Project.query.filter_by(project_code=project_code).first()
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404
    return jsonify({'success': True, 'project': project.to_dict(include_details=True)}), 200


@projects_bp.route('/api/projects/<int:project_id>', methods=['PUT', 'PATCH'])
def update_project(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    data = request.get_json() or {}
    if 'title' in data:
        project.title = data['title'].strip()
    if 'description' in data:
        project.description = data['description'].strip()
    if 'department' in data:
        project.department = data['department'].strip()
    if 'progress' in data:
        project.progress = max(0, min(100, int(data['progress'])))
    if 'status' in data:
        project.status = data['status']
    if 'start_date' in data:
        project.start_date = data['start_date']
    if 'expected_completion' in data:
        project.expected_completion = data['expected_completion']
    if 'guide_id' in data:
        project.guide_id = data['guide_id']

    project.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Project updated successfully',
        'project': project.to_dict(include_details=True)
    }), 200


@projects_bp.route('/api/projects/<int:project_id>/progress', methods=['POST', 'PUT'])
def update_project_progress(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    data = request.get_json() or {}
    progress_val = data.get('progress')

    if progress_val is None:
        return jsonify({'success': False, 'error': 'progress value is required'}), 400

    try:
        progress = max(0, min(100, int(progress_val)))
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid progress value'}), 400

    project.progress = progress
    if 'status' in data:
        project.status = data['status']
    elif progress == 100:
        project.status = 'Completed'
    elif progress > 0 and project.status == 'Not Started':
        project.status = 'In Progress'

    project.updated_at = datetime.utcnow()

    # Notify guide if exists
    if project.guide and project.guide.user:
        notif = Notification(
            user_id=project.guide.user.id,
            title=f'Project Progress Updated: {project.project_code}',
            message=f'Progress updated to {progress}% ({project.status})',
            type='info'
        )
        db.session.add(notif)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Project progress updated',
        'progress': project.progress,
        'status': project.status
    }), 200


@projects_bp.route('/api/projects/<int:project_id>/team', methods=['GET'])
def get_project_team(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    members = [m.to_dict() for m in project.team_members]
    return jsonify({'success': True, 'team_members': members}), 200


@projects_bp.route('/api/projects/<int:project_id>/team', methods=['POST'])
def add_team_member(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    roll_no = data.get('roll_no', '').strip()
    role = data.get('role', 'Team Member').strip()

    if not name:
        return jsonify({'success': False, 'error': 'Name is required'}), 400

    member = TeamMember(
        project_id=project.id,
        name=name,
        roll_no=roll_no,
        role=role
    )
    db.session.add(member)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Team member added',
        'member': member.to_dict()
    }), 201


@projects_bp.route('/api/projects/<int:project_id>/team/<int:member_id>', methods=['DELETE'])
def remove_team_member(project_id, member_id):
    member = TeamMember.query.filter_by(id=member_id, project_id=project_id).first()
    if not member:
        return jsonify({'success': False, 'error': 'Member not found'}), 404

    db.session.delete(member)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Member removed successfully'}), 200
