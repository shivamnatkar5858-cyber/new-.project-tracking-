from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Notification, User, Project, Student
from auth_middleware import get_current_user_from_request

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/api/notifications', methods=['GET'])
def get_notifications():
    user = get_current_user_from_request()
    unread_only = request.args.get('unread') == 'true'

    if user:
        query = Notification.query.filter_by(user_id=user.id)
    else:
        query = Notification.query

    if unread_only:
        query = query.filter_by(is_read=False)

    notifications = query.order_by(Notification.created_at.desc()).limit(20).all()

    # If empty in demo mode, return default notification set
    if not notifications:
        return jsonify({
            'success': True,
            'count': 2,
            'notifications': [
                {
                    'id': 1,
                    'title': 'Project Review',
                    'message': 'Project review meeting scheduled this week with Prof. Kadam.',
                    'type': 'alert',
                    'is_read': False,
                    'created_at': datetime.utcnow().isoformat()
                },
                {
                    'id': 2,
                    'title': 'Report Deadline',
                    'message': 'Submit your progress report before the deadline (30 Nov 2026).',
                    'type': 'deadline',
                    'is_read': False,
                    'created_at': datetime.utcnow().isoformat()
                }
            ]
        }), 200

    return jsonify({
        'success': True,
        'count': len(notifications),
        'notifications': [n.to_dict() for n in notifications]
    }), 200


@notifications_bp.route('/api/notifications', methods=['POST'])
def send_notification():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    message = data.get('message', '').strip()
    notif_type = data.get('type', 'info')
    user_id = data.get('user_id')
    project_id = data.get('project_id')

    if not title or not message:
        return jsonify({'success': False, 'error': 'Title and message are required'}), 400

    created_notifs = []

    if user_id:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type
        )
        db.session.add(notif)
        created_notifs.append(notif)

    elif project_id:
        # Send to all students in project
        students = Student.query.filter_by(project_id=project_id).all()
        for s in students:
            notif = Notification(
                user_id=s.user_id,
                title=title,
                message=message,
                type=notif_type
            )
            db.session.add(notif)
            created_notifs.append(notif)

    else:
        # Broadcast to all users
        all_users = User.query.all()
        for u in all_users:
            notif = Notification(
                user_id=u.id,
                title=title,
                message=message,
                type=notif_type
            )
            db.session.add(notif)
            created_notifs.append(notif)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Notification sent to {len(created_notifs)} user(s)',
        'count': len(created_notifs)
    }), 201


@notifications_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST', 'PUT'])
def mark_notification_read(notif_id):
    notif = Notification.query.get(notif_id)
    if not notif:
        return jsonify({'success': False, 'error': 'Notification not found'}), 404

    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True, 'message': 'Notification marked as read'}), 200
