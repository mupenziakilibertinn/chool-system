"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";

const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

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
  const [allocationForm, setAllocationForm] = useState({ teacherId: "", class: "P1", subject: "Mathematics" });
  const [formFeedback, setFormFeedback] = useState("");
  
  // Inline Operational Modification (Editing) States
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentClass, setEditStudentClass] = useState("P1");
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherEmail, setEditTeacherEmail] = useState("");
  const [editTeacherPassword, setEditTeacherPassword] = useState("");
  const [editTeacherClassMaster, setEditTeacherClassMaster] = useState("");
  
  // Printing Selector Filters
  const [printFilterClass, setPrintFilterClass] = useState("P1");

  useEffect(() => {
    if (isAuthenticated) {
      loadSystemRecords();
    }
  }, [isAuthenticated]);

  // DEEP PASSCODE NETWORK MATRIX SCANNER
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = adminPassword.trim();
    
    // 1. Master Administration Passwords
    if (cleanPassword === "AdminNG2026" || cleanPassword === "ngschoolowner") {
      setAssignedClassMaster(null);
      setLoggedInUserTitle("Master Administrator");
      setIsAuthenticated(true);
      setAuthError("");
      setActiveTab("overview");
      return;
    }
    
    // 2. Scan Faculty Collection Records
    try {
      setAuthError("Verifying credentials...");
      const tSnap = await getDocs(collection(db, "teachers"));
      let matchingTeacher: any = null;
      
      tSnap.forEach((teacherDoc) => {
        const data = teacherDoc.data();
        // Match user text directly against the actual database field value
        if (data.password && String(data.password).trim() === cleanPassword) {
          matchingTeacher = { id: teacherDoc.id, ...data };
        }
      });

      if (matchingTeacher) {
        let lockedClass = "P4"; // Secure fallback value
        // Flexibly read from classTeacherOf or the classes array fields
        if (matchingTeacher.classTeacherOf) {
          lockedClass = String(matchingTeacher.classTeacherOf).trim();
        } else if (matchingTeacher.classes && Array.isArray(matchingTeacher.classes) && matchingTeacher.classes.length > 0) {
          lockedClass = String(matchingTeacher.classes[0]).trim();
        } else if (matchingTeacher.id.toLowerCase().includes("didier")) {
          lockedClass = "P4";
        }
        
        setAssignedClassMaster(lockedClass);
        setPrintFilterClass(lockedClass);
        setLoggedInUserTitle(`Tr. ${matchingTeacher.name || "INSTRUCTOR"} (${lockedClass} Master)`);
        setIsAuthenticated(true);
        setAuthError("");
        setActiveTab("printEngine"); // Send teachers straight to the printing engine
      } else {
        setAuthError("INVALID IDENTITY PASSCODE KEY");
      }
    } catch (err) {
      setAuthError("Security verification node timeout.");
    }
  };

  const loadSystemRecords = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(collection(db, "students"));
      setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const tSnap = await getDocs(collection(db, "teachers"));
      setTeachers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Database pull failure:", err);
    }
    setLoading(false);
  };

  // --- STUDENT CRUD ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;
    try {
      setFormFeedback("Enrolling student...");
      await addDoc(collection(db, "students"), {
        name: studentForm.name.trim(),
        class: studentForm.class,
        registeredAt: new Date().toISOString()
      });
      setStudentForm({ name: "", class: "P1" });
      setFormFeedback("Student enrolled successfully!");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Failed to add student.");
    }
  };

  const startEditStudent = (student: any) => {
    setEditingStudentId(student.id);
    setEditStudentName(student.name);
    setEditStudentClass(student.class);
  };

  const handleUpdateStudent = async (id: string) => {
    if (!editStudentName.trim()) return;
    try {
      setFormFeedback("Updating student name/class details...");
      await updateDoc(doc(db, "students", id), {
        name: editStudentName.trim(),
        class: editStudentClass
      });
      setEditingStudentId(null);
      setFormFeedback("Student record corrected successfully.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error modifying student record.");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you absolutely certain you want to purge this student from database?")) return;
    try {
      setFormFeedback("Removing student permanently...");
      await deleteDoc(doc(db, "students", id));
      setFormFeedback("Student record completely removed.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error erasing student.");
    }
  };

  // --- TEACHER CRUD & ALLOCATION ---
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim() || !teacherForm.email.trim()) return;
    try {
      setFormFeedback("Provisioning instructor credentials...");
      await addDoc(collection(db, "teachers"), {
        name: teacherForm.name.trim(),
        email: teacherForm.email.trim().toLowerCase(),
        password: teacherForm.password || "NewGen123",
        classTeacherOf: teacherForm.classTeacherOf || null,
        allocations: [],
        role: "teacher"
      });
      setTeacherForm({ name: "", email: "", password: "", classTeacherOf: "" });
      setFormFeedback("Faculty security node created successfully!");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error creating faculty node.");
    }
  };

  const startEditTeacher = (teacher: any) => {
    setEditingTeacherId(teacher.id);
    setEditTeacherName(teacher.name || "");
    setEditTeacherEmail(teacher.email || teacher.id);
    setEditTeacherPassword(teacher.password || "");
    setEditTeacherClassMaster(teacher.classTeacherOf || "");
  };

  const handleUpdateTeacher = async (id: string) => {
    try {
      setFormFeedback("Updating faculty information matrix...");
      await updateDoc(doc(db, "teachers", id), {
        name: editTeacherName.trim(),
        password: editTeacherPassword,
        classTeacherOf: editTeacherClassMaster || null
      });
      setEditingTeacherId(null);
      setFormFeedback("Faculty changes written to core registry.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error modifying faculty details.");
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Warning! Deleting this teacher account removes their grading access privileges. Proceed?")) return;
    try {
      setFormFeedback("De-allocating and deleting teacher...");
      await deleteDoc(doc(db, "teachers", id));
      setFormFeedback("Teacher profile deleted.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error purging teacher asset.");
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationForm.teacherId) return;
    try {
      setFormFeedback("Appending lesson mapping allocation...");
      const teacherRef = doc(db, "teachers", allocationForm.teacherId);
      await updateDoc(teacherRef, {
        allocations: arrayUnion({
          class: allocationForm.class,
          subject: allocationForm.subject
        })
      });
      setFormFeedback("New subject blueprint assigned to instructor.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Allocation indexing fault.");
    }
  };

  const handleClearAllocations = async (id: string) => {
    if (!confirm("Reset all class subject allocations for this teacher?")) return;
    try {
      setFormFeedback("Wiping lesson allocations...");
      await updateDoc(doc(db, "teachers", id), { allocations: [] });
      setFormFeedback("Allocations cleared successfully.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error reset mapping processing.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-800 border-2 border-slate-700 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-3xl"> 🔒 </span>
            <h1 className="text-xl font-black text-white uppercase tracking-wider mt-3">Administrative Entry Guard</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">New Generation School Management System</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Enter Access Password / Teacher Key Pin</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-center focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            {authError && <p className="text-center text-rose-500 text-[10px] font-black uppercase tracking-wide">{authError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-md">
              Verify Credentials & Pass Entry
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeFilteringClass = assignedClassMaster ? assignedClassMaster : printFilterClass;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Master Administrative Terminal</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Active Node: {loggedInUserTitle}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-4 py-2.5 rounded-xl transition-colors cursor-pointer inline-block">
                &larr; Return to Portal Entry
              </span>
            </Link>
            {assignedClassMaster !== "NONE" && (
              <Link href="/admin/registre">
                <span className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer inline-block">
                  📋  Open Registre Nominatif Sheets
                </span>
              </Link>
            )}
            {assignedClassMaster === null && (
              <Link href="/admin/analytics">
                <span className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer inline-block">
                  📊  Open Live Analytics Dashboard
                </span>
              </Link>
            )}
            <button onClick={() => { setIsAuthenticated(false); setAssignedClassMaster(null); }} className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2.5 rounded-xl transition-colors">
              Lock Session  🔒
            </button>
          </div>
        </div>
      </header>

      {formFeedback && (
        <div className="bg-slate-900 text-slate-100 font-mono text-center py-2 text-[10px] font-black uppercase tracking-widest animate-pulse">
          ⚡  System Node Notice: {formFeedback}
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-wrap border-b-2 border-slate-200 gap-1">
          {assignedClassMaster === null && (
            <>
              <button onClick={() => setActiveTab("overview")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "overview" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                Metrics Overview
              </button>
              <button onClick={() => setActiveTab("students")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "students" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                Students Directory & Editing ({students.length})
              </button>
              <button onClick={() => setActiveTab("teachers")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "teachers" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                Faculty Profiles & Roles ({teachers.length})
              </button>
            </>
          )}
          <button onClick={() => setActiveTab("printEngine")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "printEngine" || assignedClassMaster !== null ? "border-slate-900 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            🖨️  Report Card Generation Hub
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && assignedClassMaster === null && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Enrollment</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">{students.length} Learners</span>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Authorized Staff Profiles</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">{teachers.length} Instructors</span>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Standard Class Streams</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono">{availableClasses.length} Streams</span>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENTS */}
        {activeTab === "students" && assignedClassMaster === null && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Enroll New Learner</h3>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Full Student Name</label>
                  <input type="text" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Stream Placement</label>
                  <select value={studentForm.class} onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black">
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl">Commit Registry Entry</button>
              </form>
            </div>
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-y-auto max-h-[550px] divide-y divide-slate-100">
                {students.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name)).map((st) => (
                  <div key={st.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {editingStudentId === st.id ? (
                      <div className="flex-1 flex gap-2 items-center">
                        <input type="text" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="bg-white border-2 border-blue-500 rounded-xl px-3 py-1.5 text-sm font-bold uppercase" />
                        <select value={editStudentClass} onChange={(e) => setEditStudentClass(e.target.value)} className="bg-white border rounded-xl px-2 py-1.5 text-sm font-black">
                          {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => handleUpdateStudent(st.id)} className="bg-emerald-600 text-white text-[9px] font-black px-3 py-2 rounded-xl">Save</button>
                        <button onClick={() => setEditingStudentId(null)} className="bg-slate-200 text-[9px] font-black px-3 py-2 rounded-xl">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-200 text-slate-800 text-[10px] font-black px-2 py-1 rounded-md">{st.class}</span>
                        <span className="font-black text-sm uppercase">{st.name}</span>
                      </div>
                    )}
                    {editingStudentId !== st.id && (
                      <div className="flex gap-2">
                        <button onClick={() => startEditStudent(st)} className="text-[10px] font-black border px-3 py-1.5 rounded-lg text-slate-600">Edit</button>
                        <button onClick={() => handleDeleteStudent(st.id)} className="text-[10px] font-black border border-rose-200 text-rose-600">Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FACULTY MANAGING */}
        {activeTab === "teachers" && assignedClassMaster === null && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Provision Faculty Profile</h3>
                <form onSubmit={handleAddTeacher} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} placeholder="Teacher Full Name" className="w-full bg-slate-50 border p-2 text-sm rounded-xl uppercase" />
                    <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="Email ID" className="w-full bg-slate-50 border p-2 text-sm rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="Passcode Key Pin" className="w-full bg-slate-50 border p-2 text-sm rounded-xl font-mono" />
                    <select value={teacherForm.classTeacherOf} onChange={(e) => setTeacherForm({ ...teacherForm, classTeacherOf: e.target.value })} className="w-full bg-slate-50 border p-2 text-sm rounded-xl font-black">
                      <option value="">None / Floating Instructor</option>
                      {availableClasses.map(c => <option key={c} value={c}>Class Master of {c}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white text-[10px] font-black uppercase py-3 rounded-xl">Register Faculty Profile</button>
                </form>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Map Subject Lesson Allocation</h3>
                <form onSubmit={handleAddAllocation} className="space-y-4">
                  <select value={allocationForm.teacherId} onChange={(e) => setAllocationForm({ ...allocationForm, teacherId: e.target.value })} className="w-full bg-slate-50 border p-2 text-sm font-black rounded-xl">
                    <option value="">-- Choose Instructor Document --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={allocationForm.class} onChange={(e) => setAllocationForm({ ...allocationForm, class: e.target.value })} className="bg-slate-50 border p-2 text-sm font-black rounded-xl">
                      {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={allocationForm.subject} onChange={(e) => setAllocationForm({ ...allocationForm, subject: e.target.value })} className="bg-slate-50 border p-2 text-sm font-black rounded-xl">
                      {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white text-[10px] font-black uppercase py-3 rounded-xl">Bind Subject Mapping Allocation</button>
                </form>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-wider border-b bg-slate-50 h-10">
                    <th className="p-4">Teacher Document (ID)</th>
                    <th className="p-4">Class Master Assignment</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        {editingTeacherId === t.id ? (
                          <div className="flex flex-col gap-1 p-1 bg-slate-50 border rounded-xl">
                            <input type="text" value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} placeholder="Display Name" className="border p-1 text-xs uppercase" />
                            <input type="text" value={editTeacherPassword} onChange={(e) => setEditTeacherPassword(e.target.value)} placeholder="Password Key" className="border p-1 text-xs font-mono" />
                            <button onClick={() => handleUpdateTeacher(t.id)} className="bg-emerald-600 text-white px-2 py-0.5 text-[9px] rounded">Save</button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-black text-slate-900">{t.id}</div>
                            <div className="text-[10px] text-slate-400">Name: <span className="uppercase text-slate-700 font-bold">{t.name || "Not Configured"}</span> | Passcode Key: <span className="text-blue-600 font-mono font-bold">{t.password || "123456"}</span></div>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {t.classTeacherOf ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">{t.classTeacherOf} MASTER</span>
                        ) : t.classes && Array.isArray(t.classes) && t.classes.length > 0 ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">{t.classes.join(", ")} MASTER</span>
                        ) : (
                          <span className="text-slate-300 text-[9px]">None</span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <button onClick={() => startEditTeacher(t)} className="text-[10px] font-black border px-2 py-1 rounded">Edit</button>
                        <button onClick={() => handleClearAllocations(t.id)} className="text-[10px] font-black border text-amber-600 px-2 py-1 rounded">Reset Maps</button>
                        <button onClick={() => handleDeleteTeacher(t.id)} className="text-[10px] font-black border text-rose-600 px-2 py-1 rounded">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PRINT ENGINE HUB */}
        {(activeTab === "printEngine" || assignedClassMaster !== null) && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-black text-slate-900 uppercase text-sm tracking-wide">Report Generator Workspace Matrix</h3>
              {assignedClassMaster === null && (
                <select value={printFilterClass} onChange={(e) => setPrintFilterClass(e.target.value)} className="bg-slate-50 border p-2 text-xs font-black rounded-xl">
                  {availableClasses.map(c => <option key={c} value={c}>Roster Filter: Stream {c}</option>)}
                </select>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {students.filter(s => s.class === activeFilteringClass).length === 0 ? (
                <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider">No student index entries discovered contextually linked to Stream {activeFilteringClass}</p>
              ) : (
                students.filter(s => s.class === activeFilteringClass).map((st) => (
                  <div key={st.id} className="p-4 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                    <span className="font-black uppercase text-sm text-slate-900 tracking-wide">{st.name}</span>
                    
                    {/* FIXED LINK INTERPOLATION ROUTING LINE */}
                    <Link href={`/reports?studentId=${st.id}&class=${activeFilteringClass}`} target="_blank">
                      <span className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase px-4 py-2 rounded-xl tracking-wider cursor-pointer">
                        Preview & Print Report Card 🖨️
                      </span>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}