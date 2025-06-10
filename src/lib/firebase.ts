// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
// We will dynamically import getAnalytics and isSupported for client-side only
import type { Analytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtM1oZki3NTu9RrR6Nz4rwhkRP33cvnoE",
  authDomain: "real-d5080.firebaseapp.com",
  databaseURL: "https://real-d5080-default-rtdb.firebaseio.com",
  projectId: "real-d5080",
  storageBucket: "real-d5080.appspot.com", // Corrected from .firebasestorage.app
  messagingSenderId: "100344000366",
  appId: "1:100344000366:web:38ae4e6589a14259025b7f",
  measurementId: "G-BPVVNZC439"
};

// Initialize Firebase App
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const authInstance: Auth = getAuth(app);
const databaseInstance: Database = getDatabase(app);
let analyticsInstance: Analytics | null = null;

// Conditionally initialize Analytics only on the client side
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(firebaseAnalytics => {
    firebaseAnalytics.isSupported().then(supported => {
      if (supported) {
        analyticsInstance = firebaseAnalytics.getAnalytics(app);
      }
    }).catch(err => {
        // It's good practice to log or handle the case where isSupported check fails
        console.warn("Firebase Analytics isSupported check failed:", err);
    });
  }).catch(err => {
    // Handle cases where the analytics module itself might fail to load
    console.warn("Failed to load Firebase Analytics module:", err);
  });
}

export { app, authInstance as auth, databaseInstance as database, analyticsInstance as analytics };
