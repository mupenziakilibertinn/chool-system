"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";

const subjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "Social Studies", "French"];

export default function AdminPage() {
  const [tab, setTab] = useState("students");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [tSubjects, setTSubjects] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { 
    loadStudents(); 
  }, [selectedClass, tab]);

  const loadStudents = async () => {
    if (tab !== "students") return;
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error("Error loading roster:", e);
    }
  };

  const saveStudentsBulk = async () => {
    const names = bulkNames.split("\n").map(n => n.trim()).filter(n => n !== "");
    if (names.length === 0) return alert("Please type or paste names first!");
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      names.forEach(n => {
        // Create a fresh document reference with an auto-generated ID
        const studentRef = doc(collection(db, "students"));
        batch.set(studentRef, {
          name: n.toUpperCase(),
          class: selectedClass
        });
      });

      // Commit all operations at once in a single network request
      await batch.commit();
      
      setBulkNames(""); 
      await loadStudents();
      alert(`⚡ Supercharge Save Complete! Registered ${names.length} students into ${selectedClass} instantly.`);
    } catch (err: any) {
      alert("Database Upload Failed: " + err.message);
    }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (!tEmail) return alert("Please type a teacher email!");
    setIsSaving(true);
    try {
      await setDoc(doc(db, "teachers", tEmail.trim().toLowerCase()), { 
        email: tEmail.trim().toLowerCase(), 
        classes: tClasses, 
        subjects: tSubjects 
      });
      setTEmail(""); setTClasses([]); setTSubjects([]);
      alert("✅ Teacher Configuration Set Successfully!");
    } catch (err: any) {
      alert("Action Failed: " + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-xs pb-10">
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-xl">
        <h1 className="font-black uppercase tracking-wider italic text-sm">NGS ADMIN PORTAL</h1>
        <div className="flex gap-2">
          {["students", "teachers"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg uppercase font-black text-[9px] tracking-wider transition-colors ${tab === t ? "bg-white text-blue-900" : "bg-blue-800 hover:bg-blue-700"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex gap-2 items-center">
          <span className="font-bold uppercase text-[10px] text-gray-500">Target Class Stream:</span>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-xs text-blue-900 outline-none">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {tab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-1">Bulk Enroll Students</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">Paste your whole list below (One name per line)</p>
              <textarea 
                value={bulkNames} 
                onChange={(e) => setBulkNames(e.target.value)} 
                placeholder="MUPENZI AKILI BERTIN&#10;MIZERO DIDE&#10;KEZA ALINE" 
                className="w-full border-2 rounded-xl p-3 h-48 mb-3 font-mono text-xs outline-none focus:border-blue-900" 
                disabled={isSaving}
              />
              <button 
                onClick={saveStudentsBulk} 
                className="w-full bg-blue-900 hover:bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-wide shadow-md disabled:bg-gray-400 transition-colors"
                disabled={isSaving}
              >
                {isSaving ? "SAVING BATCH LIST TO CLOUD..." : `INSTANT UPLOAD TO ${selectedClass}`}
              </button>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 h-80 overflow-y-auto">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-3">Enrolled Roster ({students.length})</h2>
              {students.map(s => (
                <div key={s.id} className="border-b py-2 flex justify-between items-center font-bold text-gray-700 uppercase">
                  <span>{s.name}</span>
                  <button onClick={async () => { if(confirm("Remove student?")) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-500 hover:underline font-black text-[10px]">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 max-w-md mx-auto">
            <h2 className="font-black text-blue-900 uppercase tracking-wider mb-4">Classroom Assignment</h2>
            <input placeholder="Teacher Email Address" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border-2 rounded-xl p-3 mb-4 font-bold outline-none focus:border-blue-900" disabled={isSaving} />
            <div className="grid grid-cols-2 gap-4 font-bold text-gray-700 mb-5">
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">CLASSES</p>
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => (
                  <label key={c} className="flex items-center gap-2 mb-1 cursor-pointer"><input type="checkbox" checked={tClasses.includes(c)} onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}</label>
                ))}
              </div>
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">SUBJECTS</p>
                {subjects.map(s => (
                  <label key={s} className="flex items-center gap-2 mb-1 cursor-pointer text-[10px]"><input type="checkbox" checked={tSubjects.includes(s)} onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s]) : setTSubjects(tSubjects.filter(x => x !== s))} /> {s}</label>
                ))}
              </div>
            </div>
            <button onClick={saveTeacher} className="w-full bg-blue-900 hover:bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-wide shadow-md transition-colors" disabled={isSaving}>
              {isSaving ? "COMMITTING PERMISSIONS..." : "Assign System Roles"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}