import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyYourActualSecretKeyFromFirebaseConsole", 
  authDomain: "chool-system-bnmq.firebaseapp.com",
  projectId: "chool-system-bnmq",
  storageBucket: "chool-system-bnmq.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_NUMBERS",
  appId: "YOUR_APP_ID_STRING"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);