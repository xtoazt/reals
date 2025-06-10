// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
// import { getFirestore } from "firebase/firestore";
// import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics";

// TODO: Add your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const database = getDatabase(app);
// const firestore = getFirestore(app); // Uncomment if you want to use Firestore
// const storage = getStorage(app); // Uncomment if you want to use Storage
// const analytics = getAnalytics(app); // Uncomment if you want to use Analytics

export { app, auth, database /*, firestore, storage, analytics */ };

// HOW TO USE:
// 1. Go to your Firebase project console.
// 2. In the project settings, find your web app's configuration object.
// 3. Replace the placeholder values in `firebaseConfig` above with your actual Firebase project credentials.
// 4. Ensure your Realtime Database rules are set up correctly for development/production.
//    For example, for starting out, you might use:
//    {
//      "rules": {
//        ".read": "auth != null", // Or true for public read during dev
//        ".write": "auth != null" // Or true for public write during dev
//      }
//    }
//    BE SURE TO SECURE YOUR RULES BEFORE PRODUCTION.
