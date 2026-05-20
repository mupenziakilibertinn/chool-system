import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDqaBEM57Q_k_sGfv2A7RWifxJ0EhnczeE",
  authDomain: "school-system-e05c0.firebaseapp.com",
  projectId: "school-system-e05c0",
  storageBucket: "school-system-e05c0.firebasestorage.app",
  messagingSenderId: "69366841525",
  appId: "1:69366841525:web:03ea99c608542f81777efc"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);