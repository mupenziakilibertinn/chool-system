"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const subjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "Social Studies", "French"];

export default function MarksPage() {
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const snap = await getDocs(collection(db, "students"));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((s: any) => s.class === selectedClass)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setStudents(list);
      } catch (err) {
        console.error("Error loading marks view:", err);
      }
    };
    loadStudents();
  }, [selectedClass, selectedSubject]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 text-xs">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h1 className="text-xl font-black text-blue-900 uppercase tracking-wider italic mb-4">NGS Marks Overview</h1>
        
        <div className="flex gap-3 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 outline-none">
              {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Subject Course</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 outline-none">
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 font-black text-[10px] text-blue-900 uppercase border-b">
              <tr>
                <th className="p-3">Student Name</th>
                <th className="p-3 text-center">Class Level</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-gray-400 font-bold uppercase tracking-wider">No student rosters records found for this setup</td>
                </tr>
              ) : (
                students.map(s => (
                  <tr key={s.id} className="border-b hover:bg-blue-50/50">
                    <td className="p-3 font-bold text-gray-800 uppercase tracking-wide">{s.name}</td>
                    <td className="p-3 text-center font-black text-blue-950">{s.class}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}