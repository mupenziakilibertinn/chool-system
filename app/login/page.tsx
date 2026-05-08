"use client";
import { useState } from "react";
import { auth } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const router = useRouter();

  const doLogin = async (e: any) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.push("/teachers");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-blue-900">
      <form onSubmit={doLogin} className="bg-white p-8 rounded shadow-xl w-80">
        <h1 className="font-bold text-center mb-6">TEACHER LOGIN</h1>
        <input placeholder="Email" type="email" onChange={(e) => setEmail(e.target.value)} className="w-full border p-2 mb-4" required />
        <input placeholder="Password" type="password" onChange={(e) => setPass(e.target.value)} className="w-full border p-2 mb-4" required />
        <button className="w-full bg-blue-900 text-white py-2 font-bold">LOGIN</button>
      </form>
    </div>
  );
}