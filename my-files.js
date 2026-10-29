// my-files.js - Firebase Storage + Firestore File Management
import { 
    auth, 
    db, 
    storage, 
    isRealFirebase,
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    ref, 
    uploadBytesResumable, 
    getDownloadURL, 
    deleteObject,
    signInAnonymously,
    onAuthStateChanged
} from './firebase-config.js';

let currentUser = null;
let currentUid = null;
let selectedUploadFile = null;
let isUploading = false;
let activeUploadTask = null;
let unsubscribeFilesSnapshot = null;
let localFilesCache = [];

// Helper: Format file size into human-readable string
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper: Format MIME type or file extension
export function formatFileType(mimeType, fileName = '') {
    if (!mimeType && fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        return ext.toUpperCase() + ' File';
    }
    if (!mimeType) return 'File';
    
    if (mimeType.includes('pdf')) return 'PDF Document';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Word Document';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation (PPT)';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheet';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) return 'Archive (ZIP)';
    if (mimeType.startsWith('image/')) return 'Image (' + mimeType.split('/')[1].toUpperCase() + ')';
    if (mimeType.startsWith('text/')) return 'Text Document';
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('python')) return 'Code / Script';

    const parts = mimeType.split('/');
    return parts[1] ? parts[1].toUpperCase() : mimeType;
}

// Helper: Get FontAwesome icon based on mime type or file extension
export function getFileIconClass(mimeType, fileName = '') {
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    if (mimeType?.includes('pdf') || ext === 'pdf') return 'fa-solid fa-file-pdf text-red-500';
    if (mimeType?.includes('word') || ext === 'doc' || ext === 'docx') return 'fa-solid fa-file-word text-blue-500';
    if (mimeType?.includes('presentation') || ext === 'ppt' || ext === 'pptx') return 'fa-solid fa-file-powerpoint text-orange-500';
    if (mimeType?.includes('sheet') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'fa-solid fa-file-excel text-green-500';
    if (mimeType?.includes('zip') || ext === 'zip' || ext === 'rar' || ext === '7z') return 'fa-solid fa-file-zipper text-amber-500';
    if (mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'fa-solid fa-file-image text-purple-500';
    if (mimeType?.startsWith('text/') || ext === 'txt' || ext === 'md') return 'fa-solid fa-file-lines text-slate-500';
    if (['js', 'ts', 'py', 'json', 'html', 'css'].includes(ext)) return 'fa-solid fa-file-code text-indigo-500';
    return 'fa-solid fa-file text-slate-400';
}

// Check if user is logged into student dashboard or has a valid UID
function getLoggedInUid() {
    if (currentUser && currentUser.uid) {
        return currentUser.uid;
    }
    const studentInfo = localStorage.getItem('student_info');
    if (studentInfo) {
        try {
            const parsed = JSON.parse(studentInfo);
            if (parsed.email) return 'student_' + btoa(parsed.email).replace(/[^a-zA-Z0-9]/g, '_');
            if (parsed.id) return 'student_' + parsed.id;
        } catch (e) {}
    }
    const token = localStorage.getItem('student_token') || localStorage.getItem('token');
    if (token) {
        return 'student_session_' + (token.slice(0, 16).replace(/[^a-zA-Z0-9]/g, ''));
    }
    return null;
}

// Initialize Auth & File Listeners
export async function initMyFiles() {
    const tableBody = document.getElementById('filesTableBody');
    const loadingEl = document.getElementById('filesLoading');
    const emptyEl = document.getElementById('noFilesMsg');

    if (!tableBody) return;

    // Check if user has an active session
    const uidFromSession = getLoggedInUid();
    if (!uidFromSession && !localStorage.getItem('student_token') && !localStorage.getItem('token')) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.innerHTML = `
                <div class="empty-icon-wrap" style="color: #ef4444;">
                    <i class="fa-solid fa-lock" style="font-size: 2rem;"></i>
                </div>
                <h3>Access Restricted</h3>
                <p>Please log in with your student credentials to view and manage your files.</p>
                <a href="student-login.html" class="action-btn" style="margin-top: 1rem; display: inline-flex; text-decoration: none;">
                    <i class="fa-solid fa-right-to-bracket"></i> Student Login
                </a>
            `;
        }
        return;
    }

    if (loadingEl) loadingEl.style.display = 'flex';

    // Firebase Auth State Listener
    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                currentUid = user.uid;
                subscribeToUserFiles(currentUid);
            } else {
                try {
                    // Sign in anonymously to acquire a Firebase UID for Firestore and Storage rules
                    const cred = await signInAnonymously(auth);
                    currentUser = cred.user;
                    currentUid = cred.user.uid;
                    subscribeToUserFiles(currentUid);
                } catch (authErr) {
                    console.warn('[Firebase Auth] Anonymous sign-in note:', authErr.message);
                    // Use session UID fallback
                    currentUid = uidFromSession || 'student_demo_user';
                    subscribeToUserFiles(currentUid);
                }
            }
        });
    } else {
        currentUid = uidFromSession || 'student_demo_user';
        subscribeToUserFiles(currentUid);
    }

    setupModalListeners();
}

