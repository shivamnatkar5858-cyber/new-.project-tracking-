# ProjectTrack – Web-Based Integrated Project Monitoring System

A complete full-stack web application designed for engineering colleges to manage student projects, monitor progress, submit milestone reports, coordinate guides, and track project completion lifecycles.

---

## 🚀 Tech Stack

* **Backend:** Python Flask 3.x
* **Database & ORM:** SQLite 3 + Flask-SQLAlchemy 3.x
* **Security & Auth:** Werkzeug secure password hashing (`generate_password_hash`, `check_password_hash`) + PyJWT Bearer token & session authentication
* **API Architecture:** RESTful JSON API
* **Cross-Origin:** Flask-CORS
* **File Management:** Multipart document & progress report upload with server-side validation (`/uploads`)
* **Frontend:** Modern responsive HTML5, CSS3, JavaScript `fetch()` API, Font Awesome 6.5, Chart.js

---

## 🗄️ Database Tables (`models.py`)

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| `users` | User accounts & credentials | `id`, `email`, `password_hash`, `role` ('student', 'teacher', 'admin'), `created_at` |
| `students` | Student academic profiles | `id`, `user_id`, `name`, `roll_no`, `department`, `year`, `phone`, `project_id` |
| `teachers` | Faculty & project guides | `id`, `user_id`, `name`, `department`, `designation`, `phone` |
| `projects` | Capstone projects | `id`, `project_code` ('SIH26103'), `title`, `description`, `department`, `guide_id`, `progress` (0-100), `status`, `start_date`, `expected_completion` |
| `team_members`| Students in project groups | `id`, `project_id`, `student_id`, `name`, `roll_no`, `role` |
| `milestones` | Project milestone tasks | `id`, `project_id`, `title`, `description`, `due_date`, `is_completed`, `completed_at`, `order_index` |
| `reports` | Progress submissions | `id`, `project_id`, `submitted_by_id`, `title`, `file_path`, `original_filename`, `status`, `feedback`, `submission_date` |
| `documents` | Attached project files | `id`, `project_id`, `uploaded_by_id`, `title`, `file_path`, `file_type`, `file_size`, `uploaded_at` |
| `notifications`| System alerts & reviews | `id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at` |

---

## 💻 Exact VS Code Windows Commands (Setup & Run)

Open your project folder in **Visual Studio Code** on Windows, press `Ctrl + \`` to open the integrated terminal, and run:

### Option A: Using PowerShell (Default in VS Code Windows)

```powershell
# 1. Create a Python virtual environment
python -m venv venv

# 2. Activate the virtual environment
.\venv\Scripts\Activate.ps1

# (If PowerShell blocks script execution, run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)

# 3. Upgrade pip and install all dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. Initialize and seed the SQLite database with SIH26103 project data
python seed.py

# 5. Run the Flask backend server
python app.py
```

### Option B: Using Windows Command Prompt (`cmd.exe`)

```cmd
:: 1. Create Python virtual environment
python -m venv venv

:: 2. Activate virtual environment
venv\Scripts\activate.bat

:: 3. Install requirements
pip install -r requirements.txt

:: 4. Initialize database
python seed.py

:: 5. Run Flask server
python app.py
```

Your Flask backend will start on **`http://127.0.0.1:5000`**.
You can open **`http://127.0.0.1:5000`** directly in any web browser to access the website!

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Student** | `student@csmss.edu` | `password123` | Shivam Natkar (E&ACT, SIH26103 Team Lead) |
| **Teacher** | `teacher@csmss.edu` | `password123` | Prof. Kadam (Faculty Guide & Project Coordinator) |

### Seeded Project Data:
* **Project ID:** `SIH26103`
* **Project Title:** `Web-Based Project Monitoring System`
* **Department:** `E&ACT`
* **Guide:** `Prof. Kadam`
* **Progress:** `75%`
* **Status:** `In Progress`
* **Team Members:**
  1. Shivam Natkar (Team Leader / Full-Stack Developer)
  2. Sakshi Arbad (UI/UX & Frontend Designer)
  3. Tejal Bhanuse (Backend & Database Developer)
  4. Karan Sangle (Testing & Quality Assurance)
  5. Abhishek Malwade (Documentation & Presentation)
* **Milestones:**
  * ✅ Project Topic Selection
  * ✅ Requirement Analysis
  * ✅ System Design
  * ✅ Frontend Development
  * ⏳ Backend Development (Pending)
  * ⏳ Testing & Final Report (Pending)

---

## 📡 REST API Reference

### 1. Authentication
* `POST /api/student/login`
  * Body: `{ "email": "student@csmss.edu", "password": "password123" }`
  * Response: Returns JWT bearer token, user profile, and active project data.
* `POST /api/teacher/login`
  * Body: `{ "email": "teacher@csmss.edu", "password": "password123" }`
  * Response: Returns JWT bearer token and teacher profile.
* `POST /api/student/register`
  * Body: `{ "name": "...", "email": "...", "password": "...", "roll_no": "...", "department": "E&ACT", "year": "Final Year" }`
* `POST /api/teacher/register`
  * Body: `{ "name": "...", "email": "...", "password": "...", "department": "E&ACT", "designation": "Assistant Professor" }`
* `POST /api/logout`
  * Clears session and revokes client credentials.
* `GET /api/me`
  * Validates Bearer token and returns current user details.

### 2. Student Dashboard
* `GET /api/student/dashboard`
  * Returns student profile, stats (total projects, in progress, completed, overall progress %), current project details, team members, milestones, guide feedback, submitted reports, and notifications.

