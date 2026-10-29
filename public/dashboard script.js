// dashboard script.js - Student Project Dashboard with Live Backend API

let currentProjectId = null;
let currentProjectData = null;

function showToast(message, isError = false) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    if (isError) {
        toast.style.background = '#ef4444';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
    } else {
        toast.style.background = '#10b981';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function getAuthHeader() {
    const token = localStorage.getItem('student_token') || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// 1. Load Dashboard Data with Fallback & Auto-Retry
async function loadDashboard() {
    try {
        const studentInfoStr = localStorage.getItem('student_info');
        let studentEmail = '';
        if (studentInfoStr) {
            try {
                const parsed = JSON.parse(studentInfoStr);
                if (parsed.email) studentEmail = parsed.email;
            } catch (e) {}
        }

        const url = studentEmail 
            ? `/api/student/dashboard?email=${encodeURIComponent(studentEmail)}` 
            : '/api/student/dashboard';

        const response = await fetch(url, {
            headers: {
                ...getAuthHeader(),
                'Accept': 'application/json'
            }
        });

        if (!response.ok && response.status === 401) {
            console.warn('Unauthorized. Redirecting to student login.');
            window.location.href = 'student-login.html';
            return;
        }

        const data = await response.json();
        if (!data.success) {
            console.warn('Dashboard API returned error, applying cached fallback:', data.error);
            applyFallbackDashboardData();
            return;
        }

        // Student name
        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl && data.student) {
            studentNameEl.textContent = data.student.name || 'Shivam Natkar';
        }

        // Statistics
        if (data.stats) {
            const tpEl = document.getElementById('totalProjects');
            const ipEl = document.getElementById('inProgress');
            const compEl = document.getElementById('completed');
            const opEl = document.getElementById('overallProgress');

            if (tpEl) tpEl.textContent = data.stats.totalProjects ?? 1;
            if (ipEl) ipEl.textContent = data.stats.inProgress ?? 1;
            if (compEl) compEl.textContent = data.stats.completed ?? 0;
            if (opEl) opEl.textContent = data.stats.overallProgress ?? '75%';
        }

        // Project details
        if (data.project) {
            currentProjectData = data.project;
            currentProjectId = data.project.id;

            const projHeader = document.getElementById('projectTitleDisplay') || document.querySelector('.project-header h3');
            if (projHeader) projHeader.textContent = data.project.title;

            const descEl = document.getElementById('projectDescDisplay');
            if (descEl && data.project.description) descEl.textContent = data.project.description;

            const idEl = document.getElementById('projectIdDisplay');
            if (idEl) idEl.textContent = data.project.project_code || 'SIH26103';

            const deptEl = document.getElementById('projectDeptDisplay');
            if (deptEl) deptEl.textContent = data.project.department || 'E&ACT';

            const guideEl = document.getElementById('projectGuideDisplay');
            if (guideEl) guideEl.textContent = data.project.guide_name || 'Prof. Kadam';

            const startEl = document.getElementById('projectStartDateDisplay');
            if (startEl && data.project.start_date) startEl.textContent = data.project.start_date;

            const deadEl = document.getElementById('projectDeadlineDisplay');
            if (deadEl && data.project.expected_completion) deadEl.textContent = data.project.expected_completion;

            const teamEl = document.getElementById('projectTeamDisplay');
            if (teamEl && Array.isArray(data.project.team_members) && data.project.team_members.length > 0) {
                teamEl.innerHTML = data.project.team_members.map((m, idx) => `${idx + 1}. ${m.name} (${m.role || 'Member'})`).join('<br>');
            }

            const statusEl = document.getElementById('projectStatus');
            if (statusEl) {
                statusEl.textContent = data.project.status;
                if (data.project.status === 'Completed') {
                    statusEl.className = 'status completed-status';
                } else {
                    statusEl.className = 'status progress-status';
                }
            }

            // Progress bar and slider
            const progress = data.project.progress || 75;
            const progressText = document.getElementById('progressText');
            const progressFill = document.getElementById('progressFill');
            const progressRange = document.getElementById('progressRange');

            if (progressText) progressText.textContent = `${progress}%`;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressRange) progressRange.value = progress;

            // Milestones
            if (data.milestones && data.milestones.length > 0) {
                renderMilestones(data.milestones);
            }

            // Teacher Feedback
            if (data.feedbacks && data.feedbacks.length > 0) {
                renderFeedback(data.feedbacks);
            }

            // Notifications
            if (data.notifications && data.notifications.length > 0) {
                renderNotifications(data.notifications);
            }
        }
    } catch (err) {
        console.warn('Network issue fetching dashboard data, loading cached fallback:', err.message);
        applyFallbackDashboardData();
        // Automatic retry in 3 seconds if connection was temporarily interrupted
        setTimeout(loadDashboard, 3000);
    }
}

