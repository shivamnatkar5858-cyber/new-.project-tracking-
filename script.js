// script.js - ProjectTrack Landing Page Interactions

function openStudentLogin() {
    window.location.href = 'student-login.html';
}

function openTeacherLogin() {
    window.location.href = 'teacher-login.html';
}

function scrollToFeatures() {
    const el = document.getElementById('features');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}

// Expose globally
window.openStudentLogin = openStudentLogin;
window.openTeacherLogin = openTeacherLogin;
window.scrollToFeatures = scrollToFeatures;

// Optional: Hydrate preview stats from REST API
document.addEventListener('DOMContentLoaded', async () => {
    // Try fetching live project statistics from the Flask API
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            const data = await response.json();
            if (data.projects && data.projects.length > 0) {
                const total = data.projects.length;
                const inProg = data.projects.filter(p => p.status === 'In Progress' || p.status === 'Active').length;
                const comp = data.projects.filter(p => p.status === 'Completed').length;

                const statCards = document.querySelectorAll('.dashboard-preview .stat-card strong');
                if (statCards.length >= 3) {
                    statCards[0].textContent = total;
                    statCards[1].textContent = inProg;
                    statCards[2].textContent = comp;
                }
            }
        }
    } catch (err) {
        console.log('Project stats preview using cached seed data.');
    }
});
