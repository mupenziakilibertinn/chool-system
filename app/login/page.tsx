"use client";
import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
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
      let isAdmin = cleanEmail === "mupenziakilibertinn@gmail.com";
      let requiredPassword = "";
      let isOwner = false;

      if (isAdmin) {
        requiredPassword = "Mupenzi2004";
      } else {
        // Query database to check if this user is a regular teacher or a registered school owner
        const teacherSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", cleanEmail)));
        if (teacherSnap.empty) {
          throw new Error("ACCESS DENIED: Email address is not registered in our system.");
        }
        
        const teacherData = teacherSnap.docs[0].data();
        if (teacherData.role === "owner") {
          isOwner = true;
          requiredPassword = "Newgeneration";
        } else {
          requiredPassword = "123456"; 
        }
      }

      if (password !== requiredPassword) {
        throw new Error("INVALID SECURITY KEY: Check configuration parameters.");
      }

      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: any) {
        if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential") {
          await createUserWithEmailAndPassword(auth, cleanEmail, password);
        } else {
          throw authErr;
        }
      }

      alert("🔐 Authentication verified. Routing session data nodes...");
      
      if (isAdmin || isOwner) {
        router.push("/admin");
      } else {
        router.push("/marks");
      }

    } catch (err: any) {
      setError(err.message);
    } finaly {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-[#1E3A8A] uppercase tracking-wider italic">NEW GENERATION SCHOOL</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Terminal Master Ledger Login</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold uppercase text-[10px] rounded animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 font-bold text-gray-700">
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1">Account Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-2 border-black rounded-xl p-3 text-xs outline-none focus:border-[#1E3A8A] bg-[#F8FAFC]" placeholder="teacher@gmail.com" disabled={loading} />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1">Security Passkey</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border-2 border-black rounded-xl p-3 text-xs outline-none focus:border-[#1E3A8A] bg-[#F8FAFC]" placeholder="••••••••" disabled={loading} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#1E3A8A] hover:bg-black text-white py-3.5 rounded-xl font-black uppercase tracking-wider shadow text-xs transition-colors mt-2">
            {loading ? "VALIDATING CORES..." : "SECURE PORTAL LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}