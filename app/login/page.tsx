"use client";
import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. First, check if this teacher exists in your Firestore database records
      const teacherDocRef = doc(db, "teachers", cleanEmail);
      const teacherSnap = await getDoc(teacherDocRef);

      if (!teacherSnap.empty && !teacherSnap.exists()) {
        throw new Error("ACCESS DENIED: Your email is not registered in the school system.");
      }

      const teacherData = teacherSnap.data();
      const isAdmin = teacherData?.isAdmin || cleanEmail === "mupenziakili@gmail.com";

      // 2. Validate the universal password rules matching your instruction
      let requiredPassword = "123456"; // Default for all teachers
      if (isAdmin) {
        requiredPassword = "Mupenzi2004"; // Your personal master password
      }

      if (password !== requiredPassword) {
        throw new Error("INVALID PASSWORD: Please verify your credentials and try again.");
      }

      // 3. Authenticate with Firebase Auth in the background
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: any) {
        // If account doesn't exist in Auth tab yet, auto-create it instantly to prevent errors
        if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential") {
          try {
            await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } catch (createErr: any) {
            // If already created but password was different on the backend, update it or bypass
            throw new Error("Authentication sync issue. Contact system administrator.");
          }
        } else {
          throw authErr;
        }
      }

      // 4. Redirect successfully based on role profiling
      alert("🔐 Access Granted! Redirecting to Terminal Matrix Dashboard...");
      if (isAdmin) {
        router.push("/admin");
      } else {
        router.push("/marks");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-blue-900 uppercase tracking-wider italic">NEW GENERATION SCHOOL</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Terminal Ledger Gatekeeper</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold uppercase text-[10px] rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 font-bold text-gray-700">
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1">Official Account Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-900 uppercase bg-gray-50 font-mono" placeholder="teacher@gmail.com" disabled={loading} />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1">System Security Key</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-900 bg-gray-50 font-mono" placeholder="••••••••" disabled={loading} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-900 hover:bg-black text-white py-3.5 rounded-xl font-black uppercase tracking-wider transition-all shadow-md mt-2 text-xs">
            {loading ? "VALIDATING MATRIX CREDENTIALS..." : "Secure Login Control"}
          </button>
        </form>
      </div>
    </div>
  );
}