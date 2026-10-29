from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Milestone, Project
from auth_middleware import token_required

milestones_bp = Blueprint('milestones', __name__)

@milestones_bp.route('/api/milestones', methods=['GET'])
def get_milestones():
    project_id = request.args.get('project_id')
    project_code = request.args.get('project_code')

    query = Milestone.query

    if project_id:
        query = query.filter_by(project_id=project_id)
    elif project_code:
        project = Project.query.filter_by(project_code=project_code).first()
        if project:
            query = query.filter_by(project_id=project.id)
        else:
            return jsonify({'success': True, 'milestones': []}), 200

    milestones = query.order_by(Milestone.order_index).all()
    return jsonify({
        'success': True,
        'milestones': [m.to_dict() for m in milestones]
    }), 200


@milestones_bp.route('/api/milestones', methods=['POST'])
def create_milestone():
    data = request.get_json() or {}
    project_id = data.get('project_id')
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    due_date = data.get('due_date')
    is_completed = bool(data.get('is_completed', False))
    order_index = int(data.get('order_index', 0))

    if not project_id or not title:
        return jsonify({'success': False, 'error': 'project_id and title are required'}), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    milestone = Milestone(
        project_id=project.id,
        title=title,
        description=description,
        due_date=due_date,
        is_completed=is_completed,
        completed_at=datetime.utcnow() if is_completed else None,
        order_index=order_index
    )
    db.session.add(milestone)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Milestone created',
        'milestone': milestone.to_dict()
    }), 201


@milestones_bp.route('/api/milestones/<int:milestone_id>', methods=['PUT', 'PATCH'])
def update_milestone(milestone_id):
    milestone = Milestone.query.get(milestone_id)
    if not milestone:
        return jsonify({'success': False, 'error': 'Milestone not found'}), 404

    data = request.get_json() or {}
    if 'title' in data:
        milestone.title = data['title'].strip()
    if 'description' in data:
        milestone.description = data['description'].strip()
    if 'due_date' in data:
        milestone.due_date = data['due_date']
    if 'is_completed' in data:
        was_completed = milestone.is_completed
        milestone.is_completed = bool(data['is_completed'])
        if milestone.is_completed and not was_completed:
            milestone.completed_at = datetime.utcnow()
        elif not milestone.is_completed:
            milestone.completed_at = None
    if 'order_index' in data:
        milestone.order_index = int(data['order_index'])

    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Milestone updated',
        'milestone': milestone.to_dict()
    }), 200


@milestones_bp.route('/api/milestones/<int:milestone_id>', methods=['DELETE'])
def delete_milestone(milestone_id):
    milestone = Milestone.query.get(milestone_id)
    if not milestone:
        return jsonify({'success': False, 'error': 'Milestone not found'}), 404

    db.session.delete(milestone)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Milestone deleted successfully'}), 200
