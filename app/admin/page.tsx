"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const availableSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

export default function AdminPage() {
  const [tab, setTab] = useState("students");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  
  // Teacher Form State
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [tEmail, setTEmail] = useState("");
  const [tName, setTName] = useState("");
  const [classTeacherOf, setClassTeacherOf] = useState("None");
  
  // Custom Allocations (Pairs of Class + Subject)
  const [allocations, setAllocations] = useState<{ class: string; subject: string }[]>([]);
  const [currentAllocClass, setCurrentAllocClass] = useState("P1");
  const [currentAllocSubject, setCurrentAllocSubject] = useState("Mathematics");

  const [isSaving, setIsSaving] = useState(false);
  const [dbStatus, setDbStatus] = useState("Checking database link...");

  useEffect(() => { 
    loadStudents();
    loadTeachers();
  }, [selectedClass, tab]);

  const loadStudents = async () => {
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      setDbStatus("CONNECTED ✅");
    } catch (e) {
      setDbStatus("CONNECTION ERROR ❌");
    }
  };

  const loadTeachers = async () => {
    try {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error("Error loading teachers:", e);
    }
  };

  const addAllocation = () => {
    // Prevent adding exact duplicate pairs
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
      alert(`⚡ Registered ${names.length} students into ${selectedClass}.`);
    } catch (err: any) {
      alert("Cloud Error: " + err.message);
    }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (!tEmail || !tName) return alert("Please fill in both email and teacher name!");
    setIsSaving(true);
    
    // Extract unique flat lists for backwards compatibility with legacy layout dependencies
    const uniqueClasses = Array.from(new Set(allocations.map(a => a.class)));
    const uniqueSubjects = Array.from(new Set(allocations.map(a => a.subject)));

    try {
      const emailKey = tEmail.trim().toLowerCase();
      await setDoc(doc(db, "teachers", emailKey), { 
        email: emailKey, 
        name: tName.trim().toUpperCase(),
        classTeacherOf: classTeacherOf,
        allocations: allocations, // New flexible pair tracking array
        classes: uniqueClasses,     // Fallback structural compatibility lists
        subjects: uniqueSubjects,   // Fallback structural compatibility lists
        isAdmin: emailKey === "mupenziakili@gmail.com"
      });
      
      // Reset form variables safely
      setTEmail(""); setTName(""); setAllocations([]); setClassTeacherOf("None");
      await loadTeachers();
      alert("✅ Teacher Registered and Profile Synced Successfully!");
    } catch (err: any) {
      alert("Action Failed: " + err.message);
    }
    setIsSaving(false);
  };

  const handleEditTeacher = (teacher: any) => {
    setTEmail(teacher.email);
    setTName(teacher.name);
    setClassTeacherOf(teacher.classTeacherOf || "None");
    setAllocations(teacher.allocations || []);
  };

  const handleDeleteTeacher = async (email: string) => {
    if (confirm(`Are you sure you want to completely remove teacher profile: ${email.toUpperCase()}?`)) {
      try {
        await deleteDoc(doc(db, "teachers", email.toLowerCase()));
        await loadTeachers();
        alert("🗑️ Teacher profile removed from database records.");
      } catch (err: any) {
        alert("Delete failed: " + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-xs pb-10">
      {/* Top Admin Banner */}
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-xl">
        <div>
          <h1 className="font-black uppercase tracking-wider italic text-sm">NEW GENERATION SCHOOL — ADMIN CONTROL</h1>
          <p className="text-[9px] text-green-300 font-bold uppercase tracking-widest mt-0.5">Database Node Link: {dbStatus}</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={() => setTab("students")} className={`px-4 py-2 rounded-lg uppercase font-black text-[9px] tracking-wider transition-colors ${tab === "students" ? "bg-white text-blue-900" : "bg-blue-800 hover:bg-blue-700"}`}>Manage Roster</button>
          <button onClick={() => setTab("teachers")} className={`px-4 py-2 rounded-lg uppercase font-black text-[9px] tracking-wider transition-colors ${tab === "teachers" ? "bg-white text-blue-900" : "bg-blue-800 hover:bg-blue-700"}`}>Manage Teachers</button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* TAB 1: STUDENT CONFIGURATION */}
        {tab === "students" && (
          <div>
            <div className="mb-6 flex gap-2 items-center">
              <span className="font-bold uppercase text-[10px] text-gray-500">Target Class Stream:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-xs text-blue-900 outline-none">
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                <h2 className="font-black text-blue-900 uppercase tracking-wider mb-1">Bulk Enroll Students</h2>
                <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder="PASTE STUDENT NAMES HERE (ONE PER LINE)" className="w-full border-2 rounded-xl p-3 h-48 mb-3 font-mono text-xs outline-none focus:border-blue-900" disabled={isSaving} />
                <button onClick={saveStudentsBulk} className="w-full bg-blue-900 hover:bg-black text-white py-3 rounded-xl font-black uppercase transition-colors" disabled={isSaving}>
                  {isSaving ? "SAVING LIST..." : `INSTANT UPLOAD TO ${selectedClass}`}
                </button>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 h-[320px] overflow-y-auto">
                <h2 className="font-black text-blue-900 uppercase tracking-wider mb-3 border-b pb-2">Enrolled Roster ({students.length} pupils)</h2>
                {students.map(s => (
                  <div key={s.id} className="border-b py-2 flex justify-between items-center font-bold text-gray-700 uppercase hover:bg-gray-50 px-1">
                    <span>{s.name}</span>
                    <button onClick={async () => { if(confirm(`Remove ${s.name}?`)) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-500 font-black hover:underline text-[10px]">DELETE</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FLEXIBLE TEACHER CONFIGURATION & ROSTER LIST VIEW */}
        {tab === "teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Form setup and allocation creator */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-md border border-gray-100">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-4 border-b pb-2">Teacher Assignment Profile</h2>
              
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Teacher Full Name</label>
                  <input placeholder="e.g., TR. MUPENZI" type="text" value={tName} onChange={(e) => setTName(e.target.value)} className="w-full border-2 rounded-xl p-2.5 font-bold outline-none uppercase focus:border-blue-900 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Login Email Address Address</label>
                  <input placeholder="e.g., mupenziakili@gmail.com" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border-2 rounded-xl p-2.5 font-bold outline-none focus:border-blue-900 bg-gray-50 text-gray-700" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Designated Main Class Master Of:</label>
                  <select value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 rounded-xl p-2 font-bold bg-white text-gray-700 outline-none">
                    <option value="None">Not a Main Class Teacher</option>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Dynamic Sub-Form to chain dynamic multiple classes with different lessons */}
              <div className="border-2 border-dashed border-blue-900 p-4 rounded-xl bg-gray-50 mb-5">
                <p className="font-black text-[10px] text-blue-900 tracking-wider uppercase mb-2">Build Course Allocation Matrix</p>
                <div className="flex gap-2 mb-3">
                  <select value={currentAllocClass} onChange={(e) => setCurrentAllocClass(e.target.value)} className="p-2 border rounded-lg bg-white font-bold w-1/3 text-gray-700 text-xs">
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={currentAllocSubject} onChange={(e) => setCurrentAllocSubject(e.target.value)} className="p-2 border rounded-lg bg-white font-bold w-2/3 text-gray-700 text-xs">
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={addAllocation} className="bg-blue-900 text-white font-black px-4 rounded-lg hover:bg-black uppercase text-[10px] tracking-wide">
                    Add
                  </button>
                </div>

                {/* List of allocations queued up for this teacher profile */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto bg-white p-2 border rounded-lg">
                  {allocations.length === 0 ? (
                    <p className="text-gray-400 font-bold italic text-center p-2 text-[10px]">No subjects assigned yet.</p>
                  ) : (
                    allocations.map((alloc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-blue-50 text-blue-950 font-black px-2 py-1 rounded text-[10px] uppercase">
                        <span>{alloc.class} &rarr; {alloc.subject}</span>
                        <button type="button" onClick={() => removeAllocation(idx)} className="text-red-600 hover:underline">Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button onClick={saveTeacher} className="w-full bg-blue-900 hover:bg-green-600 text-white py-3.5 rounded-xl font-black uppercase tracking-wider shadow-md transition-colors" disabled={isSaving}>
                {isSaving ? "SYNCING DATA ARCHITECTURE..." : "Save & Sync Teacher Profile"}
              </button>
            </div>

            {/* Right Column: Dynamic Teacher List View & Editor Control Panel */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-md border border-gray-100">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-4 border-b pb-2">Registered Faculty Database ({teachersList.length})</h2>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {teachersList.map((teacher) => (
                  <div key={teacher.id} className="p-3 border rounded-xl bg-gray-50 hover:bg-blue-50/40 transition-colors flex flex-col justify-between md:flex-row md:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-blue-950 text-sm uppercase">{teacher.name}</span>
                        {teacher.isAdmin && <span className="bg-red-600 text-white font-black px-1.5 py-0.5 rounded text-[8px] uppercase">Master Admin</span>}
                      </div>
                      <p className="font-mono text-[10px] text-gray-500 mt-0.5">{teacher.email}</p>
                      <p className="text-[10px] font-bold text-gray-600 mt-1 uppercase">
                        Class Teacher: <span className="text-blue-900 font-black">{teacher.classTeacherOf || "None"}</span>
                      </p>
                      
                      {/* Displays custom allocations cleanly */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {teacher.allocations && teacher.allocations.map((a: any, i: number) => (
                          <span key={i} className="bg-white border text-[9px] text-gray-700 px-1.5 py-0.5 rounded-md font-bold uppercase shadow-sm">
                            {a.class}: {a.subject}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 md:flex-col justify-end text-right">
                      <button onClick={() => handleEditTeacher(teacher)} className="bg-white border-2 border-blue-900 hover:bg-blue-900 hover:text-white text-blue-900 px-3 py-1 rounded-lg font-black uppercase tracking-wide text-[9px] shadow-sm transition-all">
                        Load/Edit
                      </button>
                      {!teacher.isAdmin && (
                        <button onClick={() => handleDeleteTeacher(teacher.id)} className="text-red-600 hover:underline font-black uppercase text-[9px] tracking-wide px-2 py-1">
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