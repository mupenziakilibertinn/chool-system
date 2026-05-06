"use client";
import { useState } from "react";
import { auth } from "../../lib/firebase"; // Ensure path is correct
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Your specific Email Command
      if (user.email === "mupenziakilibertinn@gmail.com") {
        console.log("Admin Access Granted");
        router.push("/admin");
      } else {
        console.log("Teacher Access Granted");
        router.push("/teachers");
      }
    } catch (err: any) {
      console.error(err.code);
      // Friendly error messages
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Check your internet.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-2xl w-full max-w-md border-b-[10px] border-green-600">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">Login</h1>
          <p className="text-green-700 font-bold text-xs mt-2 uppercase tracking-widest">New Generation School</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-6 border border-red-100 text-center uppercase">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-blue-900 mb-1 uppercase ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="name@school.com" 
              className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-900 font-bold transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-blue-900 mb-1 uppercase ml-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-900 font-bold transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest active:scale-95 disabled:bg-gray-400"
          >
            {loading ? "Checking Identity..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-[10px] font-bold uppercase">Authorized Access Only</p>
        </div>
      </div>
    </div>
  );
}