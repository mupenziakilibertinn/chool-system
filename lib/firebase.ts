import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 1. Added this import

const firebaseConfig = {
  apiKey: "AIzaSyDqaBEM57Q_k_sGfv2A7RWifxJ0EhnczeE",
  authDomain: "school-system-e05c0.firebaseapp.com",
  projectId: "school-system-e05c0",
  storageBucket: "school-system-e05c0.firebasestorage.app",
  messagingSenderId: "69366841525",
  appId: "1:69366841525:web:03ea99c608542f81777efc"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const auth = getAuth(app); // 2. Added this initialization

// 3. Export BOTH db and auth
export { db, auth };