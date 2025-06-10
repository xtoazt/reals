
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
  // This apiKey was provided by you.
  apiKey: "nq6KlkpPMIL3qMTriyGOq6hF4pSPVkuSJNzPhbNi",
  // YOU MUST REPLACE THIS with your Firebase project's authDomain
  authDomain: "YOUR_AUTH_DOMAIN",
  // YOU MUST REPLACE THIS with your Firebase project's databaseURL
  // Example: "https://your-project-id.firebaseio.com" or "https://your-project-id-default-rtdb.europe-west1.firebasedatabase.app"
  databaseURL: "YOUR_DATABASE_URL",
  // YOU MUST REPLACE THIS with your Firebase project's projectId
  projectId: "YOUR_PROJECT_ID",
  // YOU MUST REPLACE THIS with your Firebase project's storageBucket
  storageBucket: "YOUR_STORAGE_BUCKET",
  // YOU MUST REPLACE THIS with your Firebase project's messagingSenderId
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  // YOU MUST REPLACE THIS with your Firebase project's appId
  appId: "YOUR_APP_ID",
  // This is optional, but if you use Analytics, REPLACE THIS with your measurementId
  measurementId: "YOUR_MEASUREMENT_ID"
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
// 1. Go to your Firebase project console (https://console.firebase.google.com/).
// 2. In the project settings (gear icon -> Project settings -> General tab -> Your apps), find your web app's configuration object.
// 3. Replace ALL the placeholder values above (YOUR_AUTH_DOMAIN, YOUR_DATABASE_URL, etc.) with your actual Firebase project credentials.
// 4. Ensure your Realtime Database rules are set up correctly for development/production.
//    For example, for starting out, you might use:
//    {
//      "rules": {
//        ".read": "auth != null",
//        ".write": "auth != null"
//      }
//    }
//    BE SURE TO SECURE YOUR RULES BEFORE PRODUCTION.