// Fallback Dashboard Data Loader
function applyFallbackDashboardData() {
    let studentName = 'Shivam Natkar';
    let project = null;

    try {
        const studentInfo = JSON.parse(localStorage.getItem('student_info') || '{}');
        if (studentInfo.name) studentName = studentInfo.name;
        project = JSON.parse(localStorage.getItem('student_project') || 'null');
    } catch (e) {}

    if (!project) {
        project = {
            id: 1,
            project_code: 'SIH26103',
            title: 'Web-Based Integrated Project Monitoring System',
            description: 'Centralized platform for tracking student final year engineering projects, milestones, documentation, and guide feedback.',
            department: 'E&ACT',
            guide_name: 'Prof. D. K. Kadam',
            progress: 75,
            status: 'In Progress',
            start_date: '10 Aug 2026',
            expected_completion: '30 Nov 2026',
            team_members: [
                { id: 1, name: 'Shivam Natkar', role: 'Team Leader / Full-Stack', roll_no: '26EACT01' },
                { id: 2, name: 'Sakshi Arbad', role: 'UI/UX Designer', roll_no: '26EACT02' },
                { id: 3, name: 'Tejal Bhanuse', role: 'Database Developer', roll_no: '26EACT03' },
                { id: 4, name: 'Karan Sangle', role: 'Testing & QA', roll_no: '26EACT04' },
                { id: 5, name: 'Abhishek Malwade', role: 'Documentation Lead', roll_no: '26EACT05' }
            ],
            milestones: [
                { id: 1, title: 'Project Topic & Synopsis Approval', is_completed: true },
                { id: 2, title: 'Database Design & SRS Submission', is_completed: true },
                { id: 3, title: 'Frontend UI & Authentication Implementation', is_completed: true },
                { id: 4, title: 'Backend REST API & File Upload Module', is_completed: true },
                { id: 5, title: 'Final Project Defense & PPT Presentation', is_completed: false }
            ]
        };
    }

    currentProjectData = project;
    currentProjectId = project.id;

    const studentNameEl = document.getElementById('studentName');
    if (studentNameEl) studentNameEl.textContent = studentName;

    const projHeader = document.getElementById('projectTitleDisplay') || document.querySelector('.project-header h3');
    if (projHeader) projHeader.textContent = project.title;

    const descEl = document.getElementById('projectDescDisplay');
    if (descEl) descEl.textContent = project.description;

    const idEl = document.getElementById('projectIdDisplay');
    if (idEl) idEl.textContent = project.project_code || 'SIH26103';

    const deptEl = document.getElementById('projectDeptDisplay');
    if (deptEl) deptEl.textContent = project.department || 'E&ACT';

    const guideEl = document.getElementById('projectGuideDisplay');
    if (guideEl) guideEl.textContent = project.guide_name || 'Prof. D. K. Kadam';

    const startEl = document.getElementById('projectStartDateDisplay');
    if (startEl) startEl.textContent = project.start_date || '10 Aug 2026';

    const deadEl = document.getElementById('projectDeadlineDisplay');
    if (deadEl) deadEl.textContent = project.expected_completion || '30 Nov 2026';

    const teamEl = document.getElementById('projectTeamDisplay');
    if (teamEl && Array.isArray(project.team_members)) {
        teamEl.innerHTML = project.team_members.map((m, idx) => `${idx + 1}. ${m.name} (${m.role || 'Member'})`).join('<br>');
    }

    const statusEl = document.getElementById('projectStatus');
    if (statusEl) {
        statusEl.textContent = project.status || 'In Progress';
        statusEl.className = project.status === 'Completed' ? 'status completed-status' : 'status progress-status';
    }

    const progress = project.progress || 75;
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const progressRange = document.getElementById('progressRange');

    if (progressText) progressText.textContent = `${progress}%`;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressRange) progressRange.value = progress;

    if (project.milestones) {
        renderMilestones(project.milestones);
    }
}

