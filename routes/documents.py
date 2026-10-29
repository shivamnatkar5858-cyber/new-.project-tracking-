import os
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app, send_from_directory, send_file
from models import db, Document, Project
from auth_middleware import get_current_user_from_request

documents_bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'zip'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@documents_bp.route('/api/documents', methods=['GET'])
def get_documents():
    project_id = request.args.get('project_id')
    query = Document.query
    if project_id:
        query = query.filter_by(project_id=project_id)

    documents = query.order_by(Document.uploaded_at.desc()).all()
    return jsonify({
        'success': True,
        'documents': [d.to_dict() for d in documents]
    }), 200


@documents_bp.route('/api/documents', methods=['POST'])
def upload_document():
    user = get_current_user_from_request()

    title = request.form.get('title')
    project_id = request.form.get('project_id')

    if not project_id:
        if user and user.student_profile and user.student_profile.project_id:
            project_id = user.student_profile.project_id
        else:
            default_proj = Project.query.filter_by(project_code='SIH26103').first() or Project.query.first()
            if default_proj:
                project_id = default_proj.id

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part in request'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'File type not allowed. Supported: pdf, doc, docx, ppt, pptx, zip, etc.'}), 400

    orig_name = secure_filename(file.filename)
    if not title:
        title = orig_name

    ext = orig_name.rsplit('.', 1)[1].lower() if '.' in orig_name else 'file'
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"doc_{timestamp}_{orig_name}"

    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, filename)
    file.save(save_path)

    file_size = os.path.getsize(save_path) if os.path.exists(save_path) else 0

    doc = Document(
        project_id=project_id,
        uploaded_by_id=user.id if user else None,
        title=title,
        file_path=f"/uploads/{filename}",
        original_filename=orig_name,
        file_type=ext.upper(),
        file_size=file_size,
        uploaded_at=datetime.utcnow()
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Document uploaded successfully',
        'document': doc.to_dict()
    }), 201


@documents_bp.route('/api/documents/download/<int:doc_id>', methods=['GET'])
def download_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({'success': False, 'error': 'Document not found'}), 404

    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    # Extract filename from /uploads/filename
    fname = os.path.basename(doc.file_path)
    file_full_path = os.path.join(upload_dir, fname)

    if not os.path.exists(file_full_path):
        return jsonify({'success': False, 'error': 'File not found on server'}), 404

    return send_file(file_full_path, as_attachment=True, download_name=doc.original_filename)


@documents_bp.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({'success': False, 'error': 'Document not found'}), 404

    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    fname = os.path.basename(doc.file_path)
    file_full_path = os.path.join(upload_dir, fname)

    if os.path.exists(file_full_path):
        try:
            os.remove(file_full_path)
        except Exception:
            pass

    db.session.delete(doc)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Document deleted successfully'}), 200
