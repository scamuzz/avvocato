// firebase-config.js - Configure with your Firebase project credentials
// Replace the values below with your Firebase project configuration
// Found at: Firebase Console > Project Settings > General > Your apps
// Steps:
//   1. Go to https://console.firebase.google.com
//   2. Select your project (or create one)
//   3. Click the gear icon → Project Settings
//   4. Scroll to "Your apps" and select your Web app (or register one)
//   5. Copy the firebaseConfig object values into this file

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase app (compat SDK v9 loaded via CDN in HTML)
firebase.initializeApp(firebaseConfig);

// Authentication service — handles login, logout, session state
const auth = firebase.auth();

// Firestore database — stores all application data
const db = firebase.firestore();

// Cloud Storage — stores uploaded documents and files
const storage = firebase.storage();

// Enable Firestore offline persistence for better UX
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open; persistence can only be enabled in one tab at a time
    console.warn('Firestore persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Browser does not support persistence
    console.warn('Firestore persistence not supported in this browser');
  }
});
