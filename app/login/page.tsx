"use client";
import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
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

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      
      if (userCredential.user) {
        if (cleanEmail === "mupenziakilibertinn@gmail.com") {
          router.push("/admin");
        } else {
          const teacherSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", cleanEmail)));
          if (!teacherSnap.empty) {
            const data = teacherSnap.docs[0].data();
            if (data.role === "owner") {
              router.push("/admin");
            } else {
              router.push("/marks");
            }
          } else {
            router.push("/marks");
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Invalid email configuration or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center font-sans px-4">
      <div className="bg-white p-8 rounded-2xl border-2 border-gray-200 shadow-sm w-full max-w-md">
        <h2 className="text-center text-lg font-black text-blue-900 uppercase tracking-wider mb-1">NGS SYSTEM PORTAL</h2>
        <p className="text-center text-[10px] text-gray-400 font-bold uppercase mb-6">NEW GENERATION SCHOOL MANAGEMENT HUB</p>
        
        {error && (
          <div className="p-3 bg-red-50 border-2 border-red-200 text-red-700 font-black rounded-xl text-center uppercase text-[10px] mb-4">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Authorized ID Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-black rounded-xl p-3.5 text-xs font-black placeholder-gray-400" placeholder="teacher@gmail.com" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Security Access Key</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-black rounded-xl p-3.5 text-xs font-black placeholder-gray-400" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#1E3A8A] text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs hover:bg-black transition-colors shadow mt-2">
            {loading ? "VERIFYING MATRIX AUTH..." : "SECURE SYSTEM SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
}