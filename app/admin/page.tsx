"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ReportsPage from "../reports/page"; 

const availableSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

export default function AdminPage() {
  const [tab, setTab] = useState("students"); 
  const [selectedClass, setSelectedClass] = useState("P6");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [tEmail, setTEmail] = useState("");
  const [tName, setTName] = useState("");
  const [tRole, setTRole] = useState("teacher"); // "teacher" or "owner"
  const [classTeacherOf, setClassTeacherOf] = useState("None");
  
  // Track multiple selections via checkboxes matching your design
  const [selectedClassesTaught, setSelectedClassesTaught] = useState<string[]>([]);
  const [selectedLessonsTaught, setSelectedLessonsTaught] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const cleanEmail = user.email.toLowerCase();
        if (cleanEmail === "mupenziakilibertinn@gmail.com") {
          setIsOwner(false);
        } else {
          const tSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", cleanEmail)));
          if (!tSnap.empty && tSnap.docs[0].data().role === "owner") {
            setIsOwner(true);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => { 
    loadStudents();
    loadTeachers();
  }, [selectedClass, tab]);

  const loadStudents = async () => {
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) { console.error(e); }
  };

  const loadTeachers = async () => {
    try {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) { console.error(e); }
  };

  const handleClassCheckbox = (cls: string) => {
    if (selectedClassesTaught.includes(cls)) {
      setSelectedClassesTaught(selectedClassesTaught.filter(c => c !== cls));
    } else {
      setSelectedClassesTaught([...selectedClassesTaught, cls]);
    }
  };

  const handleLessonCheckbox = (sub: string) => {
    if (selectedLessonsTaught.includes(sub)) {
      setSelectedLessonsTaught(selectedLessonsTaught.filter(s => s !== sub));
    } else {
      setSelectedLessonsTaught([...selectedLessonsTaught, sub]);
    }
  };

  const saveStudentsBulk = async () => {
    if (isOwner) return alert("❌ Access Denied: School Owner cannot change rosters.");
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
      setBulkNames(""); await loadStudents();
      alert("✅ Student roster updated successfully!");
    } catch (err: any) { alert("Error: " + err.message); }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (isOwner) return alert("❌ Access Denied: School Owner cannot change configurations.");
    if (!tEmail || !tName) return alert("Please fill in all name and email fields!");
    setIsSaving(true);
    try {
      const emailKey = tEmail.trim().toLowerCase();
      
      // Build allocation array matching your backend framework
      const builtAllocations: {class: string, subject: string}[] = [];
      if (tRole !== "owner") {
        selectedClassesTaught.forEach(c => {
          selectedLessonsTaught.forEach(s => {
            builtAllocations.push({ class: c, subject: s });
          });
        });
      }

      await setDoc(doc(db, "teachers", emailKey), { 
        email: emailKey, 
        name: tName.trim().toUpperCase(),
        role: tRole,
        classTeacherOf: tRole === "owner" ? "None" : classTeacherOf, 
        allocations: builtAllocations,
        classes: tRole === "owner" ? [] : selectedClassesTaught,
        subjects: tRole === "owner" ? [] : selectedLessonsTaught,
        isAdmin: emailKey === "mupenziakilibertinn@gmail.com"
      });

      setTEmail(""); setTName(""); setSelectedClassesTaught([]); setSelectedLessonsTaught([]); setClassTeacherOf("None"); setTRole("teacher");
      await loadTeachers(); alert("✅ Account Profile Synced successfully inside system!");
    } catch (err: any) { alert("Failed: " + err.message); }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-xs text-gray-800 pb-12">
      {/* Top Navbar Matching Your Exact Style (Image 222.png) */}
      <div className="bg-[#1E3A8A] text-white px-8 py-5 flex justify-between items-center shadow no-print">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider italic">NGS ADMIN PORTAL</h1>
          <p className="text-[10px] text-green-400 font-bold mt-0.5 flex items-center gap-1">
            CLOUD SYNC: CONNECTED <span className="bg-white text-green-700 px-1 rounded text-[8px]">✓</span>
            {isOwner && " | 👑 VIEWING MODE: SCHOOL OWNER (READ ONLY)"}
          </p>
        </div>
        <div className="flex gap-2">
          {["students", "teachers", "reports"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all ${tab === t ? "bg-white text-[#1E3A8A] shadow-md" : "bg-[#172554] text-gray-200 hover:bg-[#1a2e6b]"}`}>
              {t === "reports" ? "Report Cards" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "students" && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex gap-3 items-center">
              <span className="font-black uppercase text-sm text-gray-700 tracking-wider">TARGET CLASS STREAM:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-[3px] border-[#1E3A8A] rounded-xl font-black bg-white text-[#1E3A8A] text-sm px-4">
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm">
                <h3 className="font-black text-sm text-[#1E3A8A] mb-1 uppercase tracking-wide">BULK ENROLL STUDENTS</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">PASTE YOUR WHOLE LIST BELOW (ONE NAME PER LINE)</p>
                <textarea disabled={isOwner} value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full border-2 border-black rounded-2xl p-4 h-56 mb-4 font-black uppercase text-xs bg-[#F8FAFC] focus:border-[#1E3A8A] outline-none" placeholder="MUPENZI AKILI BERTIN..." />
                {!isOwner && <button onClick={saveStudentsBulk} className="w-full bg-[#1E3A8A] text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs hover:bg-black transition-colors">Save List Matrix</button>}
              </div>
              <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm max-h-[420px] overflow-y-auto">
                <h3 className="font-black text-sm text-[#1E3A8A] border-b pb-2 mb-3 uppercase tracking-wide">VERIFIED ENROLLED ROSTER ({students.length})</h3>
                {students.map(s => (
                  <div key={s.id} className="flex justify-between items-center py-2.5 border-b font-black uppercase text-xs text-gray-700 tracking-wide">
                    <span>{s.name}</span>
                    {!isOwner && <button onClick={async () => { if(confirm(`Remove ${s.name}?`)) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-600 font-black hover:underline text-[10px]">DELETE</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Input Assignment Panel (Matches layout of noo.png) */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm">
              <h3 className="font-black text-sm text-[#1E3A8A] mb-4 uppercase tracking-wide">CLASSROOM ASSIGNMENT PANEL</h3>
              <div className="space-y-4 mb-4 font-bold">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Select System Assignment Role</label>
                  <select disabled={isOwner} value={tRole} onChange={(e) => setTRole(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 bg-white text-xs font-black uppercase">
                    <option value="teacher">Standard Teacher / Class Master</option>
                    <option value="owner">School Owner (Grants Read-Only View System)</option>
                  </select>
                </div>
                <div>
                  <input disabled={isOwner} type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Teacher Full Name (e.g., Tr. MUPENZI)" className="w-full border-2 border-black rounded-xl p-3.5 text-xs font-black uppercase placeholder-gray-400" />
                </div>
                <div>
                  <input disabled={isOwner} type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} placeholder="Teacher Email Address" className="w-full border-2 border-black rounded-xl p-3.5 text-xs font-black placeholder-gray-400" />
                </div>
                
                {tRole === "teacher" && (
                  <div>
                    <label className="block text-[9px] font-black uppercase text-[#1E3A8A] mb-1">DESIGNATED MAIN CLASS TEACHER OF:</label>
                    <select disabled={isOwner} value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 bg-white font-black text-xs">
                      <option value="None">Not a Main Class Teacher</option>
                      {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Checkbox Groups Matching Exact Design Panel from noo.png */}
              {tRole === "teacher" && (
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="border-2 border-gray-300 p-4 rounded-2xl bg-white">
                    <span className="block text-[10px] font-black uppercase text-[#1E3A8A] border-b pb-1.5 mb-2">CLASSES TAUGHT</span>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableClasses.map(c => (
                        <label key={c} className="flex items-center gap-3 font-black text-xs text-gray-700 uppercase cursor-pointer">
                          <input type="checkbox" disabled={isOwner} checked={selectedClassesTaught.includes(c)} onChange={() => handleClassCheckbox(c)} className="w-4 h-4 border-2 border-black rounded accent-[#1E3A8A]" />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border-2 border-gray-300 p-4 rounded-2xl bg-white">
                    <span className="block text-[10px] font-black uppercase text-[#1E3A8A] border-b pb-1.5 mb-2">LESSONS TAUGHT</span>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableSubjects.map(s => (
                        <label key={s} className="flex items-center gap-3 font-black text-xs text-gray-700 uppercase cursor-pointer">
                          <input type="checkbox" disabled={isOwner} checked={selectedLessonsTaught.includes(s)} onChange={() => handleLessonCheckbox(s)} className="w-4 h-4 border-2 border-black rounded accent-[#1E3A8A]" />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tRole === "owner" && (
                <div className="p-4 bg-green-50 border-2 border-dashed border-green-600 rounded-xl text-green-800 font-bold text-[11px] uppercase mb-4">
                  💡 Notice: Registering this email as a School Owner automatically overrides subject lists and logs them in with password: <code className="bg-white p-1 rounded font-black text-xs text-black border">Newgeneration</code>
                </div>
              )}

              {!isOwner && <button onClick={saveTeacher} className="w-full bg-[#1E3A8A] text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs hover:bg-black transition-all">Sync Core Personnel Record</button>}
            </div>

            {/* Right Column: Registered Faculty Members Database */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm h-[560px] overflow-y-auto">
              <h3 className="font-black text-sm text-[#1E3A8A] border-b pb-2 mb-3 uppercase tracking-wide">REGISTERED FACULTY DATABASE ({teachersList.length})</h3>
              {teachersList.map((teacher) => (
                <div key={teacher.id} className="p-3.5 border-2 border-gray-200 rounded-xl mb-3 flex justify-between items-center bg-[#F8FAFC] font-black text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-blue-950 text-xs uppercase">{teacher.name}</span>
                      {teacher.isAdmin && <span className="bg-red-600 text-white text-[8px] px-2 py-0.5 rounded-md uppercase">Admin</span>}
                      {teacher.role === "owner" && <span className="bg-green-700 text-white text-[8px] px-2 py-0.5 rounded-md uppercase">Owner</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 lowercase font-normal">
                      {teacher.email} <span className="font-bold uppercase text-gray-500">{teacher.role !== "owner" && `| Master of: ${teacher.classTeacherOf || "None"}`}</span>
                    </p>
                    {teacher.role !== "owner" && teacher.classes?.length > 0 && (
                      <p className="text-[9px] text-blue-900 mt-1 uppercase tracking-wide">
                        Scope: [{teacher.classes.join(", ")}] → [{teacher.subjects.join(", ")}]
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={isOwner} onClick={() => { setTEmail(teacher.email); setTName(teacher.name); setTRole(teacher.role || "teacher"); setClassTeacherOf(teacher.classTeacherOf || "None"); setSelectedClassesTaught(teacher.classes || []); setSelectedLessonsTaught(teacher.subjects || []); }} className="bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] px-3 py-1 rounded-lg font-black text-[9px] uppercase hover:bg-blue-50">LOAD</button>
                    {!isOwner && !teacher.isAdmin && <button onClick={async () => { if (confirm("Remove user account file permanently?")) { await deleteDoc(doc(db, "teachers", teacher.id)); loadTeachers(); } }} className="text-red-600 font-black text-[9px] uppercase hover:underline">DELETE</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "reports" && <ReportsPage />}
      </div>
    </div>
  );
}