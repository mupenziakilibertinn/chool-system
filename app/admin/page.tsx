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
  const [allocations, setAllocations] = useState<{ class: string; subject: string }[]>([]);
  const [currentAllocClass, setCurrentAllocClass] = useState("P1");
  const [currentAllocSubject, setCurrentAllocSubject] = useState("Mathematics");
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

  const addAllocation = () => {
    if (isOwner) return alert("❌ Read-only permission node: School Owner cannot modify parameters.");
    if (tRole === "owner") return alert("❌ Informational: School Owners do not receive subject coursework slots.");
    const exists = allocations.some(a => a.class === currentAllocClass && a.subject === currentAllocSubject);
    if (!exists) setAllocations([...allocations, { class: currentAllocClass, subject: currentAllocSubject }]);
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
      alert("✅ Student roster updated!");
    } catch (err: any) { alert("Error: " + err.message); }
    setIsSaving(false);
  };

  const saveTeacher = async () => {
    if (isOwner) return alert("❌ Access Denied: School Owner cannot change system configurations.");
    if (!tEmail || !tName) return alert("Please fill fields!");
    setIsSaving(true);
    try {
      const emailKey = tEmail.trim().toLowerCase();
      await setDoc(doc(db, "teachers", emailKey), { 
        email: emailKey, 
        name: tName.trim().toUpperCase(),
        role: tRole,
        classTeacherOf: tRole === "owner" ? "None" : classTeacherOf, 
        allocations: tRole === "owner" ? [] : allocations,
        classes: tRole === "owner" ? [] : Array.from(new Set(allocations.map(a => a.class))),
        subjects: tRole === "owner" ? [] : Array.from(new Set(allocations.map(a => a.subject))),
        isAdmin: emailKey === "mupenziakilibertinn@gmail.com"
      });
      setTEmail(""); setTName(""); setAllocations([]); setClassTeacherOf("None"); setTRole("teacher");
      await loadTeachers(); alert("✅ Profile Saved successfully inside data engine!");
    } catch (err: any) { alert("Failed: " + err.message); }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-xs text-gray-800 pb-12">
      <div className="bg-[#1E3A8A] text-white px-6 py-4 flex justify-between items-center shadow no-print">
        <div>
          <h1 className="text-base font-black uppercase tracking-wider italic">NGS ADMIN CONTROL CENTER</h1>
          <p className="text-[10px] text-green-400 font-bold mt-0.5">{isOwner ? "👑 VIEWING MODE: SCHOOL OWNER (READ ONLY)" : "⚙️ ROLE: MASTER ADMINISTRATOR"}</p>
        </div>
        <div className="flex gap-2">
          {["students", "teachers", "reports"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all ${tab === t ? "bg-white text-[#1E3A8A] shadow" : "bg-[#172554] text-gray-200 hover:bg-[#1e293b]"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "students" && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-4 flex gap-2 items-center"><span className="font-black uppercase text-gray-500">Target Class:</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-[#1E3A8A] rounded-xl font-black bg-white text-[#1E3A8A]">
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-black text-[#1E3A8A] mb-3 uppercase">Bulk Enroll</h3>
                <textarea disabled={isOwner} value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 h-48 mb-4 font-bold uppercase text-xs bg-[#F8FAFC]" placeholder="Paste Student Names..." />
                {!isOwner && <button onClick={saveStudentsBulk} className="w-full bg-[#1E3A8A] text-white py-3 rounded-xl font-black uppercase hover:bg-black">Save List</button>}
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm max-h-[350px] overflow-y-auto">
                <h3 className="font-black text-[#1E3A8A] border-b pb-2 mb-3">Pupils Enrolled ({students.length})</h3>
                {students.map(s => (
                  <div key={s.id} className="flex justify-between items-center py-2 border-b font-bold uppercase text-gray-700">
                    <span>{s.name}</span>
                    {!isOwner && <button onClick={async () => { if(confirm("Remove?")) { await deleteDoc(doc(db, "students", s.id)); loadStudents(); } }} className="text-red-500 font-black">DELETE</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-black text-[#1E3A8A] mb-4 border-b pb-2 uppercase">Faculty & Personnel Editor</h3>
              <div className="space-y-3 mb-4 font-bold">
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Personnel System Role</label>
                  <select disabled={isOwner} value={tRole} onChange={(e) => setTRole(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 bg-white text-xs font-black uppercase">
                    <option value="teacher">Standard Teacher / Class Master</option>
                    <option value="owner">School Owner (Read Only Viewer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Full Name</label>
                  <input disabled={isOwner} type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. TR. MUPENZI" className="w-full border-2 border-black rounded-xl p-3 text-xs uppercase" />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Account Email Address</label>
                  <input disabled={isOwner} type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} placeholder="email@gmail.com" className="w-full border-2 border-black rounded-xl p-3 text-xs" />
                </div>
                
                {tRole === "teacher" && (
                  <div>
                    <label className="block text-[9px] uppercase text-gray-400 mb-1">Main Class Teacher Assignment</label>
                    <select disabled={isOwner} value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className="w-full border-2 border-black rounded-xl p-3 bg-white text-xs">
                      <option value="None">Not a Main Class Teacher</option>
                      {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {tRole === "teacher" && (
                <div className="border-2 border-dashed border-[#1E3A8A] p-4 rounded-xl bg-[#F8FAFC] mb-4">
                  <span className="block text-[9px] font-black uppercase text-[#1E3A8A] mb-2">Assign Lesson Classes & Coursework</span>
                  <div className="flex gap-2 mb-3">
                    <select disabled={isOwner} value={currentAllocClass} onChange={(e) => setCurrentAllocClass(e.target.value)} className="p-2 border rounded font-bold w-1/3 text-xs">
                      {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select disabled={isOwner} value={currentAllocSubject} onChange={(e) => setCurrentAllocSubject(e.target.value)} className="p-2 border rounded font-bold w-2/3 text-xs">
                      {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button disabled={isOwner} type="button" onClick={addAllocation} className="bg-[#1E3A8A] text-white px-4 rounded font-black text-xs">ADD</button>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto bg-white p-2 border rounded">
                    {allocations.map((alloc, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] uppercase font-black">
                        <span>{alloc.class} → {alloc.subject}</span>
                        {!isOwner && <button type="button" onClick={() => setAllocations(allocations.filter((_, i) => i !== idx))} className="text-red-600">Remove</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isOwner && <button onClick={saveTeacher} className="w-full bg-[#1E3A8A] text-white py-3 rounded-xl font-black uppercase tracking-wider text-xs">Sync Profile Core</button>}
            </div>
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border shadow-sm h-[520px] overflow-y-auto">
              <h3 className="font-black text-[#1E3A8A] border-b pb-2 mb-3 uppercase">Registered Faculty Database ({teachersList.length})</h3>
              {teachersList.map((teacher) => (
                <div key={teacher.id} className="p-3 border rounded-xl mb-2 flex justify-between items-center bg-[#F8FAFC] font-bold text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-blue-950 uppercase">{teacher.name}</span>
                      {teacher.isAdmin && <span className="bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Admin</span>}
                      {teacher.role === "owner" && <span className="bg-green-700 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Owner</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {teacher.email} {teacher.role !== "owner" && `| Master of: ${teacher.classTeacherOf || "None"}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={isOwner} onClick={() => { setTEmail(teacher.email); setTName(teacher.name); setTRole(teacher.role || "teacher"); setClassTeacherOf(teacher.classTeacherOf || "None"); setAllocations(teacher.allocations || []); }} className="bg-white border border-[#1E3A8A] text-[#1E3A8A] px-3 py-1 rounded font-black text-[9px] uppercase">LOAD</button>
                    {!isOwner && !teacher.isAdmin && <button onClick={async () => { if (confirm("Remove user account file?")) { await deleteDoc(doc(db, "teachers", teacher.id)); loadTeachers(); } }} className="text-red-600 font-black text-[9px] uppercase">DELETE</button>}
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