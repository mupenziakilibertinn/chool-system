"use client";
import Link from "next/link";

export default function RootLandingPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-6 font-sans text-slate-800">
      
      {/* SCHOOL BRANDING HEADER */}
      <div className="text-center mb-12 max-w-md">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-2xl shadow-md mb-4 text-white font-black">
          NG
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
          New Generation School
        </h1>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-relaxed">
          Integrated Education Management System &middot; Portal Entry
        </p>
      </div>

      {/* TWO-WAY ACCESS CHANNELS */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* TEACHER ACCESS ENTRY */}
        <Link href="/login" className="group">
          <div className="bg-white border-2 border-slate-200 p-8 rounded-3xl shadow-sm hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[260px] cursor-pointer">
            <div>
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                🧑‍🏫
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mt-6">
                Teacher Terminal
              </h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-normal mt-2 leading-relaxed">
                Secure gateway for instructional staff to log in, manage student records, and input evaluation marks.
              </p>
            </div>
            
            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between">
              <span className="text-blue-600 font-black text-[10px] uppercase tracking-wider">
                Access Marks Console &rarr;
              </span>
              <span className="bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-500 text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider transition-colors">
                Staff Only
              </span>
            </div>
          </div>
        </Link>

        {/* ADMINISTRATIVE ACCESS ENTRY */}
        <Link href="/admin" className="group">
          <div className="bg-white border-2 border-slate-200 p-8 rounded-3xl shadow-sm hover:border-emerald-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[260px] cursor-pointer">
            <div>
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                💼
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mt-6">
                Administrative Terminal
              </h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-normal mt-2 leading-relaxed">
                Executive workspace to pass directly into institutional tracking data, system analytics, and master files.
              </p>
            </div>
            
            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between">
              <span className="text-emerald-600 font-black text-[10px] uppercase tracking-wider">
                Pass to Admin Control &rarr;
              </span>
              <span className="bg-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 text-slate-500 text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider transition-colors">
                Authorized Only
              </span>
            </div>
          </div>
        </Link>

      </div>

      {/* SYSTEM META FOOTER */}
      <div className="mt-16 text-center">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          Secured System Connection &middot; Active Version 1.0.0
        </p>
      </div>

    </div>
  );
}