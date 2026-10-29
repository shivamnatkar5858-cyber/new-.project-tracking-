import os
from datetime import datetime, timedelta
from app import create_app
from models import (
    db, User, Student, Teacher, Project, TeamMember,
    Milestone, Report, Document, Notification
)

def seed_database():
    app = create_app()
    with app.app_context():
        print("Clearing old tables and recreating schema...")
        db.drop_all()
        db.create_all()

        print("Seeding Users...")
        # 1. Teacher: Prof. Kadam
        teacher_user = User(email='teacher@csmss.edu', role='teacher')
        teacher_user.set_password('password123')
        db.session.add(teacher_user)
        db.session.flush()

        teacher_profile = Teacher(
            user_id=teacher_user.id,
            name='Prof. Kadam',
            department='E&ACT',
            designation='Assistant Professor & Project Coordinator',
            phone='+91 9876543210'
        )
        db.session.add(teacher_profile)
        db.session.flush()

        # 2. Main Student: Shivam Natkar
        student_user = User(email='student@csmss.edu', role='student')
        student_user.set_password('password123')
        db.session.add(student_user)

        # Also support the user's gmail from metadata
        student_user_alt = User(email='shivamnatkarcsmss@gmail.com', role='student')
        student_user_alt.set_password('password123')
        db.session.add(student_user_alt)
        db.session.flush()

        print("Seeding Main Project: SIH26103...")
        # 3. Main Project: SIH26103
        main_project = Project(
            project_code='SIH26103',
            title='Web-Based Project Monitoring System',
            description='Integrated college project monitoring platform enabling students to submit progress reports, upload project documentation, track milestones, and receive real-time guide feedback.',
            department='E&ACT',
            guide_id=teacher_profile.id,
            progress=75,
            status='In Progress',
            start_date='01 Sep 2026',
            expected_completion='30 Nov 2026'
        )
        db.session.add(main_project)
        db.session.flush()

        # Student Profile for Shivam
        student_profile = Student(
            user_id=student_user.id,
            name='Shivam Natkar',
            roll_no='26EACT01',
            department='E&ACT',
            year='Final Year',
            phone='+91 9123456780',
            project_id=main_project.id
        )
        db.session.add(student_profile)

        student_profile_alt = Student(
            user_id=student_user_alt.id,
            name='Shivam Natkar',
            roll_no='26EACT01',
            department='E&ACT',
            year='Final Year',
            phone='+91 9123456780',
            project_id=main_project.id
        )
        db.session.add(student_profile_alt)

        print("Seeding Team Members...")
        # Team Members as requested in prompt:
        # 1. Shivam Natkar
        # 2. Sakshi Arbad
        # 3. Tejal Bhanuse
        # 4. Karan Sangle
        # 5. Abhishek Malwade
        team = [
            ("Shivam Natkar", "26EACT01", "Team Leader / Full-Stack Developer", student_profile.id),
            ("Sakshi Arbad", "26EACT02", "UI/UX & Frontend Designer", None),
            ("Tejal Bhanuse", "26EACT03", "Backend & Database Developer", None),
            ("Karan Sangle", "26EACT04", "Testing & Quality Assurance", None),
            ("Abhishek Malwade", "26EACT05", "Documentation & Presentation", None)
        ]

        for name, roll, role, st_id in team:
            tm = TeamMember(
                project_id=main_project.id,
                student_id=st_id,
                name=name,
                roll_no=roll,
                role=role
            )
            db.session.add(tm)

        print("Seeding Milestones...")
        # Milestones from prompt:
        # Project Topic Selection (Complete)
        # Requirement Analysis (Complete)
        # System Design (Complete)
        # Frontend Development (Complete)
        # Backend Development (Pending)
        # Testing & Final Report (Pending)
        milestones = [
            ("Project Topic Selection", "Literature review and problem statement finalization.", "10 Sep 2026", True, 0),
            ("Requirement Analysis", "SRS document preparation and user persona definition.", "20 Sep 2026", True, 1),
            ("System Design", "Database schema and UI architecture design completed.", "30 Sep 2026", True, 2),
            ("Frontend Development", "Responsive HTML5/CSS3 and interactive client scripts.", "15 Oct 2026", True, 3),
            ("Backend Development", "Flask REST APIs, SQLAlchemy models, and authentication.", "10 Nov 2026", False, 4),
            ("Testing & Final Report", "System validation, unit testing, and final documentation.", "30 Nov 2026", False, 5)
        ]

        for title, desc, due, completed, idx in milestones:
            m = Milestone(
                project_id=main_project.id,
                title=title,
                description=desc,
                due_date=due,
                is_completed=completed,
                completed_at=datetime.utcnow() - timedelta(days=(4-idx)*5) if completed else None,
                order_index=idx
            )
            db.session.add(m)

        print("Seeding Reports...")
        # Create uploads folder and sample sample files
        upload_dir = app.config['UPLOAD_FOLDER']
        os.makedirs(upload_dir, exist_ok=True)

        sample_file_1 = os.path.join(upload_dir, "Project_SRS_Document_SIH26103.pdf")
        with open(sample_file_1, "w") as f:
            f.write("%PDF-1.4\n% ProjectTrack SRS Document - SIH26103 Web-Based Project Monitoring System\n")

        sample_file_2 = os.path.join(upload_dir, "Frontend_Architecture_Phase2.pdf")
        with open(sample_file_2, "w") as f:
            f.write("%PDF-1.4\n% ProjectTrack Frontend Architecture & User Flows\n")

        rep1 = Report(
            project_id=main_project.id,
            submitted_by_id=student_user.id,
            title="System Requirement Specification (SRS)",
            description="Complete system requirement analysis, use cases, and database architecture plan.",
            file_path="/uploads/Project_SRS_Document_SIH26103.pdf",
            original_filename="Project_SRS_Document_SIH26103.pdf",
            status="approved",
            feedback="Frontend design is good. Continue backend development.",
            submission_date=datetime.utcnow() - timedelta(days=5)
        )
        db.session.add(rep1)

        rep2 = Report(
            project_id=main_project.id,
            submitted_by_id=student_user.id,
            title="Phase 2 Progress Report & Database Design",
            description="Entity relationship diagram, SQLite integration, and REST API specification.",
            file_path="/uploads/Frontend_Architecture_Phase2.pdf",
            original_filename="Frontend_Architecture_Phase2.pdf",
            status="reviewed",
            feedback="Please add database connectivity and project report.",
            submission_date=datetime.utcnow() - timedelta(days=2)
        )
        db.session.add(rep2)

        print("Seeding Documents...")
        doc1 = Document(
            project_id=main_project.id,
            uploaded_by_id=student_user.id,
            title="Project Synopsis & Proposal",
            file_path="/uploads/Project_SRS_Document_SIH26103.pdf",
            original_filename="Project_SRS_Document_SIH26103.pdf",
            file_type="PDF",
            file_size=1024 * 240,
            uploaded_at=datetime.utcnow() - timedelta(days=12)
        )
        doc2 = Document(
            project_id=main_project.id,
            uploaded_by_id=student_user.id,
            title="System Architecture Diagram",
            file_path="/uploads/Frontend_Architecture_Phase2.pdf",
            original_filename="Frontend_Architecture_Phase2.pdf",
            file_type="PDF",
            file_size=1024 * 512,
            uploaded_at=datetime.utcnow() - timedelta(days=6)
        )
        db.session.add(doc1)
        db.session.add(doc2)

        print("Seeding Notifications...")
        notif1 = Notification(
            user_id=student_user.id,
            title="Project Review",
            message="Project review meeting scheduled this week with Prof. Kadam.",
            type="alert",
            is_read=False,
            created_at=datetime.utcnow() - timedelta(hours=3)
        )
        notif2 = Notification(
            user_id=student_user.id,
            title="Report Deadline",
            message="Submit your progress report before the deadline (30 Nov 2026).",
            type="deadline",
            is_read=False,
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        notif3 = Notification(
            user_id=student_user.id,
            title="Teacher Feedback Received",
            message="Prof. Kadam reviewed your SRS Report: 'Frontend design is good. Continue backend development.'",
            type="feedback",
            is_read=True,
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.session.add_all([notif1, notif2, notif3])

        # Notifications for Teacher
        t_notif1 = Notification(
            user_id=teacher_user.id,
            title="New Report Submitted",
            message="Shivam Natkar submitted 'Phase 2 Progress Report & Database Design' for SIH26103.",
            type="info",
            is_read=False,
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        t_notif2 = Notification(
            user_id=teacher_user.id,
            title="Milestone Completed",
            message="SIH26103 team completed Frontend Development milestone.",
            type="info",
            is_read=False,
            created_at=datetime.utcnow() - timedelta(days=3)
        )
        t_notif3 = Notification(
            user_id=teacher_user.id,
            title="Upcoming Review",
            message="Department project evaluation session starts Friday.",
            type="deadline",
            is_read=False,
            created_at=datetime.utcnow() - timedelta(days=4)
        )
        db.session.add_all([t_notif1, t_notif2, t_notif3])

        print("Seeding Additional Projects for Teacher Dashboard Analytics...")
        # Project 2: IoT Monitoring System
        proj2 = Project(
            project_code='IOT2026',
            title='IoT Monitoring System',
            description='Wireless IoT sensor network for smart environmental telemetry and threshold detection.',
            department='Electronics & Communication',
            guide_id=teacher_profile.id,
            progress=45,
            status='In Progress',
            start_date='15 Sep 2026',
            expected_completion='15 Dec 2026'
        )
        db.session.add(proj2)
        db.session.flush()

        db.session.add(TeamMember(project_id=proj2.id, name='Rahul Deshmukh', roll_no='26EC01', role='Team Leader'))
        db.session.add(TeamMember(project_id=proj2.id, name='Priya Shinde', roll_no='26EC02', role='Embedded Engineer'))

        # Project 3: College Management Portal (Completed)
        proj3 = Project(
            project_code='CMP2025',
            title='College Management Portal',
            description='Centralized portal for student attendance, timetable management, and notice dissemination.',
            department='Computer Science',
            guide_id=teacher_profile.id,
            progress=100,
            status='Completed',
            start_date='01 Aug 2026',
            expected_completion='25 Oct 2026'
        )
        db.session.add(proj3)
        db.session.flush()

        db.session.add(TeamMember(project_id=proj3.id, name='Aditya Patil', roll_no='26CS01', role='Team Leader'))
        db.session.add(TeamMember(project_id=proj3.id, name='Neha Kulkarni', roll_no='26CS02', role='Full-Stack Dev'))

        # Project 4: Smart Campus System (At Risk)
        proj4 = Project(
            project_code='SCS2026',
            title='Smart Campus System',
            description='AI powered vehicle parking and energy management for college infrastructure.',
            department='E&ACT',
            guide_id=teacher_profile.id,
            progress=25,
            status='At Risk',
            start_date='01 Oct 2026',
            expected_completion='10 Nov 2026'
        )
        db.session.add(proj4)
        db.session.flush()

        db.session.add(TeamMember(project_id=proj4.id, name='Gaurav Jadhav', roll_no='26EACT11', role='Team Leader'))
        db.session.add(TeamMember(project_id=proj4.id, name='Pooja Chavan', roll_no='26EACT12', role='Hardware Dev'))

        db.session.commit()
        print("Database initialized and seeded successfully!")
        print(f"Created {User.query.count()} users, {Project.query.count()} projects, {TeamMember.query.count()} team members.")
        print("\nLogin Credentials:")
        print("  Student Login -> Email: student@csmss.edu  |  Password: password123")
        print("  Teacher Login -> Email: teacher@csmss.edu  |  Password: password123")

if __name__ == '__main__':
    seed_database()
