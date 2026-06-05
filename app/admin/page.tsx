"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, arrayUnion, setDoc } from "firebase/firestore";

// KEEPING NATURE: Clean variables matching your book schema exactly
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French", "Sports", "Creative Arts"];

export default function UltimateAdminTerminal() {
  // Authentication Guard States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  
  // Teacher Accountability Tracking State
  const [assignedClassMaster, setAssignedClassMaster] = useState<string | null>(null);
  const [loggedInUserTitle, setLoggedInUserTitle] = useState("System Administrator");
  
  // Data Pipeline Matrix States
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "teachers" | "printEngine">("overview");
  
  // Creation Form Binder States
  const [studentForm, setStudentForm] = useState({ name: "", class: "P1" });
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", password: "", classTeacherOf: "" });
  
  // UI Selection Filters
  const [activeFilteringClass, setActiveFilteringClass] = useState("P1");
  const [selectedAllocationTeacherId, setSelectedAllocationTeacherId] = useState("");
  const [allocationClass, setAllocationClass] = useState("P1");
  const [allocationSubject, setAllocationSubject] = useState("Mathematics");

  // EXTENSION: Profile Editor Modal state matching natural style sheet rules
  const [editingTeacher, setEditingTeacher] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      bootstrapAdminPipeline();
    }
  }, [isAuthenticated]);

  const handleAdminGateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "admin12345") {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("🚫 INVALID ADMINISTRATIVE AUTHENTICATION KEY PASSED.");
    }
  };

  const bootstrapAdminPipeline = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(collection(db, "students"));
      setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const tSnap = await getDocs(collection(db, "teachers"));
      setTeachers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;
    try {
      await addDoc(collection(db, "students"), {
        name: studentForm.name.trim().toUpperCase(),
        class: studentForm.class
      });
      setStudentForm({ name: "", class: "P1" });
      bootstrapAdminPipeline();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim() || !teacherForm.email.trim()) return;
    try {
      const teacherPayload: any = {
        name: teacherForm.name.trim().toUpperCase(),
        email: teacherForm.email.trim().toLowerCase(),
        password: teacherForm.password.trim(),
        allocations: []
      };
      if (teacherForm.classTeacherOf) {
        teacherPayload.classTeacherOf = teacherForm.classTeacherOf;
      }
      
      const customDocId = teacherForm.email.trim().toLowerCase();
      await setDoc(doc(db, "teachers", customDocId), teacherPayload);
      
      setTeacherForm({ name: "", email: "", password: "", classTeacherOf: "" });
      bootstrapAdminPipeline();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBindLessonAllocation = async () => {
    if (!selectedAllocationTeacherId) return;
    try {
      const docRef = doc(db, "teachers", selectedAllocationTeacherId);
      await updateDoc(docRef, {
        allocations: arrayUnion({
          class: allocationClass,
          subject: allocationSubject
        })
      });
      bootstrapAdminPipeline();
      alert("✅ LESSON ASSIGNMENT BOUND SUCCESSFULLY TO TARGET TEACHER INSTRUCTOR PROFILE.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setLoading(true);
    try {
      const docRef = doc(db, "teachers", editingTeacher.id);
      await setDoc(docRef, editingTeacher, { merge: true });
      setEditingTeacher(null);
      bootstrapAdminPipeline();
      alert("✅ TEACHER RECORD DETAILS MODIFIED SECURELY IN FIRESTORE.");
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleRemoveAllocation = async (teacherId: string, indexToRemove: number) => {
    if (!confirm("Are you sure you want to drop this allocation rule row?")) return;
    try {
      const targetTeacher = teachers.find(t => t.id === teacherId);
      const filteredAllocations = targetTeacher.allocations.filter((_: any, idx: number) => idx !== indexToRemove);
      await updateDoc(doc(db, "teachers", teacherId), { allocations: filteredAllocations });
      bootstrapAdminPipeline();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Wipe out student entry completely?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      bootstrapAdminPipeline();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("🚨 Proceeding will clear this instructor access token configuration permanently from database records.")) return;
    try {
      await deleteDoc(doc(db, "teachers", id));
      bootstrapAdminPipeline();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-xs">
        <form onSubmit={handleAdminGateLogin} className="bg-white p-6 border-2 border-black rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
          <div className="text-center border-b border-black pb-2">
            <span className="text-[9px] font-black tracking-widest text-blue-600 uppercase block">AUTHORIZED NODE ONLY</span>
            <h2 className="text-sm font-black uppercase text-slate-900 mt-0.5">NEW GENERATION SYSTEM ROOT</h2>
          </div>
          {authError && <p className="text-rose-600 font-black text-center uppercase tracking-wide bg-rose-50 border border-rose-200 p-2 rounded-lg">{authError}</p>}
          <div className="space-y-1">
            <label className="block text-[9px] font-black uppercase text-slate-400">Master Administrator Terminal Key</label>
            <input 
              type="password" 
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full border-2 border-slate-900 p-3 rounded-xl font-bold tracking-widest bg-slate-50 text-center outline-none focus:bg-white"
            />
          </div>
          <button type="submit" className="w-full bg-slate-950 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-[10px] hover:bg-slate-800 shadow">
            Establish Administrative Session 🔓
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-xs pb-32 text-slate-900">
      
      {/* FIXED HEADER MATRIX: Using safe window routing logic to avoid Link undefined error */}
      <div className="bg-white border-b border-slate-200 p-4 font-black shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="text-[9px] text-blue-600 uppercase tracking-widest">MASTER CONTROL NODE</div>
            <h1 className="text-sm uppercase tracking-wide">{loggedInUserTitle} — CENTRAL ENGINE</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => window.location.href = "/marks"} 
              className="bg-blue-900 text-white px-3 py-2 rounded-lg uppercase text-[9px] font-black tracking-wider hover:bg-blue-950 transition-all shadow"
            >
              Open Marks Entry Matrix 📖
            </button>
            <button onClick={() => { setIsAuthenticated(false); setAdminPassword(""); }} className="bg-rose-900 text-white px-3 py-2 rounded-lg uppercase text-[9px] font-black shadow">
              Terminate Session 🔒
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 mt-4 space-y-6">
        
        {/* TABS SELECTOR CONTAINER BAR */}
        <div className="flex bg-white p-1 border rounded-xl shadow-xs max-w-md font-black">
          {(["overview", "students", "teachers", "printEngine"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[9px] uppercase tracking-wider font-black transition-all ${activeTab === tab ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ======================================= TAB 1: OVERVIEW ======================================= */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* ALLOCATION MATRIX PANEL CARD */}
            <div className="bg-white p-5 border-2 rounded-2xl shadow-xs space-y-4 font-black">
              <div className="border-b pb-2">
                <h3 className="text-xs uppercase text-slate-900 font-black">MAP SUBJECT LESSON ALLOCATION</h3>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase">Assign target lesson responsibility tracks contextually</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Target Teacher Instructor Profile</label>
                  <select
                    value={selectedAllocationTeacherId}
                    onChange={(e) => setSelectedAllocationTeacherId(e.target.value)}
                    className="w-full border-2 p-2.5 bg-white rounded-xl uppercase text-xs font-black"
                  >
                    <option value="">-- Choose Instructor Document --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1">Class Level Stream</label>
                    <select value={allocationClass} onChange={(e) => setAllocationClass(e.target.value)} className="w-full border-2 p-2.5 bg-white rounded-xl uppercase text-xs font-black">
                      {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase mb-1">Subject Assignment Lesson</label>
                    <select value={allocationSubject} onChange={(e) => setAllocationSubject(e.target.value)} className="w-full border-2 p-2.5 bg-white rounded-xl uppercase text-xs font-black">
                      {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={handleBindLessonAllocation} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow pt-3.5 transition-all">
                  Bind Subject Mapping Allocation
                </button>
              </div>
            </div>

            {/* QUICK SNAPSHOT INSIGHTS METRICS PANEL */}
            <div className="bg-white p-5 border rounded-2xl shadow-xs space-y-4 font-black">
              <div className="border-b pb-2">
                <h3 className="text-xs uppercase text-slate-900 font-black">SYSTEM METRICS TELEMETRY</h3>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase">Realtime registry data counts discovery logs</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="text-[9px] text-slate-400 uppercase font-black">Total Students Stream</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{students.length}</div>
                </div>
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="text-[9px] text-slate-400 uppercase font-black">Active Instructors</div>
                  <div className="text-2xl font-black text-blue-900 mt-1">{teachers.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= TAB 2: STUDENTS ======================================= */}
        {activeTab === "students" && (
          <div className="space-y-6 animate-fade-in font-black">
            <div className="bg-white p-5 border-2 rounded-2xl shadow-xs space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-xs uppercase text-slate-900 font-black">ENROLL NEW STUDENT ACCOUNT ENTRY</h3>
              </div>
              <form onSubmit={handleCreateStudent} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Full Student Name Listing</label>
                  <input type="text" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="E.G., MUGISHA ERIC" className="w-full border-2 p-2.5 rounded-xl uppercase font-black text-xs" />
                </div>
                <div className="w-full sm:w-1/4">
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Target Class Allocation</label>
                  <select value={studentForm.class} onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })} className="w-full border-2 p-2.5 bg-white rounded-xl uppercase text-xs font-black">
                    {availableClasses.map(c => <option key={c} value={c}>Class Stream {c}</option>)}
                  </select>
                </div>
                <button type="submit" className="bg-slate-900 text-white uppercase text-[9px] px-6 py-3 rounded-xl font-black w-full sm:w-auto tracking-wider shadow">Register Entry</button>
              </form>
            </div>

            <div className="bg-white border rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
                <h3 className="text-xs uppercase text-slate-900 font-black">STUDENT REGISTER ENTRY MASTER DIRECTORY</h3>
                <select value={activeFilteringClass} onChange={(e) => setActiveFilteringClass(e.target.value)} className="p-2 border-2 rounded-xl bg-white text-[10px] font-black uppercase">
                  {availableClasses.map(c => <option key={c} value={c}>Roster Filter: Stream {c}</option>)}
                </select>
              </div>
              <div className="divide-y divide-slate-100">
                {students.filter(s => s.class === activeFilteringClass).length === 0 ? (
                  <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider">No student index entries discovered contextually linked to Stream {activeFilteringClass}</p>
                ) : (
                  students.filter(s => s.class === activeFilteringClass).map((st) => (
                    <div key={st.id} className="p-4 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                      <div>
                        <p className="font-black text-slate-900 uppercase text-xs tracking-wide">{st.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">MAPPED CLUSTER LEVEL: STREAM {st.class}</p>
                      </div>
                      <button onClick={() => handleDeleteStudent(st.id)} className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-[9px] uppercase font-black transition-all">Delete Entry 🗑️</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================= TAB 3: TEACHERS ======================================= */}
        {activeTab === "teachers" && (
          <div className="space-y-6 animate-fade-in font-black">
            <div className="bg-white p-5 border-2 rounded-2xl shadow-xs space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-xs uppercase text-slate-900 font-black">PROVISION NEW INSTRUCTOR PROFILE OBJECT</h3>
              </div>
              <form onSubmit={handleCreateTeacher} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Teacher Full Legal Identity</label>
                  <input type="text" value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} placeholder="E.G., BIZIMANA FELIX" className="w-full border-2 p-2.5 rounded-xl uppercase font-black text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">System Access Linked Email</label>
                  <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="felix@ngs.com" className="w-full border-2 p-2.5 rounded-xl lowercase font-bold text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Local Pass Token</label>
                  <input type="text" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="Create Password" className="w-full border-2 p-2.5 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Class Teacher Track Allocation</label>
                  <select value={teacherForm.classTeacherOf} onChange={(e) => setTeacherForm({ ...teacherForm, classTeacherOf: e.target.value })} className="w-full border-2 p-2.5 bg-white rounded-xl uppercase text-xs font-black">
                    <option value="">Not a Class Teacher</option>
                    {availableClasses.map(c => <option key={c} value={c}>Stream {c} Custodian</option>)}
                  </select>
                </div>
                <button type="submit" className="bg-slate-900 text-white uppercase text-[9px] py-3.5 rounded-xl font-black md:col-span-4 tracking-wider shadow mt-2">Provision Instructor Account</button>
              </form>
            </div>

            <div className="bg-white border rounded-2xl shadow-xs p-5 space-y-4">
              <h3 className="text-xs uppercase text-slate-900 font-black border-b pb-2">TEACHERS MASTER REGISTRY DIRECTORY</h3>
              <div className="divide-y divide-slate-200">
                {teachers.length === 0 ? (
                  <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase">No active accounts provisioned contextually</p>
                ) : (
                  teachers.map((t) => (
                    <div key={t.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/20 transition-colors px-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 uppercase text-xs tracking-wide">{t.name}</p>
                          {t.classTeacherOf && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                              CLASS TEACHER: {t.classTeacherOf}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono font-bold lowercase">{t.email} • KEY: <span className="text-rose-700 font-black">{t.password || "N/A"}</span></p>
                        
                        {/* LESSON ALLOCATION ROW DISPLAY CHIPS */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.allocations && t.allocations.length > 0 ? (
                            t.allocations.map((a: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-900 text-[9px] px-2 py-0.5 rounded font-black uppercase">
                                Stream {a.class} — {a.subject}
                                <button type="button" onClick={() => handleRemoveAllocation(t.id, idx)} className="text-red-500 hover:text-red-800 ml-1 text-[11px] font-black">×</button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-300 italic font-normal uppercase">No lesson allocations assigned to path maps</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1.5 w-full md:w-auto justify-end">
                        <button 
                          onClick={() => setEditingTeacher({ ...t })}
                          className="bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-[9px] uppercase font-black transition-all"
                        >
                          Modify Profile ✏️
                        </button>
                        <button onClick={() => handleDeleteTeacher(t.id)} className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-[9px] uppercase font-black transition-all">Delete Account 🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================= TAB 4: PRINT ENGINE ======================================= */}
        {activeTab === "printEngine" && (
          <div className="bg-white border p-6 rounded-2xl shadow-xs text-center font-black py-16 animate-fade-in">
            <span className="text-3xl">🖨️</span>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 mt-3">Bulk Report Sheet Card Rendering Engine Node</h3>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 uppercase">Ready to batch compile student evaluations from active storage clusters</p>
          </div>
        )}

      </div>

      {/* FLOATING QUICK EDIT MODAL OVERLAY */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-black">
          <div className="bg-white border-2 border-black rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-xs uppercase font-black text-slate-900">Modify Instructor Record Data</h3>
              <button onClick={() => setEditingTeacher(null)} className="text-slate-400 text-sm font-black hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleUpdateTeacherProfile} className="space-y-3">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Teacher Identity Name</label>
                <input type="text" required value={editingTeacher.name || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value.toUpperCase() })} className="w-full border-2 p-2 rounded-xl text-xs font-black uppercase" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Access Link Email Address</label>
                <input type="email" required value={editingTeacher.email || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value.trim().toLowerCase() })} className="w-full border-2 p-2 rounded-xl text-xs font-bold lowercase font-mono" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Local Authentication Password</label>
                <input type="text" required value={editingTeacher.password || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })} className="w-full border-2 p-2 rounded-xl text-xs font-bold font-mono" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Class Teacher Track Assignment</label>
                <select value={editingTeacher.classTeacherOf || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, classTeacherOf: e.target.value || null })} className="w-full border-2 p-2 bg-white rounded-xl text-xs font-black uppercase">
                  <option value="">Not a Class Teacher</option>
                  {availableClasses.map(c => <option key={c} value={c}>Stream {c}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2 text-[10px]">
                <button type="button" onClick={() => setEditingTeacher(null)} className="w-1/2 border-2 p-2.5 rounded-xl uppercase font-black">Discard Changes</button>
                <button type="submit" className="w-1/2 bg-slate-950 text-white p-2.5 rounded-xl uppercase font-black shadow">Save Profile Details 💾</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}