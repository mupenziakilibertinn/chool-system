"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

// --- GLOBAL SETTINGS ---
const schoolSubjects = [
  { id: "math", name: "Mathematics" },
  { id: "kiny", name: "Kinyarwanda" },
  { id: "eng", name: "English" },
  { id: "set", name: "Science & Elem. Tech (SET)" },
  { id: "sre", name: "SRE / Religion" },
  { id: "social", name: "Social Studies" },
  { id: "french", name: "French" }
];

const getStudentComment = (avg: number) => {
  if (avg >= 80) return "Excellent Performance. Keep it up!";
  if (avg >= 60) return "Good Work. Aim higher next term.";
  if (avg >= 50) return "Satisfactory. More effort needed.";
  return "Below average. Intensive revision required.";
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("register");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkNames, setBulkNames] = useState("");

  // Teacher Registration State
  const [tEmail, setTEmail] = useState("");
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [tSubjects, setTSubjects] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [selectedClass, activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === "register" || activeTab === "reports") {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    }
    if (activeTab === "manage-teachers") {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!bulkNames.trim()) return;
    const names = bulkNames.split("\n").filter(n => n.trim() !== "");
    for (const name of names) {
      await addDoc(collection(db, "students"), { name: name.trim().toUpperCase(), class: selectedClass });
    }
    setBulkNames(""); loadData();
    alert("Students registered!");
  };

  const handleSaveTeacher = async () => {
    if (!tEmail) return alert("Email required");
    await setDoc(doc(db, "teachers", tEmail.toLowerCase()), {
      email: tEmail.toLowerCase(), classes: tClasses, subjects: tSubjects
    });
    setTEmail(""); setTClasses([]); setTSubjects([]); loadData();
    alert("Teacher permissions saved!");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER SECTION */}
      <div className="bg-[#1e3a8a] text-white p-6 sticky top-0 z-50 no-print flex justify-between items-center shadow-2xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">New Generation Admin</h1>
        <div className="flex bg-blue-900/50 p-1 rounded-xl border border-blue-700">
          {["register", "manage-teachers", "reports"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === t ? "bg-white text-blue-900 shadow-md" : "text-blue-200"}`}>
              {t.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 no-print">
        {/* CLASS SELECTOR */}
        <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border w-fit">
          <label className="font-black text-blue-900 uppercase text-[10px] tracking-widest">Selected Class:</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 rounded-lg font-black border-2 border-blue-900 bg-white text-blue-900">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* TAB 1: STUDENT REGISTRATION */}
        {activeTab === "register" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-600">
              <h2 className="font-black uppercase mb-4 text-blue-900 text-sm">Bulk Register Students</h2>
              <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase">Paste one name per line</p>
              <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} rows={8} className="w-full border-2 p-4 rounded-xl mb-4 font-bold text-sm focus:border-blue-900 outline-none" placeholder="MUHOZA Eric&#10;UWINEZA Marie..."></textarea>
              <button onClick={handleRegister} className="w-full bg-blue-900 text-white font-black py-4 rounded-xl hover:bg-black transition-all shadow-lg">SAVE TO {selectedClass}</button>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl h-[550px] flex flex-col border border-gray-100">
              <h2 className="font-black uppercase mb-4 text-blue-900 text-sm">Class List ({students.length})</h2>
              <div className="overflow-y-auto flex-1 pr-2">
                {students.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50 group">
                    <span className="text-xs font-bold uppercase text-gray-700">{s.name}</span>
                    <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={async () => { const n = prompt("Edit Name:", s.name); if(n) await updateDoc(doc(db, "students", s.id), {name: n.toUpperCase()}); loadData(); }} className="text-blue-600 text-[10px] font-black underline">EDIT</button>
                      <button onClick={async () => { if(confirm(`Delete ${s.name}?`)) await deleteDoc(doc(db, "students", s.id)); loadData(); }} className="text-red-600 text-[10px] font-black underline">DELETE</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEACHER MANAGEMENT (REGISTER TEACHERS) */}
        {activeTab === "manage-teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-900">
              <h2 className="font-black uppercase mb-6 text-blue-900">Add Teacher Access</h2>
              <input value={tEmail} onChange={(e) => setTEmail(e.target.value)} placeholder="Teacher Email Address" className="w-full p-4 border-2 rounded-xl mb-6 font-bold text-sm" />
              
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="border-2 p-4 rounded-xl bg-gray-50">
                  <p className="font-black text-[10px] uppercase mb-3 text-blue-900">1. Assign Classes</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => (
                      <label key={c} className="flex gap-2 text-[11px] font-bold items-center cursor-pointer p-1 bg-white rounded border border-gray-200">
                        <input type="checkbox" checked={tClasses.includes(c)} onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="border-2 p-4 rounded-xl bg-gray-50">
                  <p className="font-black text-[10px] uppercase mb-3 text-blue-900">2. Assign Subjects</p>
                  <div className="space-y-1">
                    {schoolSubjects.map(s => (
                      <label key={s.id} className="flex gap-2 text-[11px] font-bold items-center cursor-pointer p-1 bg-white rounded border border-gray-200">
                        <input type="checkbox" checked={tSubjects.includes(s.name)} onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s.name]) : setTSubjects(tSubjects.filter(x => x !== s.name))} /> {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleSaveTeacher} className="w-full bg-blue-900 text-white font-black py-4 rounded-xl hover:bg-black shadow-lg uppercase text-xs">Authorize Teacher</button>
            </div>

            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
              <h2 className="font-black uppercase mb-6 text-blue-900">Current Teacher Accounts</h2>
              <div className="space-y-4">
                {teachers.map(t => (
                  <div key={t.id} className="p-4 border rounded-2xl flex justify-between items-center bg-gray-50 hover:border-blue-300">
                    <div>
                      <p className="font-black text-blue-900 uppercase text-xs">{t.email}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Classes: {t.classes?.join(", ")}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase italic">{t.subjects?.join(", ")}</p>
                    </div>
                    <button onClick={async () => { if(confirm("Remove this teacher?")) await deleteDoc(doc(db, "teachers", t.id)); loadData(); }} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-black text-[10px] uppercase border border-red-100 hover:bg-red-600 hover:text-white transition-all">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REPORTS & PRINTING */}
        {activeTab === "reports" && (
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-900 flex justify-between items-center">
                 <div>
                    <h2 className="font-black uppercase text-blue-900 text-lg">Generate Reports for {selectedClass}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">You can print the entire class at once or pick a student</p>
                 </div>
                 <button onClick={() => window.print()} className="bg-blue-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-105 transition-transform active:scale-95">Print Full Class ({students.length})</button>
              </div>

              <div className="bg-white rounded-3xl border shadow-lg overflow-hidden">
                {students.map(s => (
                  <div key={s.id} className="p-5 flex justify-between items-center border-b last:border-0 hover:bg-blue-50 group">
                    <span className="font-black text-blue-900 uppercase text-xs tracking-widest">{s.name}</span>
                    <button onClick={() => { const content = document.getElementById(`rep-${s.id}`)?.innerHTML; if(content) { const orig = document.body.innerHTML; document.body.innerHTML = content; window.print(); window.location.reload(); } }} className="bg-green-100 text-green-700 px-6 py-2 rounded-lg font-black text-[10px] uppercase border border-green-200 hover:bg-green-700 hover:text-white transition-all">Individual Report</button>
                  </div>
                ))}
              </div>
           </div>
        )}
      </div>

      {/* --- HIDDEN REPORT CARDS FOR PRINTER --- */}
      <div className="report-only">
        {students.map(s => (
          <div key={s.id} id={`rep-${s.id}`} className="page-break">
            <ReportCard student={s} selectedClass={selectedClass} />
          </div>
        ))}
      </div>
    </div>
  );
}

// REPORT CARD COMPONENT (Stays inside the same file for ease)
function ReportCard({ student, selectedClass }: any) {
  const [marks, setMarks] = useState<any>({});
  useEffect(() => {
    const fetch = async () => {
      let data: any = {};
      for (const sub of schoolSubjects) {
        const mSnap = await getDoc(doc(db, "students", student.id, "marks", sub.name));
        if (mSnap.exists()) data[sub.name] = mSnap.data();
      }
      setMarks(data);
    };
    fetch();
  }, [student.id]);

  let totalPoints = 0;
  return (
    <div className="p-12 bg-white w-[210mm] mx-auto border-[10px] border-double border-blue-900 min-h-[295mm] relative">
      <div className="text-center border-b-4 border-green-600 pb-4 mb-8">
        <h1 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">New Generation School</h1>
        <p className="text-[11px] font-bold text-green-700 uppercase tracking-widest italic mt-2">Preparation, Praying, Politeness and Performance</p>
      </div>
      
      <div className="flex justify-between font-black text-blue-900 mb-10 uppercase text-[11px] border-b pb-2 tracking-widest">
         <p>Student: {student.name}</p>
         <p>Class: {selectedClass}</p>
         <p>Year: 2026</p>
      </div>

      <table className="w-full border-[3px] border-black">
        <thead className="bg-gray-100 text-[11px] font-black uppercase">
          <tr className="border-b-[3px] border-black">
            <th className="p-4 text-left border-r-[3px] border-black">Subject Name</th>
            <th className="p-4 text-center">Score / 100</th>
          </tr>
        </thead>
        <tbody className="font-bold uppercase text-[12px]">
          {schoolSubjects.map(sub => {
             const m = marks[sub.name] || {t1:0, m1:0, t2:0, m2:0, exam:0};
             const avg = (m.t1 + m.m1 + m.t2 + m.m2 + (m.exam * 2)) / 6;
             totalPoints += avg;
             return (
               <tr key={sub.id} className="border-b-2 border-black last:border-0">
                 <td className="p-4 border-r-[3px] border-black">{sub.name}</td>
                 <td className="p-4 text-center bg-gray-50/50">{avg > 0 ? avg.toFixed(1) : "0.0"}</td>
               </tr>
             );
          })}
          <tr className="bg-blue-900 text-white font-black text-xl border-t-[3px] border-black">
             <td className="p-5 text-right uppercase border-r-[3px] border-white">General Average</td>
             <td className="p-5 text-center">{(totalPoints/schoolSubjects.length).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-10 p-6 bg-gray-50 border-2 border-blue-900 italic text-sm text-blue-900 rounded-3xl">
        <span className="font-black uppercase not-italic block mb-2 underline">Head Teacher's Remark:</span> 
        {getStudentComment(totalPoints/schoolSubjects.length)}
      </div>

      <div className="absolute bottom-16 left-12 right-12 flex justify-between items-end">
         <div className="text-center">
            <div className="w-40 h-[2px] bg-black mb-2"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">Class Teacher</p>
         </div>
         <div className="text-center font-black text-blue-900 text-2xl italic uppercase opacity-10 rotate-[-15deg] border-4 border-dashed p-4 rounded-full">NGS STAMP</div>
         <div className="text-center">
            <div className="w-40 h-[2px] bg-black mb-2"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">School Manager</p>
         </div>
      </div>
    </div>
  );
}