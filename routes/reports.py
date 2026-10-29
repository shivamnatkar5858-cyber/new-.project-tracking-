import os
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app
from models import db, Report, Project, User, Notification
from auth_middleware import get_current_user_from_request

reports_bp = Blueprint('reports', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@reports_bp.route('/api/reports', methods=['GET'])
def get_reports():
    project_id = request.args.get('project_id')
    status = request.args.get('status')

    query = Report.query
    if project_id:
        query = query.filter_by(project_id=project_id)
    if status:
        query = query.filter_by(status=status)

    reports = query.order_by(Report.submission_date.desc()).all()
    return jsonify({
        'success': True,
        'reports': [r.to_dict() for r in reports]
    }), 200


@reports_bp.route('/api/reports', methods=['POST'])
def submit_report():
    user = get_current_user_from_request()

    title = request.form.get('title') or (request.json.get('title') if request.is_json else None)
    description = request.form.get('description', '') or (request.json.get('description', '') if request.is_json else '')
    project_id = request.form.get('project_id') or (request.json.get('project_id') if request.is_json else None)

    # If no project_id provided, deduce from user or default to SIH26103
    if not project_id:
        if user and user.student_profile and user.student_profile.project_id:
            project_id = user.student_profile.project_id
        else:
            default_proj = Project.query.filter_by(project_code='SIH26103').first() or Project.query.first()
            if default_proj:
                project_id = default_proj.id

    if not title:
        title = "Progress Report Submission"

    file_path = None
    original_filename = None

    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename and allowed_file(file.filename):
            orig_name = secure_filename(file.filename)
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f"report_{timestamp}_{orig_name}"
            upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            save_path = os.path.join(upload_dir, filename)
            file.save(save_path)
            file_path = f"/uploads/{filename}"
            original_filename = orig_name

    report = Report(
        project_id=project_id,
        submitted_by_id=user.id if user else None,
        title=title,
        description=description,
        file_path=file_path,
        original_filename=original_filename,
        status='pending',
        submission_date=datetime.utcnow()
    )
    db.session.add(report)

    # Notify project guide if assigned
    project = Project.query.get(project_id)
    if project and project.guide and project.guide.user:
        notif = Notification(
            user_id=project.guide.user.id,
            title=f'New Report Submitted: {title}',
            message=f'Student submitted a report for {project.project_code}',
            type='info'
        )
        db.session.add(notif)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Report submitted successfully',
        'report': report.to_dict()
    }), 201


@reports_bp.route('/api/reports/<int:report_id>/review', methods=['POST'])
def review_report(report_id):
    report = Report.query.get(report_id)
    if not report:
        return jsonify({'success': False, 'error': 'Report not found'}), 404

    data = request.get_json() or {}
    status = data.get('status', 'reviewed')
    feedback = data.get('feedback', '').strip()

    report.status = status
    if feedback:
        report.feedback = feedback

    # Notify submitter
    if report.submitted_by_id:
        notif = Notification(
            user_id=report.submitted_by_id,
            title=f'Report Reviewed: {report.title}',
            message=f'Status: {status}. Feedback: {feedback or "Reviewed by guide."}',
            type='feedback'
        )
        db.session.add(notif)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Report review saved',
        'report': report.to_dict()
    }), 200