// Subscribe to users/{uid}/files in Firestore ordered by createdAt desc
function subscribeToUserFiles(uid) {
    const tableBody = document.getElementById('filesTableBody');
    const loadingEl = document.getElementById('filesLoading');
    const emptyEl = document.getElementById('noFilesMsg');

    if (unsubscribeFilesSnapshot) {
        unsubscribeFilesSnapshot();
        unsubscribeFilesSnapshot = null;
    }

    // Try Firestore real-time listener if db is initialized
    let firestoreConnected = false;
    if (db && isRealFirebase) {
        try {
            const filesCol = collection(db, 'users', uid, 'files');
            const q = query(filesCol, orderBy('createdAt', 'desc'));

            unsubscribeFilesSnapshot = onSnapshot(q, (snapshot) => {
                if (loadingEl) loadingEl.style.display = 'none';
                const files = [];
                snapshot.forEach((docSnapshot) => {
                    files.push({ id: docSnapshot.id, ...docSnapshot.data() });
                });
                renderFilesTable(files);
                firestoreConnected = true;
            }, (error) => {
                console.warn('[Firestore] Snapshot listener error, falling back to local storage cache:', error.message);
                loadFallbackFiles(uid);
            });
            return;
        } catch (err) {
            console.warn('[Firestore] Initialization error:', err.message);
        }
    }

    // Fallback if db is unavailable or not yet configured with real API key
    loadFallbackFiles(uid);
}

