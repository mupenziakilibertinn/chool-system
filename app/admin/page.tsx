"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";

const availableSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

export default function AdminPage() {
  const [tab, setTab] = useState("students"); // "students" or "teachers"
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  
  // Teacher Form State
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [tEmail, setTEmail] = useState("");
  const [tName, setTName] = useState("");
  const [classTeacherOf, setClassTeacherOf] = useState("None");
  
  // Custom Allocations List
  const [allocations, setAllocations] = useState<{ class: string; subject: string }[]>([]);
  const [currentAllocClass, setCurrentAllocClass] = useState("P1");
  const [currentAllocSubject, setCurrentAllocSubject] = useState("Mathematics");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { 
    loadStudents();
    loadTeachers();
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

  const loadTeachers = async () => {
    try {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    }
  };

  const addAllocation = () => {
    const exists = allocations.some(a => a.class === currentAllocClass && a.subject === currentAllocSubject);
    if (!exists) {
      setAllocations([...allocations, { class: currentAllocClass, subject: currentAllocSubject }]);
    }
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
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
      alert("✅ Roster updated!");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (!tEmail || !tName) return alert("Please fill in both email and name!");
    setIsSaving(true);
    const uniqueClasses = Array.from(new Set(allocations.map(a => a.class)));
    const uniqueSubjects = Array.from(new Set(allocations.map(a => a.subject)));
    try {
      const emailKey = tEmail.trim().toLowerCase();
      await setDoc(doc(db, "teachers", emailKey), { 
        email: emailKey, 
        name: tName.trim().toUpperCase(),
        classTeacherOf: classTeacherOf,
        allocations: allocations,
        classes: uniqueClasses,
        subjects: uniqueSubjects,
        isAdmin: emailKey === "mupenziakili@gmail.com"
      });
      setTEmail(""); setTName(""); setAllocations([]); setClassTeacherOf("None");
      await loadTeachers();
      alert("✅ Teacher Saved and Registered Successfully!");
    } catch (err: any) {
      alert("Failed: " + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 text-gray-800 text-xs">
      
      {/* NAVIGATION TABS BAR */}
      <div className="max-w-6xl mx-auto bg-blue-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center mb-6">
        <div>
          <h1 className="font-black uppercase tracking-wider italic text-sm">NEW GENERATION SCHOOL — ADMIN CONTROL</h1>
          <p className="text-[10px] text-green-300 font-bold uppercase tracking-widest mt-0.5">Active Session View</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setTab("students")} 
            className={`px-4 py-2 rounded-lg font-black tracking-wide text-[10px] uppercase transition-all shadow-sm ${tab === "students" ? "bg-white text-blue-900 scale-105" : "bg-blue-800 hover:bg-blue-700 text-white"}`}
          >
            📋 Manage Roster
          </button>
          <button 
            onClick={() => setTab("teachers")} 
            className={`px-4 py-2 rounded-lg font-black tracking-wide text-[10px] uppercase transition-all shadow-sm ${tab === "teachers" ? "bg-white text-blue-900 scale-105" : "bg-blue-800 hover:bg-blue-700 text-white"}`}
          >
            👨‍🏫 Manage Teachers
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        
        {/* VIEW 1: MANAGE ROSTER PANEL */}
        {tab === "students" && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="mb-4 flex gap-2 items-center">
              <span className="font-black uppercase text-gray-500">Target Class:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 rounded-lg bg-white font-black text-blue-900">
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-black text-blue-900 uppercase mb-2">Bulk Enroll Students</h3>
                <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder="Paste student names here (one name per line)" className="w-full border-2 rounded-xl p-3 h-48 mb-3 font-mono text-xs outline-none focus:border-blue-900 bg-gray-50 font-bold" />
                <button onClick={saveStudentsBulk} className="w-full bg-blue-900 text-white py-3 rounded-xl font-black uppercase tracking-wider hover:bg-black transition-colors">
                  Upload List to {selectedClass}
                </button>
              </div>
              <div className="h-64 overflow-y-auto border p-3 rounded-xl bg-gray-50">
                <h3 className="font-black text-blue-950 uppercase border-b pb-1 mb-2">Registered Pupils ({students.length})</h3>
                {students.map(s => (
                  <div key={s.id} className="flex justify-between items-center py-1.5 border-b uppercase font-bold text-gray-700">
                    <span>{s.name}</span>
                    <button onClick={async () => { if(confirm("Delete?")) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-500 hover:underline font-black text-[10px]">DELETE</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MANAGE TEACHERS PANEL */}
        {tab === "teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Input Form Column */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="font-black text-blue-900 uppercase tracking-wide mb-4 border-b pb-1">Register Faculty Profile</h2>
              
              <div className="space-y-3 mb-4 font-bold text-gray-700">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Teacher Full Name</label>
                  <input placeholder="e.g., TR. ALINE" type="text" value={tName} onChange={(e) => setTName(e.target.value)} className="w-full border-2 rounded-xl p-2 text-xs uppercase outline-none focus:border-blue-900 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Login Email Account</label>
                  <input placeholder="e.g., aline@gmail.com" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border-2 rounded-xl p-2 text-xs outline-none focus:border-blue-900 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Main Class Master Designation:</label>
                  <select value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 rounded-xl p-2 bg-white outline-none">
                    <option value="None">Not a Main Class Teacher</option>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Allocation Generator Grid System Box */}
              <div className="border-2 border-dashed border-blue-900 p-4 rounded-xl bg-gray-50 mb-4">
                <p className="font-black text-[10px] text-blue-900 tracking-wider uppercase mb-2">Build Course Allocation Matrix</p>
                <div className="flex gap-2 mb-3">
                  <select value={currentAllocClass} onChange={(e) => setCurrentAllocClass(e.target.value)} className="p-2 border rounded-lg bg-white font-bold text-xs w-1/3">
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={currentAllocSubject} onChange={(e) => setCurrentAllocSubject(e.target.value)} className="p-2 border rounded-lg bg-white font-bold text-xs w-2/3">
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={addAllocation} className="bg-blue-900 text-white font-black px-4 rounded-lg hover:bg-black uppercase text-[10px]">
                    Add
                  </button>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto bg-white p-2 border rounded-lg font-bold">
                  {allocations.length === 0 ? (
                    <p className="text-gray-400 font-bold italic text-center text-[10px] p-2">No custom subjects chained yet.</p>
                  ) : (
                    allocations.map((alloc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-blue-50 text-blue-950 px-2 py-1 rounded text-[10px] uppercase">
                        <span>{alloc.class} &rarr; {alloc.subject}</span>
                        <button type="button" onClick={() => removeAllocation(idx)} className="text-red-600 hover:underline">Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button onClick={saveTeacher} className="w-full bg-blue-900 hover:bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-wider shadow-sm transition-colors" disabled={isSaving}>
                Save & Sync Teacher Profile
              </button>
            </div>

            {/* Registered Teachers Database Display Column */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border shadow-sm h-[480px] overflow-y-auto">
              <h2 className="font-black text-blue-900 uppercase tracking-wide mb-4 border-b pb-1">Registered Faculty Database ({teachersList.length})</h2>
              <div className="space-y-3">
                {teachersList.map((teacher) => (
                  <div key={teacher.id} className="p-3 border rounded-xl bg-gray-50 flex flex-col md:flex-row justify-between md:items-center gap-3 font-bold">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-blue-950 uppercase text-xs">{teacher.name}</span>
                        {teacher.isAdmin && <span className="bg-red-600 text-white text-[8px] font-black px-1 rounded uppercase">Admin</span>}
                      </div>
                      <p className="font-mono text-[10px] text-gray-500">{teacher.email}</p>
                      <p className="text-[10px] text-gray-600 uppercase mt-0.5">Class Master: <span className="text-blue-900 font-black">{teacher.classTeacherOf || "None"}</span></p>
                      
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {teacher.allocations?.map((a: any, i: number) => (
                          <span key={i} className="bg-white border text-[9px] text-gray-700 px-1.5 py-0.5 rounded font-bold uppercase shadow-sm">
                            {a.class}: {a.subject}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 items-end">
                      <button onClick={() => { setTEmail(teacher.email); setTName(teacher.name); setClassTeacherOf(teacher.classTeacherOf || "None"); setAllocations(teacher.allocations || []); }} className="bg-white border-2 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white px-3 py-1 rounded-lg font-black uppercase text-[9px] shadow-sm">
                        Load
                      </button>
                      {!teacher.isAdmin && (
                        <button onClick={async () => { if (confirm("Remove?")) { await deleteDoc(doc(db, "teachers", teacher.id)); loadTeachers(); } }} className="text-red-600 hover:underline font-black uppercase text-[9px]">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}