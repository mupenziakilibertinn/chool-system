"use client";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter">Welcome Back</h1>
      <p className="text-blue-200 font-bold mb-10 italic uppercase text-sm">New Generation School System</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Admin Card */}
        <button 
          onClick={() => router.push("/admin")}
          className="group bg-white p-10 rounded-3xl border-b-8 border-green-600 transition-all hover:-translate-y-2 text-left"
        >
          <div className="bg-green-100 text-green-700 w-12 h-12 rounded-full flex items-center justify-center mb-4 font-black">A</div>
          <h2 className="text-2xl font-black text-blue-900 uppercase">Administrator</h2>
          <p className="text-gray-500 font-medium text-sm mt-2">Register students, manage classes, and generate official reports.</p>
        </button>

        {/* Teacher Card */}
        <button 
          onClick={() => router.push("/teachers")}
          className="group bg-white p-10 rounded-3xl border-b-8 border-blue-600 transition-all hover:-translate-y-2 text-left"
        >
          <div className="bg-blue-100 text-blue-900 w-12 h-12 rounded-full flex items-center justify-center mb-4 font-black">T</div>
          <h2 className="text-2xl font-black text-blue-900 uppercase">Teacher Portal</h2>
          <p className="text-gray-500 font-medium text-sm mt-2">Enter marks for tests and exams with high-speed vertical entry.</p>
        </button>
      </div>
      
      <button 
        onClick={() => router.push("/login")}
        className="mt-12 text-blue-300 font-black uppercase text-xs hover:text-white transition"
      >
        ← Sign Out
      </button>
    </div>
  );
}