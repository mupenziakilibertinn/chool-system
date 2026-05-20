import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSy...", // Make sure this is your real, long string from Firebase
  authDomain: "chool-system-bnmq.firebaseapp.com",
  projectId: "chool-system-bnmq",
  storageBucket: "chool-system-bnmq.appspot.com",
  messagingSenderId: "123456789012", // Your actual sender ID digits
  appId: "1:123456:web:abcd1234" // Your actual App ID string
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);