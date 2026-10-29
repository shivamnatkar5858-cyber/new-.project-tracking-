from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')  # 'student', 'teacher', 'admin'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    student_profile = db.relationship('Student', backref='user', uselist=False, cascade='all, delete-orphan')
    teacher_profile = db.relationship('Teacher', backref='user', uselist=False, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        data = {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if self.role == 'student' and self.student_profile:
            data['profile'] = self.student_profile.to_dict()
        elif self.role == 'teacher' and self.teacher_profile:
            data['profile'] = self.teacher_profile.to_dict()
        return data


class Student(db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    roll_no = db.Column(db.String(30), nullable=True)
    department = db.Column(db.String(100), nullable=False, default='E&ACT')
    year = db.Column(db.String(20), default='Final Year')
    phone = db.Column(db.String(20), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'roll_no': self.roll_no,
            'department': self.department,
            'year': self.year,
            'phone': self.phone,
            'project_id': self.project_id
        }


class Teacher(db.Model):
    __tablename__ = 'teachers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False, default='E&ACT')
    designation = db.Column(db.String(100), default='Assistant Professor')
    phone = db.Column(db.String(20), nullable=True)

    # Projects guided
    guided_projects = db.relationship('Project', backref='guide', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'department': self.department,
            'designation': self.designation,
            'phone': self.phone
        }


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    project_code = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. SIH26103
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    department = db.Column(db.String(100), nullable=False, default='E&ACT')
    guide_id = db.Column(db.Integer, db.ForeignKey('teachers.id', ondelete='SET NULL'), nullable=True)
    progress = db.Column(db.Integer, default=0)  # 0 to 100
    status = db.Column(db.String(30), default='In Progress')  # 'In Progress', 'Completed', 'At Risk', 'Pending Review'
    start_date = db.Column(db.String(50), default='01 Sep 2026')
    expected_completion = db.Column(db.String(50), default='30 Nov 2026')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    team_members = db.relationship('TeamMember', backref='project', lazy=True, cascade='all, delete-orphan')
    milestones = db.relationship('Milestone', backref='project', lazy=True, order_by='Milestone.order_index', cascade='all, delete-orphan')
    reports = db.relationship('Report', backref='project', lazy=True, order_by='Report.submission_date.desc()', cascade='all, delete-orphan')
    documents = db.relationship('Document', backref='project', lazy=True, order_by='Document.uploaded_at.desc()', cascade='all, delete-orphan')
    students = db.relationship('Student', backref='project', lazy=True)

    def to_dict(self, include_details=True):
        guide_name = self.guide.name if self.guide else 'Prof. Kadam Sir'
        data = {
            'id': self.id,
            'project_code': self.project_code,
            'title': self.title,
            'description': self.description,
            'department': self.department,
            'guide_id': self.guide_id,
            'guide_name': guide_name,
            'progress': self.progress,
            'status': self.status,
            'start_date': self.start_date,
            'expected_completion': self.expected_completion,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_details:
            data['team_members'] = [m.to_dict() for m in self.team_members]
            data['milestones'] = [m.to_dict() for m in self.milestones]
            data['reports'] = [r.to_dict() for r in self.reports]
            data['documents'] = [d.to_dict() for d in self.documents]
        return data


class TeamMember(db.Model):
    __tablename__ = 'team_members'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id', ondelete='SET NULL'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    roll_no = db.Column(db.String(30), nullable=True)
    role = db.Column(db.String(50), default='Team Member')  # e.g., 'Team Leader', 'Developer'

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'student_id': self.student_id,
            'name': self.name,
            'roll_no': self.roll_no,
            'role': self.role
        }


class Milestone(db.Model):
    __tablename__ = 'milestones'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.String(50), nullable=True)
    is_completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'title': self.title,
            'description': self.description,
            'due_date': self.due_date,
            'is_completed': self.is_completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'order_index': self.order_index
        }


class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(300), nullable=True)
    original_filename = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(30), default='pending')  # 'pending', 'reviewed', 'approved', 'rejected'
    feedback = db.Column(db.Text, nullable=True)
    submission_date = db.Column(db.DateTime, default=datetime.utcnow)

    # Submitter helper
    submitter = db.relationship('User', foreign_keys=[submitted_by_id])

    def to_dict(self):
        submitter_name = 'Student'
        if self.submitter and self.submitter.student_profile:
            submitter_name = self.submitter.student_profile.name
        elif self.submitter:
            submitter_name = self.submitter.email

        return {
            'id': self.id,
            'project_id': self.project_id,
            'submitted_by_id': self.submitted_by_id,
            'submitter_name': submitter_name,
            'title': self.title,
            'description': self.description,
            'file_path': self.file_path,
            'original_filename': self.original_filename,
            'status': self.status,
            'feedback': self.feedback,
            'submission_date': self.submission_date.isoformat() if self.submission_date else None
        }


class Document(db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    file_path = db.Column(db.String(300), nullable=False)
    original_filename = db.Column(db.String(200), nullable=False)
    file_type = db.Column(db.String(50), nullable=True)
    file_size = db.Column(db.Integer, default=0)  # bytes
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    uploader = db.relationship('User', foreign_keys=[uploaded_by_id])

    def to_dict(self):
        uploader_name = 'User'
        if self.uploader and self.uploader.student_profile:
            uploader_name = self.uploader.student_profile.name
        elif self.uploader and self.uploader.teacher_profile:
            uploader_name = self.uploader.teacher_profile.name
        elif self.uploader:
            uploader_name = self.uploader.email

        return {
            'id': self.id,
            'project_id': self.project_id,
            'uploaded_by_id': self.uploaded_by_id,
            'uploader_name': uploader_name,
            'title': self.title,
            'file_path': self.file_path,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(30), default='info')  # 'info', 'alert', 'deadline', 'feedback'
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
