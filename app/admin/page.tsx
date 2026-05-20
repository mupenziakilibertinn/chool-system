"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

const subjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function AdminPage() {
  const [tab, setTab] = useState("students");
  const [selectedClass, setSelectedClass] = useState("P6");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tName, setTName] = useState("");
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [tSubjects, setTSubjects] = useState<string[]>([]);
  const [classTeacherOf, setClassTeacherOf] = useState("None");
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => { 
    loadStudents(); 
  }, [selectedClass, tab]);

  const loadStudents = async () => {
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    }
  };

  const saveStudentsBulk = async () => {
    const names = bulkNames.split("\n").map(n => n.trim()).filter(n => n !== "");
    if (names.length === 0) return alert("Please paste names first!");
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      names.forEach(n => {
        const studentRef = doc(collection(db, "students"));
        batch.set(studentRef, { name: n.toUpperCase(), class: selectedClass });
      });
      await batch.commit();
      setBulkNames(""); 
      await loadStudents();
      alert(`⚡ Registered ${names.length} students into ${selectedClass}.`);
    } catch (err: any) {
      alert("Cloud Error: " + err.message);
    }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (!tEmail || !tName) return alert("Please fill in both email and teacher name!");
    setIsSaving(true);
    try {
      await setDoc(doc(db, "teachers", tEmail.trim().toLowerCase()), { 
        email: tEmail.trim().toLowerCase(), 
        name: tName.trim().toUpperCase(),
        classes: tClasses, 
        subjects: tSubjects,
        classTeacherOf: classTeacherOf,
        isAdmin: classTeacherOf === "P6" // Automatically marks you as Master System Admin if you are P6 Class Teacher
      });
      setTEmail(""); setTName(""); setTClasses([]); setTSubjects([]); setClassTeacherOf("None");
      alert("✅ Teacher Role and Permissions Saved!");
    } catch (err: any) {
      alert("Action Failed: " + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-xs pb-10">
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-xl no-print">
        <div>
          <h1 className="font-black uppercase tracking-wider italic text-sm">NGS ADMIN PORTAL</h1>
          <p className="text-[9px] text-green-300 font-bold uppercase tracking-widest mt-0.5">System Status: ONLINE</p>
        </div>
        <div className="flex gap-2">
          {["students", "teachers"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg uppercase font-black text-[9px] tracking-wider transition-colors ${tab === t ? "bg-white text-blue-900" : "bg-blue-800 hover:bg-blue-700"}`}>{t}</button>
          ))}
          <button onClick={() => router.push("/marks")} className="bg-green-600 px-3 py-1.5 rounded-lg uppercase font-black text-[9px] tracking-wider">Marks Entry</button>
          <button onClick={() => router.push("/reports")} className="bg-purple-600 px-3 py-1.5 rounded-lg uppercase font-black text-[9px] tracking-wider">View Reports</button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {tab === "students" && (
          <div>
            <div className="mb-6 flex gap-2 items-center">
              <span className="font-bold uppercase text-[10px] text-gray-500">Target Class Stream:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-xs text-blue-900 outline-none">
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                <h2 className="font-black text-blue-900 uppercase tracking-wider mb-1">Bulk Enroll Students</h2>
                <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder="PASTE NAMES HERE (ONE PER LINE)" className="w-full border-2 rounded-xl p-3 h-48 mb-3 font-mono text-xs outline-none" disabled={isSaving} />
                <button onClick={saveStudentsBulk} className="w-full bg-blue-900 text-white py-3 rounded-xl font-black uppercase transition-colors" disabled={isSaving}>
                  {isSaving ? "SAVING LIST..." : `INSTANT UPLOAD TO ${selectedClass}`}
                </button>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 h-80 overflow-y-auto">
                <h2 className="font-black text-blue-900 uppercase tracking-wider mb-3">Enrolled Roster ({students.length})</h2>
                {students.map(s => (
                  <div key={s.id} className="border-b py-2 flex justify-between items-center font-bold text-gray-700 uppercase">
                    <span>{s.name}</span>
                    <button onClick={async () => { if(confirm("Remove student?")) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-500 font-black text-[10px]">DELETE</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 max-w-md mx-auto">
            <h2 className="font-black text-blue-900 uppercase tracking-wider mb-4">Classroom Assignment Panel</h2>
            <input placeholder="Teacher Full Name (e.g., Tr. MUPENZI)" type="text" value={tName} onChange={(e) => setTName(e.target.value)} className="w-full border-2 rounded-xl p-3 mb-3 font-bold outline-none" disabled={isSaving} />
            <input placeholder="Teacher Email Address" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border-2 rounded-xl p-3 mb-4 font-bold outline-none" disabled={isSaving} />
            
            <div className="mb-4">
              <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-1">Designated Main Class Teacher Of:</p>
              <select value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 rounded-xl p-2 font-bold bg-white text-gray-700 outline-none">
                <option value="None">Not a Main Class Teacher</option>
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 font-bold text-gray-700 mb-5">
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">CLASSES TAUGHT</p>
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => (
                  <label key={c} className="flex items-center gap-2 mb-1 cursor-pointer"><input type="checkbox" checked={tClasses.includes(c)} onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}</label>
                ))}
              </div>
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">LESSONS TAUGHT</p>
                {subjects.map(s => (
                  <label key={s} className="flex items-center gap-2 mb-1 cursor-pointer text-[10px]"><input type="checkbox" checked={tSubjects.includes(s)} onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s]) : setTSubjects(tSubjects.filter(x => x !== s))} /> {s}</label>
                ))}
              </div>
            </div>
            <button onClick={saveTeacher} className="w-full bg-blue-900 text-white py-3 rounded-xl font-black uppercase shadow-md" disabled={isSaving}>
              {isSaving ? "SAVING SYSTEM RULES..." : "Assign System Roles"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}