// 2. Render Milestones
function renderMilestones(milestones) {
    const box = document.querySelector('.milestone-box');
    if (!box) return;

    // Keep the box title
    const title = box.querySelector('.box-title');
    box.innerHTML = '';
    if (title) box.appendChild(title);

    milestones.forEach(m => {
        const div = document.createElement('div');
        div.className = `milestone ${m.is_completed ? '' : 'pending'}`;
        div.title = "Click to toggle milestone completion";
        div.innerHTML = `
            <i class="${m.is_completed ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'}"></i>
            <span>${m.title}</span>
            <small style="color: #94a3b8; font-size: 0.75rem; margin-left: auto;">${m.is_completed ? 'Done' : 'Pending'}</small>
        `;
        div.onclick = () => toggleMilestone(m.id, !m.is_completed);
        box.appendChild(div);
    });
}

// Toggle milestone via API
async function toggleMilestone(milestoneId, newStatus) {
    try {
        const res = await fetch(`/api/milestones/${milestoneId}`, {
            method: 'PATCH',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_completed: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Milestone updated!`);
            loadDashboard();
        }
    } catch (e) {
        console.error('Failed to toggle milestone', e);
    }
}

// 3. Render Feedback
function renderFeedback(feedbacks) {
    const feedbackBox = document.querySelectorAll('.box')[2]; // Teacher Feedback box
    if (!feedbackBox) return;

    const title = feedbackBox.querySelector('.box-title');
    feedbackBox.innerHTML = '';
    if (title) feedbackBox.appendChild(title);

    feedbacks.forEach(f => {
        const item = document.createElement('div');
        item.className = 'feedback';
        item.innerHTML = `
            <strong>${f.teacher_name || 'Prof. Kadam Sir'}</strong>
            <p>${f.message}</p>
            ${f.date ? `<small>${f.date}</small>` : ''}
        `;
        feedbackBox.appendChild(item);
    });
}

// 4. Render Notifications
function renderNotifications(notifs) {
    const box = document.querySelector('.notification-box');
    if (!box) return;

    const title = box.querySelector('.box-title');
    box.innerHTML = '';
    if (title) box.appendChild(title);

    notifs.forEach(n => {
        const item = document.createElement('div');
        item.className = 'feedback';
        item.innerHTML = `
            <strong>${n.title}</strong>
            <p>${n.message}</p>
            ${n.time ? `<small>${n.time}</small>` : ''}
        `;
        box.appendChild(item);
    });
}

// 5. Update Progress Slider
document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('progressRange');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');

    if (range) {
        range.addEventListener('input', (e) => {
            const val = e.target.value;
            if (fill) fill.style.width = `${val}%`;
            if (text) text.textContent = `${val}%`;
        });
    }

    // Initial load
    loadDashboard();
});

// 6. Save Progress to Flask Backend
async function saveProgress() {
    const range = document.getElementById('progressRange');
    if (!range) return;

    const progressVal = parseInt(range.value, 10);
    const projId = currentProjectId || 1;

    try {
        const response = await fetch(`/api/projects/${projId}/progress`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                progress: progressVal,
                status: progressVal === 100 ? 'Completed' : (progressVal > 0 ? 'In Progress' : 'Not Started')
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast(`Progress successfully saved: ${progressVal}%`);
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to save progress', true);
        }
    } catch (err) {
        console.error('Save progress error:', err);
        showToast('Connection error while saving progress', true);
    }
}

// 7. Upload Report / Document to Flask Backend
async function uploadReport() {
    const fileInput = document.getElementById('reportFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a report file to upload (.pdf, .docx, .ppt)', true);
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ""));
    formData.append('description', 'Student progress report submission');
    if (currentProjectId) {
        formData.append('project_id', currentProjectId);
    }

    showToast('Uploading report to server...');

    try {
        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: {
                ...getAuthHeader()
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Report uploaded successfully! Sent to teacher for review.');
            fileInput.value = '';
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to upload report', true);
        }
    } catch (err) {
        console.error('Upload report error:', err);
        showToast('Upload error. Please check server connection.', true);
    }
}

// 8. View Project Details Modal
function viewProject() {
    openProjectModal();
}

// 10. Edit / Add Project Details Functions
function openProjectModal() {
    const modal = document.getElementById('editProjectModal');
    if (!modal) return;

    if (currentProjectData) {
        const p = currentProjectData;
        const codeInput = document.getElementById('editProjectCode');
        const deptInput = document.getElementById('editProjectDept');
        const titleInput = document.getElementById('editProjectTitle');
        const guideInput = document.getElementById('editProjectGuide');
        const deadlineInput = document.getElementById('editProjectDeadline');
        const statusInput = document.getElementById('editProjectStatus');
        const descInput = document.getElementById('editProjectDesc');
        const teamInput = document.getElementById('editProjectTeam');

        if (codeInput) codeInput.value = p.project_code || 'SIH26103';
        if (deptInput) deptInput.value = p.department || 'E&ACT';
        if (titleInput) titleInput.value = p.title || '';
        if (guideInput) guideInput.value = p.guide_name || 'Prof. Kadam';
        if (deadlineInput) deadlineInput.value = p.expected_completion || '30 Nov 2026';
        if (statusInput) statusInput.value = p.status || 'In Progress';
        if (descInput) descInput.value = p.description || '';

        if (teamInput && Array.isArray(p.team_members) && p.team_members.length > 0) {
            teamInput.value = p.team_members.map(m => `${m.name} - ${m.role || 'Team Member'}`).join('\n');
        }
    }

    modal.style.display = 'flex';
}

function closeProjectModal() {
    const modal = document.getElementById('editProjectModal');
    if (modal) modal.style.display = 'none';
    const err = document.getElementById('projectModalError');
    if (err) err.style.display = 'none';
}

async function saveProjectModalDetails() {
    const code = document.getElementById('editProjectCode')?.value.trim();
    const dept = document.getElementById('editProjectDept')?.value.trim();
    const title = document.getElementById('editProjectTitle')?.value.trim();
    const guide = document.getElementById('editProjectGuide')?.value.trim();
    const deadline = document.getElementById('editProjectDeadline')?.value.trim();
    const status = document.getElementById('editProjectStatus')?.value;
    const desc = document.getElementById('editProjectDesc')?.value.trim();
    const teamText = document.getElementById('editProjectTeam')?.value.trim() || '';

    const errBox = document.getElementById('projectModalError');
    if (!title) {
        if (errBox) {
            errBox.textContent = 'Project title is required.';
            errBox.style.display = 'block';
        }
        return;
    }

    // Parse team members
    const team_members = teamText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((line, idx) => {
            const clean = line.replace(/^\d+[\.\)]\s*/, '');
            const parts = clean.split('-');
            const name = parts[0]?.trim() || `Student ${idx + 1}`;
            const role = parts[1]?.trim() || (idx === 0 ? 'Team Leader' : 'Team Member');
            return {
                id: idx + 1,
                name,
                roll_no: `26EACT0${idx + 1}`,
                role
            };
        });

    const payload = {
        project_code: code || 'SIH26103',
        department: dept || 'E&ACT',
        title,
        guide_name: guide || 'Prof. Kadam',
        expected_completion: deadline || '30 Nov 2026',
        status: status || 'In Progress',
        description: desc,
        team_members
    };

    const saveBtn = document.getElementById('saveProjectBtn');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Database...';
    }

    try {
        const projId = currentProjectId || 1;
        const res = await fetch(`/api/projects/${projId}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Project details updated and saved successfully!');
            closeProjectModal();
            loadDashboard();
        } else {
            if (errBox) {
                errBox.textContent = data.error || 'Failed to save project details.';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Error saving project:', err);
        if (errBox) {
            errBox.textContent = 'Connection error while saving project.';
            errBox.style.display = 'block';
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}

// 11. Send PPT / Presentation Functions
function openSendPptModal() {
    const modal = document.getElementById('sendPptModal');
    if (!modal) return;

    if (currentProjectData) {
        const titleInput = document.getElementById('pptTitleInput');
        if (titleInput) {
            titleInput.value = `${currentProjectData.project_code || 'SIH26103'} - Progress Review Presentation`;
        }
    }

    modal.style.display = 'flex';
}

function closeSendPptModal() {
    const modal = document.getElementById('sendPptModal');
    if (modal) modal.style.display = 'none';
    const err = document.getElementById('pptModalError');
    if (err) err.style.display = 'none';
    const prog = document.getElementById('pptUploadProgress');
    if (prog) prog.style.display = 'none';
}

let selectedPptFile = null;

function handlePptFileSelected(event) {
    const file = event.target.files?.[0];
    const infoSpan = document.getElementById('selectedPptInfo');
    if (file) {
        selectedPptFile = file;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        if (infoSpan) {
            infoSpan.innerHTML = `<strong>${file.name}</strong> (${sizeMb} MB) selected`;
            infoSpan.style.color = '#15803d';
        }
    }
}

async function submitPptPresentation() {
    const fileInput = document.getElementById('pptFileInput');
    const file = selectedPptFile || fileInput?.files?.[0];
    const title = document.getElementById('pptTitleInput')?.value.trim();
    const stage = document.getElementById('pptStageSelect')?.value;
    const notes = document.getElementById('pptNotesInput')?.value.trim();
    const errBox = document.getElementById('pptModalError');

    if (!file) {
        if (errBox) {
            errBox.textContent = 'Please choose a PowerPoint (.ppt, .pptx) or PDF slide file.';
            errBox.style.display = 'block';
        }
        return;
    }

    if (errBox) errBox.style.display = 'none';

    const progWrap = document.getElementById('pptUploadProgress');
    const progBar = document.getElementById('pptProgressBar');
    const progText = document.getElementById('pptUploadText');
    const submitBtn = document.getElementById('submitPptBtn');

    if (progWrap) progWrap.style.display = 'block';
    if (progBar) progBar.style.width = '45%';
    if (submitBtn) submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('pptFile', file);
    formData.append('title', title || file.name);
    formData.append('stage', stage || 'Review Presentation');
    formData.append('description', notes || `PowerPoint Presentation submitted for ${stage}`);
    formData.append('project_id', currentProjectId || 1);

    try {
        const res = await fetch('/api/student/submit-ppt', {
            method: 'POST',
            headers: {
                ...getAuthHeader()
            },
            body: formData
        });

        if (progBar) progBar.style.width = '100%';

        const data = await res.json();
        if (res.ok && data.success) {
            showToast('PPT Presentation sent to Guide successfully!');
            closeSendPptModal();
            loadDashboard();
            // Also notify file refresh if on my-files
            if (typeof window.refreshFilesList === 'function') {
                window.refreshFilesList();
            }
        } else {
            if (errBox) {
                errBox.textContent = data.error || 'Failed to submit presentation.';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('PPT submission error:', err);
        if (errBox) {
            errBox.textContent = 'Connection error while uploading presentation.';
            errBox.style.display = 'block';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (progWrap) progWrap.style.display = 'none';
    }
}

// 8. Add Group Member Real-Time Handler
function openAddMemberModal() {
    const modal = document.getElementById('addMemberModal');
    if (modal) {
        modal.style.display = 'flex';
        const nameInput = document.getElementById('newMemberName');
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
    }
}

function closeAddMemberModal() {
    const modal = document.getElementById('addMemberModal');
    if (modal) modal.style.display = 'none';
}

async function submitNewGroupMember() {
    const nameInput = document.getElementById('newMemberName');
    const rollInput = document.getElementById('newMemberRoll');
    const roleInput = document.getElementById('newMemberRole');
    const btn = document.getElementById('submitAddMemberBtn');

    const name = nameInput ? nameInput.value.trim() : '';
    const roll_no = rollInput ? rollInput.value.trim() : '';
    const role = roleInput ? roleInput.value.trim() : 'Team Member';

    if (!name) {
        alert('Please enter the group member full name.');
        return;
    }

    const projectId = currentProjectId || 1;
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const response = await fetch(`/api/projects/${projectId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ name, roll_no, role })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast(`Member "${name}" added to group!`);
            closeAddMemberModal();
            loadDashboard();
        } else {
            alert(data.error || 'Failed to add member.');
        }
    } catch (err) {
        console.error('Add member error:', err);
        alert('Connection error while adding group member.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHTML;
        }
    }
}

// Expose functions globally for onclick attributes
window.openAddMemberModal = openAddMemberModal;
window.closeAddMemberModal = closeAddMemberModal;
window.submitNewGroupMember = submitNewGroupMember;
window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;
window.saveProjectModalDetails = saveProjectModalDetails;
window.openSendPptModal = openSendPptModal;
window.closeSendPptModal = closeSendPptModal;
window.handlePptFileSelected = handlePptFileSelected;
window.submitPptPresentation = submitPptPresentation;

// 9. Logout
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
        console.log(e);
    }
    localStorage.removeItem('student_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('student_info');
    window.location.href = 'student-login.html';
}
