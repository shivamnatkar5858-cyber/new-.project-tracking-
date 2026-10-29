// firebase-config.js - Firebase SDK Initialization (Auth, Firestore, Storage)
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    reload,
    updateProfile,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL, 
    deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// =========================================================================
// FIREBASE CONFIGURATION
// Replace or configure with your Firebase Project credentials from Firebase Console:
// Project Settings -> General -> Your apps -> Web app
// =========================================================================
const defaultFirebaseConfig = {
    apiKey: "AIzaSyDemo-ProjectTrack-KeyForTesting",
    authDomain: "projecttrack-demo.firebaseapp.com",
    projectId: "projecttrack-demo",
    storageBucket: "projecttrack-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

let storedConfig = null;
try {
    const raw = localStorage.getItem('firebase_config');
    if (raw) storedConfig = JSON.parse(raw);
} catch (e) {}

const firebaseConfig = window.__FIREBASE_CONFIG__ || storedConfig || defaultFirebaseConfig;

let app = null;
let auth = null;
let db = null;
let storage = null;
let isRealFirebase = false;

// Check if credentials appear to be real (non-placeholder)
const isConfigured = firebaseConfig && 
    firebaseConfig.apiKey && 
    !firebaseConfig.apiKey.includes('Demo-') &&
    firebaseConfig.projectId !== 'projecttrack-demo';

try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    isRealFirebase = isConfigured;
    console.log('[Firebase] Initialized with config for project:', firebaseConfig.projectId);
} catch (err) {
    console.warn('[Firebase] SDK initialization note:', err.message);
}

export { 
    app, 
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
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    reload,
    updateProfile,
    sendPasswordResetEmail
};
