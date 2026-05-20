"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const availableSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

export default function AdminPage() {
  const [tab, setTab] = useState("students"); // "students" or "teachers"
  const [selectedClass, setSelectedClass] = useState("P6");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  
  // Teacher States
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [tEmail, setTEmail] = useState("");
  const [tName, setTName] = useState("");
  const [classTeacherOf, setClassTeacherOf] = useState("None");
  
  // Advanced Dynamic Allocations (Class + Subject Pairs)
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
    if (names.length === 0) return alert("Please type or paste names first!");
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
      alert("✅ Student roster updated successfully!");
    } catch (err: any) {
      alert("Error saving students: " + err.message);
    }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (!tEmail || !tName) return alert("Please enter both the Teacher Email and Full Name!");
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
      
      // Clean up fields completely
      setTEmail(""); setTName(""); setAllocations([]); setClassTeacherOf("None");
      await loadTeachers();
      alert("✅ Teacher configuration recorded and synced online!");
    } catch (err: any) {
      alert("Failed syncing database profiles: " + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16 text-xs text-gray-800">
      
      {/* Dynamic Navigation Title Bar from your custom template */}
      <div className="bg-[#1E3A8A] text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-base font-black uppercase tracking-wider italic">NGS ADMIN PORTAL</h1>
          <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-0.5">CLOUD SYNC: CONNECTED ✅</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setTab("students")} 
            className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all ${tab === "students" ? "bg-white text-[#1E3A8A] shadow" : "bg-[#172554] text-gray-200 hover:bg-[#1e293b]"}`}
          >
            STUDENTS
          </button>
          <button 
            onClick={() => setTab("teachers")} 
            className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all ${tab === "teachers" ? "bg-white text-[#1E3A8A] shadow" : "bg-[#172554] text-gray-200 hover:bg-[#1e293b]"}`}
          >
            TEACHERS
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        
        {/* VIEW 1: MANAGE STUDENTS TAB */}
        {tab === "students" && (
          <div>
            <div className="mb-6 flex gap-3 items-center">
              <span className="font-black uppercase text-gray-500 tracking-wide">TARGET CLASS STREAM:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-[#1E3A8A] rounded-xl font-black bg-white text-[#1E3A8A] text-xs outline-none">
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-black text-[#1E3A8A] uppercase mb-1 text-sm">BULK ENROLL STUDENTS</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">PASTE YOUR WHOLE LIST BELOW (ONE NAME PER LINE)</p>
                <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 h-48 mb-4 font-mono font-bold uppercase text-xs bg-[#F8FAFC] outline-none focus:border-[#1E3A8A]" placeholder="MUPENZI AKILI BERTIN" />
                <button onClick={saveStudentsBulk} className="w-full bg-[#1E3A8A] hover:bg-black text-white py-3.5 rounded-xl font-black uppercase tracking-wider transition-colors shadow">
                  {isSaving ? "SAVING DATA ARCHITECTURE..." : `SAVE LIST TO ${selectedClass}`}
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[350px]">
                <h3 className="font-black text-[#1E3A8A] uppercase mb-3 text-sm border-b pb-2">VERIFIED ENROLLED ROSTER ({students.length})</h3>
                <div className="overflow-y-auto pr-1 flex-1 space-y-2">
                  {students.map(s => (
                    <div key={s.id} className="flex justify-between items-center py-2 border-b border-gray-100 font-bold uppercase text-gray-700 tracking-wide">
                      <span>{s.name}</span>
                      <button onClick={async () => { if(confirm(`Remove ${s.name}?`)) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-600 font-black hover:underline text-[9px] tracking-widest">DELETE</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MANAGE TEACHERS TAB */}
        {tab === "teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Side: Creation Box Form */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-[#1E3A8A] uppercase mb-4 text-sm border-b pb-2">CLASSROOM ASSIGNMENT PANEL</h3>
              
              <div className="space-y-4 mb-4 font-bold text-gray-700">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1 tracking-wider">Teacher Full Name</label>
                  <input type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g., Tr. MUPENZI" className="w-full border-2 border-black rounded-xl p-3 text-xs uppercase outline-none focus:border-[#1E3A8A] bg-[#F8FAFC]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1 tracking-wider">Teacher Email Address</label>
                  <input type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} placeholder="teacher@gmail.com" className="w-full border-2 border-black rounded-xl p-3 text-xs outline-none focus:border-[#1E3A8A] bg-[#F8FAFC]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1 tracking-wider">DESIGNATED MAIN CLASS TEACHER OF:</label>
                  <select value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 bg-white outline-none">
                    <option value="None">Not a Main Class Teacher</option>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Course Allocation Generator Builder Tool */}
              <div className="border-2 border-dashed border-[#1E3A8A] p-4 rounded-xl bg-[#F8FAFC] mb-5">
                <p className="font-black text-[10px] text-[#1E3A8A] tracking-wider uppercase mb-2">Build Course Allocation Matrix</p>
                <div className="flex gap-2 mb-3">
                  <select value={currentAllocClass} onChange={(e) => setCurrentAllocClass(e.target.value)} className="p-2 border border-gray-400 rounded-lg bg-white font-bold text-xs w-1/3">
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={currentAllocSubject} onChange={(e) => setCurrentAllocSubject(e.target.value)} className="p-2 border border-gray-400 rounded-lg bg-white font-bold text-xs w-2/3">
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={addAllocation} className="bg-[#1E3A8A] text-white font-black px-4 rounded-lg hover:bg-black uppercase text-[10px]">
                    ADD
                  </button>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto bg-white p-2 border rounded-lg font-bold">
                  {allocations.length === 0 ? (
                    <p className="text-gray-400 font-bold italic text-center text-[10px] p-2">No custom subjects linked yet.</p>
                  ) : (
                    allocations.map((alloc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-blue-50 text-blue-950 px-2 py-1.5 rounded text-[10px] uppercase font-black">
                        <span>{alloc.class} &rarr; {alloc.subject}</span>
                        <button type="button" onClick={() => removeAllocation(idx)} className="text-red-600 hover:underline">Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button onClick={saveTeacher} className="w-full bg-[#1E3A8A] hover:bg-green-600 text-white py-3.5 rounded-xl font-black uppercase tracking-wider shadow transition-all" disabled={isSaving}>
                {isSaving ? "SYNCING DATA HUB..." : "SAVING SYSTEM RULES..."}
              </button>
            </div>

            {/* Right Side: Live Roster List View */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[520px]">
              <h3 className="font-black text-[#1E3A8A] uppercase mb-4 text-sm border-b pb-2">REGISTERED FACULTY LIST ({teachersList.length})</h3>
              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {teachersList.map((teacher) => (
                  <div key={teacher.id} className="p-3 border rounded-xl bg-[#F8FAFC] flex flex-col md:flex-row justify-between md:items-center gap-3 font-bold">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-blue-950 uppercase text-xs">{teacher.name}</span>
                        {teacher.isAdmin && <span className="bg-red-600 text-white text-[8px] font-black px-1 rounded uppercase">Admin</span>}
                      </div>
                      <p className="font-mono text-[10px] text-gray-500">{teacher.email}</p>
                      <p className="text-[10px] text-gray-600 uppercase mt-0.5">Main Teacher: <span className="text-[#1E3A8A] font-black">{teacher.classTeacherOf || "None"}</span></p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {teacher.allocations?.map((a: any, i: number) => (
                          <span key={i} className="bg-white border text-[9px] text-gray-700 px-1.5 py-0.5 rounded-md font-black uppercase shadow-sm">
                            {a.class}: {a.subject}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col gap-2 items-end justify-end text-right">
                      <button onClick={() => { setTEmail(teacher.email); setTName(teacher.name); setClassTeacherOf(teacher.classTeacherOf || "None"); setAllocations(teacher.allocations || []); }} className="bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded-lg font-black uppercase text-[9px] transition-all shadow-sm">
                        EDIT
                      </button>
                      {!teacher.isAdmin && (
                        <button onClick={async () => { if (confirm(`Remove profile entry for ${teacher.name}?`)) { await deleteDoc(doc(db, "teachers", teacher.id)); loadTeachers(); } }} className="text-red-600 hover:underline font-black uppercase text-[9px] tracking-wide">
                          DELETE
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