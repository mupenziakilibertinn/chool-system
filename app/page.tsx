"use client";
import { useState } from "react";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      // Scan firebase rules to locate authorization clearance level
      const q = query(collection(db, "teachers"), where("email", "==", user.email?.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const teacherDoc = querySnapshot.docs[0].data();
        if (teacherDoc.isAdmin) {
          router.push("/admin"); // Take you directly to Master Controls
        } else {
          router.push("/marks"); // Take standard instructors to Mark Sheets
        }
      } else {
        alert("Access Denied: Your email is not registered by the administrator.");
      }
    } catch (err: any) {
      alert("Authentication Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-950 font-sans px-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border-4 border-double border-blue-900">
        <h1 className="text-center text-2xl font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
        <p className="text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 mb-6">Terminal Database Management Access</p>
        
        <form onSubmit={handleLogin} className="space-y-4 text-xs font-bold">
          <div>
            <label className="block text-gray-500 uppercase mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 rounded-xl p-3 outline-none focus:border-blue-900" placeholder="teacher@ngs.com" />
          </div>
          <div>
            <label className="block text-gray-500 uppercase mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border-2 rounded-xl p-3 outline-none focus:border-blue-900" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-900 hover:bg-black text-white py-3 rounded-xl font-black uppercase tracking-wider transition-all mt-2">
            {loading ? "VERIFYING ACCOUNT PROFILE..." : "Secure System Login"}
          </button>
        </form>
      </div>
    </div>
  );
}