### 3. Teacher Dashboard
* `GET /api/teacher/dashboard`
  * Returns teacher overview, analytics metrics (total, active, completed, at-risk projects), Chart.js data series, upcoming deadlines, project table, recent reports, and recent activity logs.
* `GET /api/teacher/students`
  * Lists all registered students, roll numbers, and allocated projects.
* `POST /api/teacher/assign`
  * Body: `{ "student_id": 1, "project_id": 1 }`

### 4. Projects & Progress
* `GET /api/projects`
  * Query parameters: `?status=all|active|completed|risk&search=SIH`
* `POST /api/projects`
  * Body: `{ "project_code": "...", "title": "...", "department": "...", "guide_id": 1 }`
* `GET /api/projects/<id>`
  * Returns complete project with team members, milestones, and documents.
* `POST /api/projects/<id>/progress`
  * Body: `{ "progress": 85, "status": "In Progress" }`
  * Saves real-time progress update and notifies guide.
* `GET /api/projects/<id>/team`
* `POST /api/projects/<id>/team`
  * Body: `{ "name": "...", "roll_no": "...", "role": "..." }`
* `DELETE /api/projects/<id>/team/<member_id>`

### 5. Milestones
* `GET /api/milestones?project_id=<id>`
* `POST /api/milestones`
* `PATCH /api/milestones/<id>`
  * Body: `{ "is_completed": true }`
* `DELETE /api/milestones/<id>`

### 6. Reports & Reviews
* `GET /api/reports?project_id=<id>`
* `POST /api/reports` (Multipart form-data)
  * Fields: `title`, `description`, `project_id`, `file`
  * Stores file under `/uploads` and notifies teacher.
* `POST /api/reports/<id>/review`
  * Body: `{ "status": "approved", "feedback": "Excellent progress on database schema." }`
  * Notifies the student with feedback.

### 7. Documents & File Storage
* `GET /api/documents?project_id=<id>`
* `POST /api/documents` (Multipart form-data)
  * Supports `.pdf`, `.docx`, `.doc`, `.ppt`, `.pptx`, `.zip`.
* `GET /api/documents/download/<id>`
  * Downloads document attachment with original file name.

### 8. Notifications
* `GET /api/notifications`
* `POST /api/notifications`
  * Body: `{ "title": "...", "message": "...", "type": "alert|deadline|info" }`
* `POST /api/notifications/<id>/read`

---

## 📂 Project Directory Structure

```
projecttrack/
├── app.py                      # Flask Application entry point & configuration
├── models.py                   # SQLAlchemy Models (9 Database Tables)
├── auth_middleware.py          # JWT authentication & decorators
├── seed.py                     # Initial database seeding script (SIH26103)
├── requirements.txt            # Python package dependencies
├── .env.example                # Sample environment variables
├── README.md                   # Complete documentation & Windows commands
├── server.ts                   # Node/Express runner (bridges port 3000 to Flask)
│
├── routes/                     # Modular REST API Blueprints
│   ├── __init__.py
│   ├── auth.py                 # Login, register, logout, me
│   ├── student.py              # Student dashboard & progress
│   ├── teacher.py              # Teacher dashboard, students, assignments
│   ├── projects.py             # Projects CRUD, progress, team
│   ├── milestones.py           # Milestone management
│   ├── reports.py              # Report submissions & reviews
│   ├── documents.py            # Document upload & downloads
│   └── notifications.py        # System alerts & broadcasting
│
├── uploads/                    # Secure storage for uploaded documents/reports
├── instance/
│   └── projecttrack.db         # SQLite relational database
│
├── index.html                  # Landing page (root)
├── project monitoring sysytem.html # Original landing page file
├── style.css                   # Landing page styling
├── script.js                   # Landing page fetch & navigation
│
├── student-login.html          # Student authentication page
├── student-login.css           # Student login styling
├── student-login.js            # Student login fetch & token storage
│
├── student-dashboard.html      # Student project dashboard
├── student-dashboard.css       # Student dashboard card styling
├── dashboard script.js         # Student dashboard fetch, progress slider & upload
├── student-dashboard.js        # Alias for dashboard script
│
├── teacher-login.html          # Teacher authentication page
├── teacher-login.css           # Teacher login styling
├── teacher-login.js            # Teacher login fetch & token storage
│
├── teacher-dashboard.html      # Teacher portal with Chart.js
├── teacher-dashboard.css       # Teacher portal styling & animations
└── teacher-dashboard.js        # Teacher dashboard fetch, Chart.js, tables, reviews
```

---

## 🧪 Verification & Testing Checklist

1. **Student Login Flow:**
   * Open `student-login.html`
   * Click "Use Demo" or enter `student@csmss.edu` / `password123`
   * Click "Login as Student"
   * Redirects to `student-dashboard.html` with project SIH26103, 75% progress, milestones, team members, and feedback.
   * Drag progress slider and click "Save Progress" → Updates database via `/api/projects/1/progress`.
   * Click on any pending milestone → Toggles to completed via `/api/milestones/<id>`.
   * Select a file and click "Upload" → Uploads file via `/api/reports`.

2. **Teacher Portal Flow:**
   * Open `teacher-login.html`
   * Click "Use Demo" or enter `teacher@csmss.edu` / `password123`
   * Click "Login as Teacher"
   * Redirects to `teacher-dashboard.html` with real-time stats (4 Total, 2 Active, 1 Completed, 1 At Risk).
   * Chart.js renders the project progress bars.
   * Click "View" on SIH26103 → Opens interactive project modal.
   * Click "Students / Teams" in sidebar → Views all allocated student teams.
   * Click "Reports" in sidebar → Downloads submitted PDF and submits review feedback.
   * Click "Notifications" in sidebar → Broadcasts notification to all students.
