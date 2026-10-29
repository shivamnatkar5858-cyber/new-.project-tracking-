from datetime import datetime
from flask import Blueprint, jsonify, request, g
from models import db, User, Teacher, Student, Project, TeamMember, Report, Notification
from auth_middleware import token_required, get_current_user_from_request

teacher_bp = Blueprint('teacher', __name__)

@teacher_bp.route('/api/teacher/dashboard', methods=['GET'])
def get_teacher_dashboard():
    user = get_current_user_from_request()
    teacher = None
    if user and user.role in ['teacher', 'admin']:
        teacher = user.teacher_profile

    # Fetch projects: if teacher is identified, their guided projects (or all projects if admin/demo)
    if teacher and teacher.guided_projects:
        projects = teacher.guided_projects
    else:
        projects = Project.query.order_by(Project.created_at.desc()).all()

    total_projects = len(projects)
    active_projects = sum(1 for p in projects if p.status in ['In Progress', 'Active'])
    completed_projects = sum(1 for p in projects if p.status == 'Completed')
    risk_projects = sum(1 for p in projects if p.status == 'At Risk')

    # Build project list with team counts
    project_list = []
    chart_labels = []
    chart_data = []

    for p in projects:
        lead = p.team_members[0].name if p.team_members else 'Assigned Team'
        member_count = len(p.team_members)
        project_list.append({
            'id': p.id,
            'project_code': p.project_code,
            'title': p.title,
            'department': p.department,
            'progress': p.progress,
            'status': p.status,
            'team_leader': lead,
            'team_count': f"{member_count} Students" if member_count else "1 Student",
            'deadline': p.expected_completion,
            'description': p.description or 'Integrated project monitoring and milestone tracking.'
        })
        chart_labels.append(p.project_code)
        chart_data.append(p.progress)

    # Deadlines
    deadlines = [
        {
            'project': p.title,
            'code': p.project_code,
            'deadline': p.expected_completion,
            'type': 'Phase Submission' if p.progress < 50 else 'Final Evaluation',
            'status': 'Urgent' if p.status == 'At Risk' else 'Upcoming'
        }
        for p in projects[:4]
    ]

    # Recent reports
    reports = Report.query.order_by(Report.submission_date.desc()).limit(6).all()
    recent_reports = [r.to_dict() for r in reports]

    # Recent activity
    recent_activity = [
        {
            'title': 'Milestone Completed',
            'project': 'SIH26103',
            'detail': 'Frontend Development completed by Shivam Natkar',
            'time': '2 hours ago',
            'icon': 'circle-check'
        },
        {
            'title': 'Progress Updated',
            'project': 'SIH26103',
            'detail': 'Progress increased to 75%',
            'time': 'Yesterday',
            'icon': 'chart-line'
        },
        {
            'title': 'Report Submitted',
            'project': 'SIH26103',
            'detail': 'Synopsis & SRS document uploaded for review',
            'time': '3 days ago',
            'icon': 'file-arrow-up'
        }
    ]

    teacher_name = teacher.name if teacher else 'Prof. Kadam'
    teacher_designation = teacher.designation if teacher else 'Project Guide & Faculty'
    department = teacher.department if teacher else 'E&ACT'

    return jsonify({
        'success': True,
        'teacher': {
            'name': teacher_name,
            'initials': ''.join([part[0] for part in teacher_name.split() if part][:2]).upper() or 'PK',
            'designation': teacher_designation,
            'department': department,
            'email': user.email if user else 'teacher@csmss.edu'
        },
        'stats': {
            'totalProjects': total_projects,
            'activeProjects': active_projects,
            'completedProjects': completed_projects,
            'riskProjects': risk_projects
        },
        'projects': project_list,
        'chart': {
            'labels': chart_labels,
            'data': chart_data
        },
        'deadlines': deadlines,
        'recentReports': recent_reports,
        'recentActivity': recent_activity
    }), 200


@teacher_bp.route('/api/teacher/students', methods=['GET'])
def get_students():
    students = Student.query.all()
    data = []
    for s in students:
        p = Project.query.get(s.project_id) if s.project_id else None
        data.append({
            'id': s.id,
            'name': s.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'year': s.year,
            'phone': s.phone,
            'project_id': s.project_id,
            'project_code': p.project_code if p else None,
            'project_title': p.title if p else 'Unassigned'
        })
    return jsonify({
        'success': True,
        'students': data
    }), 200


@teacher_bp.route('/api/teacher/assign', methods=['POST'])
def assign_student_project():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    project_id = data.get('project_id')

    if not student_id or not project_id:
        return jsonify({'success': False, 'error': 'student_id and project_id are required'}), 400

    student = Student.query.get(student_id)
    project = Project.query.get(project_id)

    if not student or not project:
        return jsonify({'success': False, 'error': 'Student or Project not found'}), 404

    student.project_id = project.id

    # Check if team member record exists
    existing = TeamMember.query.filter_by(project_id=project.id, student_id=student.id).first()
    if not existing:
        tm = TeamMember(
            project_id=project.id,
            student_id=student.id,
            name=student.name,
            roll_no=student.roll_no,
            role='Team Member'
        )
        db.session.add(tm)

    # Notify student
    notif = Notification(
        user_id=student.user_id,
        title='Project Assigned',
        message=f'You have been assigned to project: {project.title} ({project.project_code})',
        type='info'
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Student {student.name} assigned to {project.project_code}'
    }), 200
