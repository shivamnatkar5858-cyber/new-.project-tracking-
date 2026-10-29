from flask import Blueprint, jsonify, request, g
from models import db, User, Student, Project, TeamMember, Milestone, Report, Document, Notification
from auth_middleware import token_required, get_current_user_from_request

student_bp = Blueprint('student', __name__)

@student_bp.route('/api/student/dashboard', methods=['GET'])
def get_student_dashboard():
    user = get_current_user_from_request()

    student = None
    project = None

    if user and user.role in ['student', 'admin']:
        student = user.student_profile
        if student and student.project_id:
            project = Project.query.get(student.project_id)

    # Fallback to the SIH26103 project so students/visitors always see their active project
    if not project:
        project = Project.query.filter_by(project_code='SIH26103').first() or Project.query.first()

    if not student and user and user.student_profile:
        student = user.student_profile

    # Calculate statistics
    total_projects = 1 if project else 0
    in_progress = 1 if project and project.status.lower() in ['in progress', 'active'] else 0
    completed = 1 if project and project.status.lower() == 'completed' else 0
    overall_progress = project.progress if project else 75

    team_members = []
    milestones = []
    reports = []
    feedbacks = []
    documents = []

    if project:
        team_members = [m.to_dict() for m in project.team_members]
        milestones = [m.to_dict() for m in project.milestones]
        reports = [r.to_dict() for r in project.reports]
        documents = [d.to_dict() for d in project.documents]

        # Extract teacher feedback from reviewed reports
        for r in project.reports:
            if r.feedback:
                feedbacks.append({
                    'teacher_name': project.guide.name if project.guide else 'Prof. Kadam Sir',
                    'message': r.feedback,
                    'date': r.submission_date.strftime('%d %b %Y') if r.submission_date else 'Recently',
                    'report_title': r.title
                })

    # If no feedbacks yet, provide guide's standard feedback items from prompt
    if not feedbacks:
        guide_name = project.guide.name if project and project.guide else 'Prof. Sharma'
        feedbacks = [
            {
                'teacher_name': guide_name,
                'message': 'Frontend design is good. Continue backend development.',
                'date': 'Yesterday'
            },
            {
                'teacher_name': guide_name,
                'message': 'Please add database connectivity and project report.',
                'date': '3 days ago'
            }
        ]

    # Notifications
    notifications = []
    if user:
        user_notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(10).all()
        notifications = [n.to_dict() for n in user_notifs]

    if not notifications:
        # Default project notifications
        notifications = [
            {
                'title': 'Project Review',
                'message': 'Project review meeting scheduled this week.',
                'type': 'alert',
                'time': 'Today'
            },
            {
                'title': 'Report Deadline',
                'message': 'Submit your progress report before the deadline.',
                'type': 'deadline',
                'time': '2 days ago'
            }
        ]

    student_name = student.name if student else (user.email.split('@')[0] if user else 'Shivam Natkar')
    department = student.department if student else (project.department if project else 'E&ACT')

    return jsonify({
        'success': True,
        'student': {
            'name': student_name,
            'roll_no': student.roll_no if student else '01',
            'department': department,
            'year': student.year if student else 'Final Year',
            'email': user.email if user else 'shivamnatkarcsmss@gmail.com'
        },
        'stats': {
            'totalProjects': total_projects,
            'inProgress': in_progress,
            'completed': completed,
            'overallProgress': f"{overall_progress}%"
        },
        'project': project.to_dict(include_details=True) if project else None,
        'team_members': team_members,
        'milestones': milestones,
        'reports': reports,
        'feedbacks': feedbacks,
        'documents': documents,
        'notifications': notifications
    }), 200
