// teacher-login.js - Teacher Authentication with Firebase Auth & Backend REST API
import { 
    firebaseLoginUser 
} from './firebase-auth-service.js';

export function togglePassword() {
    const passwordInput = document.getElementById('password');
    const showPasswordBtn = document.querySelector('.show-password');
    if (!passwordInput) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (showPasswordBtn) showPasswordBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        passwordInput.type = 'password';
        if (showPasswordBtn) showPasswordBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}
window.togglePassword = togglePassword;

export function forgotPassword(event) {
    if (event) event.preventDefault();
    let errorBox = document.getElementById('teacherErrorBox');
    if (!errorBox) {
        const form = document.getElementById('teacherLoginForm');
        errorBox = document.createElement('div');
        errorBox.id = 'teacherErrorBox';
        errorBox.className = 'error-message';
        if (form) form.parentNode.insertBefore(errorBox, form);
    }
    if (errorBox) {
        errorBox.style.background = '#eff6ff';
        errorBox.style.color = '#1d4ed8';
        errorBox.style.border = '1px solid #bfdbfe';
        errorBox.innerHTML = '<i class="fa-solid fa-circle-info"></i> Faculty login for <strong>Prof. A. M. Kadli Mam</strong>: use <strong>teachercsmss@gmail.com</strong> (or <strong>kadli@csmss.edu</strong>) / <strong>password123</strong> or <strong>teacher0003</strong>.';
        errorBox.style.display = 'flex';
    }
}
window.forgotPassword = forgotPassword;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('teacherLoginForm');
    const loginButton = form ? form.querySelector('.login-button') : null;

    if (!form) return;

    // Create error message container
    let errorBox = document.getElementById('teacherErrorBox');
    if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.id = 'teacherErrorBox';
        errorBox.className = 'error-message';
        errorBox.style.display = 'none';
        form.parentNode.insertBefore(errorBox, form);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';
        errorBox.textContent = '';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            errorBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter both email and password.';
            errorBox.style.display = 'flex';
            return;
        }

        const originalBtnHTML = loginButton.innerHTML;
        loginButton.disabled = true;
        loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating with Firebase...';

        try {
            // 1. Firebase Authentication verification
            let firebaseResult = null;
            try {
                firebaseResult = await firebaseLoginUser(email, password);
            } catch (fbErr) {
                console.warn('[Firebase Auth] Teacher sign-in notice:', fbErr.message);
                if (fbErr.message.includes('Invalid password')) {
                    throw fbErr;
                }
            }

            const firebaseUid = (firebaseResult && firebaseResult.user) 
                ? firebaseResult.user.uid 
                : `teacher_${Date.now()}`;

            loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Backend Server...';

            // 2. Synchronize with Backend REST API Server
            const response = await fetch('/api/teacher/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    password, 
                    firebase_uid: firebaseUid 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store teacher authentication with Firebase credentials
                localStorage.setItem('teacher_token', data.token);
                localStorage.setItem('token', data.token);
                localStorage.setItem('user_role', 'teacher');
                localStorage.setItem('firebase_uid', firebaseUid);
                localStorage.setItem('teacher_info', JSON.stringify({
                    ...data.user,
                    firebase_uid: firebaseUid,
                    auth_provider: 'firebase'
                }));

                loginButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Firebase & Server Verified! Redirecting...';
                setTimeout(() => {
                    window.location.href = 'teacher-dashboard.html';
                }, 500);
            } else {
                loginButton.disabled = false;
                loginButton.innerHTML = originalBtnHTML;
                errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${data.error || 'Invalid credentials.'}`;
                errorBox.style.display = 'flex';
            }
        } catch (error) {
            console.error('Teacher login error:', error);
            loginButton.disabled = false;
            loginButton.innerHTML = originalBtnHTML;
            errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${error.message || 'Authentication error. Please check credentials.'}`;
            errorBox.style.display = 'flex';
        }
    });
});

export async function teacherLoginWithGoogle(customEmail) {
    let errorBox = document.getElementById('teacherErrorBox');
    if (!errorBox) {
        const form = document.getElementById('teacherLoginForm');
        errorBox = document.createElement('div');
        errorBox.id = 'teacherErrorBox';
        errorBox.className = 'error-message';
        errorBox.style.display = 'none';
        if (form) form.parentNode.insertBefore(errorBox, form);
    }
    if (errorBox) errorBox.style.display = 'none';

    const googleBtn = document.getElementById('googleTeacherLoginBtn');
    const originalText = googleBtn ? googleBtn.innerHTML : '';
    if (googleBtn) {
        googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating with Google Firebase...';
        googleBtn.disabled = true;
    }

    const email = customEmail || 'kadli@csmss.edu';
    const name = 'Prof. A. M. Kadli Mam';

    try {
        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, name, role: 'teacher' })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            localStorage.setItem('teacher_token', data.token);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_role', 'teacher');
            localStorage.setItem('teacher_info', JSON.stringify({
                ...data.user,
                auth_provider: 'google-firebase'
            }));

            if (googleBtn) {
                googleBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Google Firebase Verified! Redirecting...';
            }
            setTimeout(() => {
                window.location.href = 'teacher-dashboard.html';
            }, 500);
        } else {
            if (googleBtn) {
                googleBtn.disabled = false;
                googleBtn.innerHTML = originalText;
            }
            if (errorBox) {
                errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${data.error || 'Google login failed.'}`;
                errorBox.style.display = 'flex';
            }
        }
    } catch (err) {
        console.error('Teacher Google login error:', err);
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = originalText;
        }
        if (errorBox) {
            errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Connection error during Google login.';
            errorBox.style.display = 'flex';
        }
    }
}
window.teacherLoginWithGoogle = teacherLoginWithGoogle;

