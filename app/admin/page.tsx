"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, arrayUnion, setDoc, getDoc } from "firebase/firestore";

const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = [
  "08:00 - 08:40",
  "08:40 - 09:20",
  "09:20 - 10:00",
  "10:00 - 10:20 (BREAK)",
  "10:20 - 11:00",
  "11:00 - 11:40",
  "11:40 - 12:20",
  "12:20 - 14:00 (LUNCH)",
  "14:00 - 14:40",
  "14:40 - 15:20",
  "15:20 - 16:00 (DEBATE/SPORTS)",
];

const availableRoles = [
  "Master Administrator",
  "Headmaster / Director",
  "Class Master",
  "Subject Teacher",
  "Discipline Master",
];

export default function UltimateAdminTerminal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [assignedClassMaster, setAssignedClassMaster] = useState<string | null>(null);
  const [loggedInUserTitle, setLoggedInUserTitle] = useState("System Administrator");

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "teachers" | "timetable" | "printEngine">("overview");

  const [studentForm, setStudentForm] = useState({ name: "", class: "P1" });
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", password: "", classTeacherOf: "", role: "Subject Teacher" });
  const [allocationForm, setAllocationForm] = useState({ teacherId: "", class: "P1", subject: "Mathematics" });
  const [formFeedback, setFormFeedback] = useState("");

  // Timetable State & Rule Engine
  const [timetableSubTab, setTimetableSubTab] = useState<"class" | "teacher" | "master" | "rules">("class");
  const [selectedTimetableClass, setSelectedTimetableClass] = useState("P1");
  const [selectedTimetableTeacher, setSelectedTimetableTeacher] = useState("");
  const [allClassTimetables, setAllClassTimetables] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [savingTimetable, setSavingTimetable] = useState(false);

  // Subject Frequency Rules (e.g., { "Mathematics": 5, "French": 2 })
  const [subjectFrequencyRules, setSubjectFrequencyRules] = useState<Record<string, number>>({
    Mathematics: 5,
    Kinyarwanda: 5,
    English: 5,
    SET: 3,
    SRE: 2,
    French: 2,
  });

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentClass, setEditStudentClass] = useState("P1");

  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherPassword, setEditTeacherPassword] = useState("");
  const [editTeacherRole, setEditTeacherRole] = useState("Subject Teacher");
  const [editTeacherClassMaster, setEditTeacherClassMaster] = useState("");

  const [printFilterClass, setPrintFilterClass] = useState("P1");

  useEffect(() => {
    if (isAuthenticated) {
      loadSystemRecords();
      fetchAllTimetables();
    }
  }, [isAuthenticated]);

  const fetchAllTimetables = async () => {
    try {
      const timetablesMap: Record<string, Record<string, Record<string, string>>> = {};
      for (const cls of availableClasses) {
        const docRef = doc(db, "timetables", cls);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          timetablesMap[cls] = docSnap.data().schedule || {};
        } else {
          timetablesMap[cls] = {};
        }
      }
      setAllClassTimetables(timetablesMap);
    } catch (err) {
      console.error("Error fetching all timetables:", err);
    }
  };

  const handleCellChange = (cls: string, day: string, slot: string, subject: string) => {
    setAllClassTimetables((prev) => ({
      ...prev,
      [cls]: {
        ...(prev[cls] || {}),
        [day]: {
          ...(prev[cls]?.[day] || {}),
          [slot]: subject,
        },
      },
    }));
  };

  const handleSaveClassTimetable = async (cls: string) => {
    setSavingTimetable(true);
    try {
      await setDoc(doc(db, "timetables", cls), {
        class: cls,
        schedule: allClassTimetables[cls] || {},
        subjectRules: subjectFrequencyRules,
        updatedAt: new Date().toISOString(),
      });
      setFormFeedback(`Timetable for Class ${cls} successfully saved!`);
    } catch (err) {
      setFormFeedback("Error saving timetable to database.");
    }
    setSavingTimetable(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = adminPassword.trim();

    if (cleanPassword === "AdminNG2026" || cleanPassword === "ngschoolowner") {
      setAssignedClassMaster(null);
      setLoggedInUserTitle("Master Administrator");
      setIsAuthenticated(true);
      setAuthError("");
      setActiveTab("overview");
      return;
    }

    try {
      setAuthError("Verifying credentials...");
      const tSnap = await getDocs(collection(db, "teachers"));
      let matchingTeacher: any = null;

      tSnap.forEach((teacherDoc) => {
        const data = teacherDoc.data();
        if (data.password && String(data.password).trim() === cleanPassword) {
          matchingTeacher = { id: teacherDoc.id, ...data };
        }
      });

      if (matchingTeacher) {
        let lockedClass = matchingTeacher.classTeacherOf || "P4";
        setAssignedClassMaster(lockedClass);
        setPrintFilterClass(lockedClass);
        setLoggedInUserTitle(`Tr. ${matchingTeacher.name || "INSTRUCTOR"} (${matchingTeacher.role || "Teacher"})`);
        setIsAuthenticated(true);
        setAuthError("");
        setActiveTab("printEngine");
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
      setStudents(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const tSnap = await getDocs(collection(db, "teachers"));
      const teacherDocs = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachers(teacherDocs);
      if (teacherDocs.length > 0 && !selectedTimetableTeacher) {
        setSelectedTimetableTeacher(teacherDocs[0].id);
      }
    } catch (err) {
      console.error("Database pull failure:", err);
    }
    setLoading(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;
    try {
      await addDoc(collection(db, "students"), {
        name: studentForm.name.trim(),
        class: studentForm.class,
        registeredAt: new Date().toISOString(),
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
    try {
      await updateDoc(doc(db, "students", id), {
        name: editStudentName.trim(),
        class: editStudentClass,
      });
      setEditingStudentId(null);
      setFormFeedback("Student record updated.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error updating student.");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Delete student?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error erasing student.");
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim() || !teacherForm.email.trim()) return;
    try {
      await addDoc(collection(db, "teachers"), {
        name: teacherForm.name.trim(),
        email: teacherForm.email.trim().toLowerCase(),
        password: teacherForm.password || "NewGen123",
        role: teacherForm.role,
        classTeacherOf: teacherForm.classTeacherOf || null,
        allocations: [],
      });
      setTeacherForm({ name: "", email: "", password: "", classTeacherOf: "", role: "Subject Teacher" });
      setFormFeedback("Faculty account provisioned!");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error provisioning account.");
    }
  };

  const startEditTeacher = (teacher: any) => {
    setEditingTeacherId(teacher.id);
    setEditTeacherName(teacher.name || "");
    setEditTeacherPassword(teacher.password || "");
    setEditTeacherRole(teacher.role || "Subject Teacher");
    setEditTeacherClassMaster(teacher.classTeacherOf || "");
  };

  const handleUpdateTeacher = async (id: string) => {
    try {
      await updateDoc(doc(db, "teachers", id), {
        name: editTeacherName.trim(),
        password: editTeacherPassword,
        role: editTeacherRole,
        classTeacherOf: editTeacherClassMaster || null,
      });
      setEditingTeacherId(null);
      setFormFeedback("Faculty credentials and permissions updated.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error modifying faculty.");
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Delete this teacher profile?")) return;
    try {
      await deleteDoc(doc(db, "teachers", id));
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error deleting teacher.");
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationForm.teacherId) return;
    try {
      const teacherRef = doc(db, "teachers", allocationForm.teacherId);
      await updateDoc(teacherRef, {
        allocations: arrayUnion({
          class: allocationForm.class,
          subject: allocationForm.subject,
        }),
      });
      setFormFeedback("Subject allocation added.");
      loadSystemRecords();
    } catch (err) {
      setFormFeedback("Error setting allocation.");
    }
  };

  // Helper to count active days for a subject in a specific class
  const getActiveDaysForSubject = (cls: string, subject: string) => {
    const classData = allClassTimetables[cls] || {};
    let activeDays = 0;
    daysOfWeek.forEach((day) => {
      const daySlots = classData[day] || {};
      const subjectPresent = Object.values(daySlots).some((s) => s === subject);
      if (subjectPresent) activeDays++;
    });
    return activeDays;
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

  const selectedTeacherObj = teachers.find((t) => t.id === selectedTimetableTeacher);

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
            <button onClick={() => { setIsAuthenticated(false); setAssignedClassMaster(null); }} className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2.5 rounded-xl transition-colors">
              Lock Session 🔒
            </button>
          </div>
        </div>
      </header>

      {formFeedback && (
        <div className="bg-slate-900 text-slate-100 font-mono text-center py-2 text-[10px] font-black uppercase tracking-widest animate-pulse">
          ⚡ Notice: {formFeedback}
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
                Students Directory ({students.length})
              </button>
              <button onClick={() => setActiveTab("teachers")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "teachers" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                Faculty & Roles ({teachers.length})
              </button>
              <button onClick={() => setActiveTab("timetable")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "timetable" ? "border-slate-900 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                📅 Timetable Studio (3 Views & Rules)
              </button>
            </>
          )}
          <button onClick={() => setActiveTab("printEngine")} className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-b-4 transition-all ${activeTab === "printEngine" || assignedClassMaster !== null ? "border-slate-900 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            🖨️ Report Card Hub
          </button>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && assignedClassMaster === null && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Enrollment</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">{students.length} Learners</span>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Faculty Members</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">{teachers.length} Instructors</span>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Streams</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono">{availableClasses.length} Streams</span>
            </div>
          </div>
        )}

        {/* FACULTY & ROLES MANAGEMENT */}
        {activeTab === "teachers" && assignedClassMaster === null && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Provision Faculty Profile & Privilege Level</h3>
                <form onSubmit={handleAddTeacher} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} placeholder="Teacher Name" className="w-full bg-slate-50 border p-2 text-sm rounded-xl uppercase" />
                    <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="Email Address" className="w-full bg-slate-50 border p-2 text-sm rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="Passcode Pin" className="w-full bg-slate-50 border p-2 text-sm rounded-xl font-mono" />
                    <select value={teacherForm.role} onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value })} className="w-full bg-slate-50 border p-2 text-sm rounded-xl font-black">
                      {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <select value={teacherForm.classTeacherOf} onChange={(e) => setTeacherForm({ ...teacherForm, classTeacherOf: e.target.value })} className="w-full bg-slate-50 border p-2 text-sm rounded-xl font-black">
                    <option value="">None / Floating Instructor</option>
                    {availableClasses.map((c) => <option key={c} value={c}>Class Master of {c}</option>)}
                  </select>
                  <button type="submit" className="w-full bg-slate-900 text-white text-[10px] font-black uppercase py-3 rounded-xl">Save Faculty Member</button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 pb-2 border-b border-slate-100">Map Subject Lesson Allocation</h3>
                <form onSubmit={handleAddAllocation} className="space-y-4">
                  <select value={allocationForm.teacherId} onChange={(e) => setAllocationForm({ ...allocationForm, teacherId: e.target.value })} className="w-full bg-slate-50 border p-2 text-sm font-black rounded-xl">
                    <option value="">-- Choose Instructor Document --</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={allocationForm.class} onChange={(e) => setAllocationForm({ ...allocationForm, class: e.target.value })} className="bg-slate-50 border p-2 text-sm font-black rounded-xl">
                      {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={allocationForm.subject} onChange={(e) => setAllocationForm({ ...allocationForm, subject: e.target.value })} className="bg-slate-50 border p-2 text-sm font-black rounded-xl">
                      {subjectsList.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white text-[10px] font-black uppercase py-3 rounded-xl">Bind Subject Mapping</button>
                </form>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-wider border-b bg-slate-50 h-10">
                    <th className="p-4">Teacher Name / ID</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">Class Master Assignment</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        {editingTeacherId === t.id ? (
                          <input type="text" value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} className="border p-1 text-xs uppercase rounded" />
                        ) : (
                          <div>
                            <div className="font-black text-slate-900">{t.name || t.id}</div>
                            <div className="text-[10px] text-slate-400">Passcode: <span className="font-mono text-blue-600">{t.password || "123456"}</span></div>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {editingTeacherId === t.id ? (
                          <select value={editTeacherRole} onChange={(e) => setEditTeacherRole(e.target.value)} className="border p-1 text-xs rounded">
                            {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-[10px] font-black">{t.role || "Subject Teacher"}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {t.classTeacherOf ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">{t.classTeacherOf} MASTER</span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">None</span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1">
                        {editingTeacherId === t.id ? (
                          <button onClick={() => handleUpdateTeacher(t.id)} className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px]">Save</button>
                        ) : (
                          <button onClick={() => startEditTeacher(t)} className="text-[10px] font-black border px-2.5 py-1 rounded">Edit Privilege</button>
                        )}
                        <button onClick={() => handleDeleteTeacher(t.id)} className="text-[10px] font-black border text-rose-600 px-2 py-1 rounded">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIMETABLE CONTROL STUDIO (3 VIEWS & RULE ENGINE) */}
        {activeTab === "timetable" && assignedClassMaster === null && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
              <div>
                <h3 className="font-black text-slate-900 uppercase text-sm tracking-wide">Timetable Control Studio</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Switch views or configure subject frequency limits</p>
              </div>

              {/* Sub Tab View Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button onClick={() => setTimetableSubTab("class")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${timetableSubTab === "class" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  1. Single Class Schedule
                </button>
                <button onClick={() => setTimetableSubTab("teacher")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${timetableSubTab === "teacher" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  2. Teacher Schedule
                </button>
                <button onClick={() => setTimetableSubTab("master")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${timetableSubTab === "master" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  3. Master School Matrix
                </button>
                <button onClick={() => setTimetableSubTab("rules")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${timetableSubTab === "rules" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500"}`}>
                  ⚙️ Frequency Rules
                </button>
              </div>
            </div>

            {/* VIEW 1: SINGLE CLASS TIMETABLE */}
            {timetableSubTab === "class" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-500">Select Stream:</span>
                    <select value={selectedTimetableClass} onChange={(e) => setSelectedTimetableClass(e.target.value)} className="bg-slate-50 border p-2 text-xs font-black rounded-xl">
                      {availableClasses.map((c) => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                  <button onClick={() => handleSaveClassTimetable(selectedTimetableClass)} disabled={savingTimetable} className="bg-blue-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl">
                    {savingTimetable ? "Saving..." : "Save Stream Schedule 💾"}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                        <th className="p-3 border border-slate-800 w-36">Period / Time</th>
                        {daysOfWeek.map((day) => <th key={day} className="p-3 border border-slate-800 text-center">{day}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-bold">
                      {timeSlots.map((slot) => {
                        const isLocked = slot.includes("BREAK") || slot.includes("LUNCH") || slot.includes("DEBATE");
                        return (
                          <tr key={slot} className={isLocked ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                            <td className="p-3 border font-mono text-[10px] text-slate-700 bg-slate-50">{slot}</td>
                            {daysOfWeek.map((day) => (
                              <td key={`${day}-${slot}`} className="p-2 border text-center">
                                {isLocked ? (
                                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">{slot.split(" ")[1]}</span>
                                ) : (
                                  <select
                                    value={allClassTimetables[selectedTimetableClass]?.[day]?.[slot] || ""}
                                    onChange={(e) => handleCellChange(selectedTimetableClass, day, slot, e.target.value)}
                                    className="w-full bg-slate-50 border rounded-lg p-1 text-xs font-bold focus:border-blue-500"
                                  >
                                    <option value="">-- Free --</option>
                                    {subjectsList.map((subj) => (
                                      <option key={subj} value={subj}>{subj}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 2: INDIVIDUAL TEACHER TIMETABLE */}
            {timetableSubTab === "teacher" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2">
                  <span className="text-xs font-black uppercase text-slate-500">Filter Schedule by Teacher:</span>
                  <select value={selectedTimetableTeacher} onChange={(e) => setSelectedTimetableTeacher(e.target.value)} className="bg-slate-50 border p-2 text-xs font-black rounded-xl">
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[10px] font-black uppercase">
                        <th className="p-3 border border-slate-700">Period</th>
                        {daysOfWeek.map((d) => <th key={d} className="p-3 border border-slate-700 text-center">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-bold">
                      {timeSlots.map((slot) => (
                        <tr key={slot}>
                          <td className="p-3 border font-mono text-[10px] text-slate-600 bg-slate-50">{slot}</td>
                          {daysOfWeek.map((day) => {
                            // Find matching class where teacher is allocated for this subject
                            let assignedClassSubj = "";
                            availableClasses.forEach((cls) => {
                              const scheduledSubj = allClassTimetables[cls]?.[day]?.[slot];
                              if (scheduledSubj) {
                                const isAssigned = selectedTeacherObj?.allocations?.some(
                                  (a: any) => a.class === cls && a.subject === scheduledSubj
                                );
                                if (isAssigned) {
                                  assignedClassSubj = `${scheduledSubj} (${cls})`;
                                }
                              }
                            });
                            return (
                              <td key={`${day}-${slot}`} className="p-3 border text-center">
                                {assignedClassSubj ? (
                                  <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-[11px] font-black">{assignedClassSubj}</span>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">-- Free --</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: MASTER SCHOOL TIMETABLE (SIDE-BY-SIDE) */}
            {timetableSubTab === "master" && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-950 text-white text-[9px] font-black uppercase">
                        <th className="p-2 border border-slate-800">Day & Slot</th>
                        {availableClasses.map((cls) => (
                          <th key={cls} className="p-2 border border-slate-800 text-center bg-blue-900/40">Class {cls}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-bold">
                      {daysOfWeek.map((day) =>
                        timeSlots.map((slot) => (
                          <tr key={`${day}-${slot}`} className="hover:bg-slate-50">
                            <td className="p-2 border text-[10px] font-mono bg-slate-50 text-slate-700">
                              <span className="font-black text-slate-900 block">{day}</span>
                              {slot}
                            </td>
                            {availableClasses.map((cls) => {
                              const subj = allClassTimetables[cls]?.[day]?.[slot];
                              return (
                                <td key={`${cls}-${day}-${slot}`} className="p-2 border text-center text-[10px]">
                                  {subj ? (
                                    <span className="bg-slate-800 text-white px-2 py-0.5 rounded font-black">{subj}</span>
                                  ) : (
                                    <span className="text-slate-300">--</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RULES & FREQUENCY CONTROL ENGINE */}
            {timetableSubTab === "rules" && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs space-y-1">
                  <h4 className="font-black text-blue-900 uppercase">🧠 Subject Frequency Spreading Algorithm</h4>
                  <p className="text-blue-800">
                    Configure the required active teaching days per week for each subject. Before placing lessons, the scheduler ensures subjects meet their exact target distribution without cognitive overload.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-xl border space-y-4">
                    <h4 className="text-xs font-black uppercase text-slate-900">Configure Target Days / Week</h4>
                    {subjectsList.map((subj) => (
                      <div key={subj} className="flex justify-between items-center">
                        <span className="text-xs font-bold">{subj}:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={subjectFrequencyRules[subj] || 1}
                            onChange={(e) => setSubjectFrequencyRules({ ...subjectFrequencyRules, [subj]: parseInt(e.target.value) || 1 })}
                            className="w-16 border rounded p-1 text-center text-xs font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">days / week</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-900">Class {selectedTimetableClass} Frequency Audit</h4>
                    <div className="space-y-2 text-xs">
                      {subjectsList.map((subj) => {
                        const target = subjectFrequencyRules[subj] || 0;
                        const actual = getActiveDaysForSubject(selectedTimetableClass, subj);
                        const isSatisfied = actual >= target;
                        return (
                          <div key={subj} className="flex justify-between items-center p-2 bg-white rounded border">
                            <span className="font-bold">{subj}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold">{actual} / {target} Active Days</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${isSatisfied ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                {isSatisfied ? "✓ OK" : "Needs Allocation"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPORT CARD HUB */}
        {(activeTab === "printEngine" || assignedClassMaster !== null) && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-black text-slate-900 uppercase text-sm tracking-wide">Report Generator Workspace Matrix</h3>
              {assignedClassMaster === null && (
                <select value={printFilterClass} onChange={(e) => setPrintFilterClass(e.target.value)} className="bg-slate-50 border p-2 text-xs font-black rounded-xl">
                  {availableClasses.map((c) => <option key={c} value={c}>Roster Filter: Stream {c}</option>)}
                </select>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {students.filter((s) => s.class === (assignedClassMaster || printFilterClass)).map((st) => (
                <div key={st.id} className="p-4 flex justify-between items-center hover:bg-slate-50/30">
                  <span className="font-black uppercase text-sm text-slate-900">{st.name}</span>
                  <Link href={`/reports?studentId=${st.id}&class=${st.class}`} target="_blank">
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-colors inline-block cursor-pointer">
                      Preview Report Card 🖨️
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}