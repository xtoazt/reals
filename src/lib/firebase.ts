
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database, ref, onValue, off, serverTimestamp, onDisconnect, set, goOnline, goOffline } from 'firebase/database';
// We will dynamically import getAnalytics and isSupported for client-side only
import type { Analytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtM1oZki3NTu9RrR6Nz4rwhkRP33cvnoE",
  authDomain: "real-d5080.firebaseapp.com",
  databaseURL: "https://real-d5080-default-rtdb.firebaseio.com",
  projectId: "real-d5080",
  storageBucket: "real-d5080.appspot.com",
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
        console.warn("Firebase Analytics isSupported check failed:", err);
    });
  }).catch(err => {
    console.warn("Failed to load Firebase Analytics module:", err);
  });
}

// Presence management
const setupPresence = (userId: string) => {
  if (!userId) return;
  const userStatusDatabaseRef = ref(databaseInstance, `/presence/${userId}`);
  const connectedRef = ref(databaseInstance, '.info/connected');

  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) {
      // User is offline, but onDisconnect should handle setting the status.
      // We could also explicitly set it here if needed for reliability.
      // set(userStatusDatabaseRef, { isOnline: false, lastChanged: serverTimestamp() });
      return;
    }

    // User is online. Set up onDisconnect.
    onDisconnect(userStatusDatabaseRef)
      .set({ isOnline: false, lastChanged: serverTimestamp() })
      .then(() => {
        // onDisconnect setup successfully. Now set current status to online.
        set(userStatusDatabaseRef, { isOnline: true, lastChanged: serverTimestamp() });
      });
  });
};

export { app, authInstance as auth, databaseInstance as database, analyticsInstance as analytics, setupPresence, goOnline, goOffline };