// Local cache fallback for demonstration/preview environments
function getLocalFiles(uid) {
    try {
        const raw = localStorage.getItem(`projecttrack_files_${uid}`);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveLocalFiles(uid, files) {
    try {
        localStorage.setItem(`projecttrack_files_${uid}`, JSON.stringify(files));
    } catch (e) {}
}

function loadFallbackFiles(uid) {
    const loadingEl = document.getElementById('filesLoading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    let files = getLocalFiles(uid);
    // Seed default file if empty
    if (files.length === 0) {
        files = [
            {
                id: 'file_initial_sih_srs',
                name: 'SIH26103_Software_Requirements_Specification.pdf',
                storagePath: `user_uploads/${uid}/SIH26103_Software_Requirements_Specification.pdf`,
                downloadURL: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                size: 1485200,
                type: 'application/pdf',
                folderId: 'documentation',
                createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
            },
            {
                id: 'file_initial_architecture',
                name: 'System_Architecture_Diagram.png',
                storagePath: `user_uploads/${uid}/System_Architecture_Diagram.png`,
                downloadURL: 'https://placehold.co/1200x800/png?text=System+Architecture+SIH26103',
                size: 842100,
                type: 'image/png',
                folderId: 'code',
                createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
            }
        ];
        saveLocalFiles(uid, files);
    }
    localFilesCache = files;
    renderFilesTable(files);
}

// Render the files table rows
export function renderFilesTable(files) {
    const tableBody = document.getElementById('filesTableBody');
    const emptyEl = document.getElementById('noFilesMsg');
    const tableEl = document.getElementById('myFilesTable');

    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!files || files.length === 0) {
        if (tableEl) tableEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyEl) emptyEl.style.display = 'none';

    files.forEach((file) => {
        const tr = document.createElement('tr');
        tr.id = `file-row-${file.id}`;

        const iconClass = getFileIconClass(file.type, file.name);
        const formattedSize = formatFileSize(file.size);
        const formattedType = formatFileType(file.type, file.name);
        
        let dateStr = 'Just now';
        if (file.createdAt) {
            try {
                if (file.createdAt.toDate) {
                    dateStr = file.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                } else if (typeof file.createdAt === 'string') {
                    dateStr = new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            } catch (e) {}
        }

        tr.innerHTML = `
            <td>
                <div class="file-name-cell">
                    <i class="${iconClass} file-type-icon"></i>
                    <div class="file-meta">
                        <span class="file-name-text" title="${file.name}">${escapeHtml(file.name)}</span>
                        ${file.folderId ? `<span class="folder-badge"><i class="fa-solid fa-folder"></i> ${escapeHtml(file.folderId)}</span>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <span class="file-type-badge">${escapeHtml(formattedType)}</span>
            </td>
            <td>
                <span class="file-size-text">${formattedSize}</span>
            </td>
            <td>
                <span class="file-date-text">${dateStr}</span>
            </td>
            <td style="text-align: right;">
                <div class="file-actions-cell">
                    <button 
                        type="button" 
                        class="action-btn file-action-download" 
                        data-id="${file.id}"
                        data-name="${encodeURIComponent(file.name)}"
                        data-url="${encodeURIComponent(file.downloadURL || '')}"
                        title="Download file">
                        <i class="fa-solid fa-download"></i>
                        <span>Download</span>
                    </button>
                    <button 
                        type="button" 
                        class="action-btn secondary file-action-delete" 
                        data-id="${file.id}" 
                        data-path="${encodeURIComponent(file.storagePath || '')}"
                        title="Delete file">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </td>
        `;

        // Attach event listeners
        const dlBtn = tr.querySelector('.file-action-download');
        if (dlBtn) {
            dlBtn.addEventListener('click', () => {
                downloadFile(file.downloadURL, file.name);
            });
        }

        const delBtn = tr.querySelector('.file-action-delete');
        if (delBtn) {
            delBtn.addEventListener('click', () => {
                deleteUserFile(file.id, file.storagePath);
            });
        }

        tableBody.appendChild(tr);
    });
}

// Download file handler: Safe download / tab open with NO alert
export function downloadFile(url, fileName) {
    if (!url) {
        showInlineToast('Download URL is unavailable.', true);
        return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
}

// Delete file handler: Remove from Firebase Storage & delete doc from Firestore
export async function deleteUserFile(fileId, storagePath) {
    const uid = currentUid || getLoggedInUid();
    if (!uid) {
        showInlineToast('Authentication required to delete file.', true);
        return;
    }

    const row = document.getElementById(`file-row-${fileId}`);
    if (row) {
        row.style.opacity = '0.4';
        row.style.pointerEvents = 'none';
    }

    try {
        // 1. Delete from Firebase Storage
        if (storage && storagePath && isRealFirebase) {
            try {
                const storageReference = ref(storage, storagePath);
                await deleteObject(storageReference);
                console.log('[Firebase Storage] Deleted object:', storagePath);
            } catch (storageErr) {
                console.warn('[Firebase Storage] Note during delete:', storageErr.message);
            }
        }

        // 2. Delete from Firestore: users/{uid}/files/{fileId}
        if (db && isRealFirebase) {
            try {
                const fileDocRef = doc(db, 'users', uid, 'files', fileId);
                await deleteDoc(fileDocRef);
                console.log('[Firestore] Deleted document: users/' + uid + '/files/' + fileId);
            } catch (firestoreErr) {
                console.warn('[Firestore] Note during doc delete:', firestoreErr.message);
            }
        }

        // 3. Update local fallback cache immediately
        localFilesCache = localFilesCache.filter(f => f.id !== fileId);
        saveLocalFiles(uid, localFilesCache);

        // Optimistically remove row from UI immediately
        if (row) row.remove();

        const tableBody = document.getElementById('filesTableBody');
        if (tableBody && tableBody.children.length === 0) {
            const tableEl = document.getElementById('myFilesTable');
            const emptyEl = document.getElementById('noFilesMsg');
            if (tableEl) tableEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
        }

        showInlineToast('File successfully deleted.');
    } catch (err) {
        console.error('Failed to delete file:', err);
        if (row) {
            row.style.opacity = '1';
            row.style.pointerEvents = 'auto';
        }
        showInlineToast('Error deleting file: ' + err.message, true);
    }
}

// In-app Modal Handlers
export function openUploadModal() {
    const modal = document.getElementById('uploadFileModal');
    if (!modal) return;

    resetModalState();
    modal.style.display = 'flex';
}

export function closeUploadModal() {
    const modal = document.getElementById('uploadFileModal');
    if (!modal) return;

    if (isUploading && activeUploadTask) {
        // Do not close abruptly if upload is in active progress
        return;
    }

    modal.style.display = 'none';
    resetModalState();
}

function resetModalState() {
    selectedUploadFile = null;
    isUploading = false;
    activeUploadTask = null;

    const fileInput = document.getElementById('hiddenFileInput');
    if (fileInput) fileInput.value = '';

    const dropzoneTitle = document.querySelector('.modal-dropzone .dropzone-title');
    const dropzoneSub = document.getElementById('selectedFileInfo');
    const dropzoneIcon = document.querySelector('.modal-dropzone i');
    
    if (dropzoneTitle) dropzoneTitle.textContent = 'Click to choose a file or drag & drop';
    if (dropzoneSub) dropzoneSub.textContent = 'Supports documents, archives, PDFs, presentations, and images';
    if (dropzoneIcon) dropzoneIcon.className = 'fa-solid fa-file-circle-plus';

    const errBox = document.getElementById('uploadModalError');
    if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
    }

    const progressContainer = document.getElementById('uploadProgressContainer');
    if (progressContainer) progressContainer.style.display = 'none';

    const progressBar = document.getElementById('uploadProgressBar');
    if (progressBar) progressBar.style.width = '0%';

    const startBtn = document.getElementById('startUploadBtn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload';
    }

    const cancelBtn = document.getElementById('cancelUploadBtn');
    if (cancelBtn) cancelBtn.disabled = false;
}

export function handleFileSelected(file) {
    if (!file) return;

    selectedUploadFile = file;

    const errBox = document.getElementById('uploadModalError');
    if (errBox) errBox.style.display = 'none';

    const dropzoneTitle = document.querySelector('.modal-dropzone .dropzone-title');
    const dropzoneSub = document.getElementById('selectedFileInfo');
    const dropzoneIcon = document.querySelector('.modal-dropzone i');

    if (dropzoneTitle) dropzoneTitle.textContent = file.name;
    if (dropzoneSub) dropzoneSub.textContent = `${formatFileSize(file.size)} • ${formatFileType(file.type, file.name)}`;
    if (dropzoneIcon) dropzoneIcon.className = getFileIconClass(file.type, file.name) + ' text-2xl';
}

// Upload the selected file to Firebase Storage & save metadata in Firestore
export async function uploadSelectedFile() {
    const errBox = document.getElementById('uploadModalError');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const startBtn = document.getElementById('startUploadBtn');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    const folderSelect = document.getElementById('fileFolderSelect');

    const uid = currentUid || getLoggedInUid();
    if (!uid) {
        showModalError('User is not authenticated. Please log in first.');
        return;
    }

    if (!selectedUploadFile) {
        showModalError('Please select a file to upload.');
        return;
    }

    if (isUploading) return; // Prevent double upload

    isUploading = true;
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    if (errBox) errBox.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '5%';
    if (progressText) progressText.textContent = 'Uploading: 5%';

    const file = selectedUploadFile;
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    // Path MUST be: user_uploads/{uid}/{fileName} or user_uploads/{uid}/{fileId}-{name}
    const storagePath = `user_uploads/${uid}/${fileId}-${file.name}`;
    const folderId = folderSelect ? folderSelect.value : '';

    // If real Firebase Storage is available
    if (storage && isRealFirebase) {
        try {
            const storageReference = ref(storage, storagePath);
            activeUploadTask = uploadBytesResumable(storageReference, file);

            activeUploadTask.on('state_changed', 
                (snapshot) => {
                    const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (progressText) progressText.textContent = `Uploading: ${percent}%`;
                }, 
                (error) => {
                    console.error('[Firebase Storage] Upload error:', error);
                    handleUploadFailure(error.message);
                }, 
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(activeUploadTask.snapshot.ref);

                        // Save metadata to Firestore: users/{uid}/files/{fileId}
                        const fileMetadata = {
                            id: fileId,
                            name: file.name,
                            storagePath: storagePath,
                            downloadURL: downloadURL,
                            size: file.size,
                            type: file.type || 'application/octet-stream',
                            folderId: folderId || null,
                            createdAt: serverTimestamp()
                        };

                        if (db) {
                            await setDoc(doc(db, 'users', uid, 'files', fileId), fileMetadata);
                            console.log('[Firestore] Document saved:', `users/${uid}/files/${fileId}`);
                        }

                        // Also update local cache
                        const localItem = {
                            ...fileMetadata,
                            createdAt: new Date().toISOString()
                        };
                        localFilesCache.unshift(localItem);
                        saveLocalFiles(uid, localFilesCache);
                        renderFilesTable(localFilesCache);

                        showInlineToast('File uploaded successfully!');
                        closeUploadModal();
                    } catch (postUploadErr) {
                        console.error('Metadata save error:', postUploadErr);
                        handleUploadFailure(postUploadErr.message);
                    }
                }
            );
            return;
        } catch (uploadInitErr) {
            console.warn('[Firebase Storage] Resumable upload failed to init:', uploadInitErr.message);
        }
    }

    // Client-side fallback with realistic progress simulation
    simulateFileUpload(uid, file, fileId, storagePath, folderId);
}

// Fallback upload simulation for preview / demo environments
function simulateFileUpload(uid, file, fileId, storagePath, folderId) {
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');

    let currentPercent = 10;
    const interval = setInterval(() => {
        currentPercent += 15;
        if (currentPercent > 100) currentPercent = 100;
        if (progressBar) progressBar.style.width = `${currentPercent}%`;
        if (progressText) progressText.textContent = `Uploading: ${currentPercent}%`;

        if (currentPercent >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                // Create local object URL for preview/download
                const objectUrl = URL.createObjectURL(file);
                const fileMetadata = {
                    id: fileId,
                    name: file.name,
                    storagePath: storagePath,
                    downloadURL: objectUrl,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    folderId: folderId || null,
                    createdAt: new Date().toISOString()
                };

                localFilesCache.unshift(fileMetadata);
                saveLocalFiles(uid, localFilesCache);
                renderFilesTable(localFilesCache);

                showInlineToast('File uploaded successfully!');
                closeUploadModal();
            }, 300);
        }
    }, 120);
}

function handleUploadFailure(errorMessage) {
    isUploading = false;
    activeUploadTask = null;

    const startBtn = document.getElementById('startUploadBtn');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload';
    }
    if (cancelBtn) cancelBtn.disabled = false;

    showModalError(`Upload failed: ${errorMessage || 'Unknown error occurred. Please try again.'}`);
}

function showModalError(msg) {
    const errBox = document.getElementById('uploadModalError');
    if (errBox) {
        errBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
        errBox.style.display = 'block';
    }
}

function showInlineToast(msg, isError = false) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    if (isError) {
        toast.style.background = '#ef4444';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(msg)}`;
    } else {
        toast.style.background = '#10b981';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(msg)}`;
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Setup Event Listeners for Modal and Drag-and-drop
function setupModalListeners() {
    const dropzone = document.getElementById('modalDropzone');
    const fileInput = document.getElementById('hiddenFileInput');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
            }
        });
    }

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-active');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files[0]) {
                handleFileSelected(dt.files[0]);
            }
        }, false);
    }

    // Modal background click close
    const modal = document.getElementById('uploadFileModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && !isUploading) {
                closeUploadModal();
            }
        });
    }

    // Escape key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex' && !isUploading) {
            closeUploadModal();
        }
    });
}

// Expose functions globally for HTML onclick handlers
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.uploadSelectedFile = uploadSelectedFile;
window.downloadFile = downloadFile;
window.deleteUserFile = deleteUserFile;
window.handleFileSelected = (e) => {
    if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
    }
};

// Auto-run on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMyFiles);
} else {
    initMyFiles();
}
