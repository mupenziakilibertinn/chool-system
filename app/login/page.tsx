"use client";
import { useState } from "react";
import { auth } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.push("/teachers");
    } catch (err: any) { 
      setError(err.message); 
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-blue-900 font-sans">
      <form onSubmit={doLogin} className="bg-white p-8 rounded-2xl shadow-xl w-80">
        <h1 className="font-black text-center text-blue-900 mb-2 tracking-wide uppercase italic">NGS Portal</h1>
        <p className="text-center text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-6">Teacher Authentication</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-2 text-[10px] font-bold uppercase mb-4">
            {error.includes("auth/invalid-credential") ? "Wrong email or password" : error}
          </div>
        )}

        <input placeholder="Email Address" type="email" onChange={(e) => setEmail(e.target.value)} className="w-full border-2 rounded-xl p-3 text-xs mb-3 font-bold outline-none focus:border-blue-900" required />
        <input placeholder="Password" type="password" onChange={(e) => setPass(e.target.value)} className="w-full border-2 rounded-xl p-3 text-xs mb-4 font-bold outline-none focus:border-blue-900" required />
        <button className="w-full bg-blue-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg">Login</button>
      </form>
    </div>
  );
}