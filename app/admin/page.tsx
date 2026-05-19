"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const subjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "Social Studies", "French"];

export default function AdminPage() {
  const [tab, setTab] = useState("students");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [tSubjects, setTSubjects] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [selectedClass, tab]);

  const loadData = async () => {
    if (tab === "students" || tab === "reports") {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    }
  };

  const saveStudents = async () => {
    const names = bulkNames.split("\n").filter(n => n.trim() !== "");
    for (const n of names) { await addDoc(collection(db, "students"), { name: n.trim().toUpperCase(), class: selectedClass }); }
    setBulkNames(""); loadData();
    alert("Saved Student List!");
  };

  const saveTeacher = async () => {
    if(!tEmail) return;
    await setDoc(doc(db, "teachers", tEmail.trim().toLowerCase()), { email: tEmail.trim().toLowerCase(), classes: tClasses, subjects: tSubjects });
    setTEmail(""); setTClasses([]); setTSubjects([]);
    alert("Teacher Configuration Set!");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-xs pb-10">
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-xl no-print">
        <h1 className="font-black uppercase tracking-wider italic text-sm">NGS ADMIN</h1>
        <div className="flex gap-2">
          {["students", "teachers", "reports"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg uppercase font-black text-[9px] tracking-wider transition-colors ${tab === t ? "bg-white text-blue-900" : "bg-blue-800 hover:bg-blue-700"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto no-print">
        <div className="mb-6 flex gap-2 items-center">
          <span className="font-bold uppercase text-[10px] text-gray-500">Active Class Target:</span>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-xs text-blue-900 outline-none">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {tab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-2">Bulk Enroll (One Name Per Line)</h2>
              <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder="MUPENZI AKILI&#10;BERTIN AKILI" className="w-full border-2 rounded-xl p-3 h-48 mb-3 font-mono text-xs outline-none focus:border-blue-900" />
              <button onClick={saveStudents} className="w-full bg-blue-900 text-white py-3 rounded-xl font-black uppercase tracking-wide shadow-md">Add to Database</button>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 h-80 overflow-y-auto">
              <h2 className="font-black text-blue-900 uppercase tracking-wider mb-3">Enrolled ({students.length})</h2>
              {students.map(s => (
                <div key={s.id} className="border-b py-2 flex justify-between items-center font-bold text-gray-700 uppercase">
                  <span>{s.name}</span>
                  <button onClick={async () => {if(confirm("Remove student completely?")) { await deleteDoc(doc(db, "students", s.id)); loadData(); }}} className="text-red-500 hover:underline font-black text-[10px]">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 max-w-md mx-auto">
            <h2 className="font-black text-blue-900 uppercase tracking-wider mb-4">Classroom Assignment</h2>
            <input placeholder="Teacher Email Address" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border-2 rounded-xl p-3 mb-4 font-bold outline-none focus:border-blue-900" />
            <div className="grid grid-cols-2 gap-4 font-bold text-gray-700 mb-5">
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">CLASSES</p>
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => (
                  <label key={c} className="flex items-center gap-2 mb-1 cursor-pointer"><input type="checkbox" checked={tClasses.includes(c)} onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}</label>
                ))}
              </div>
              <div className="border p-3 rounded-xl bg-gray-50">
                <p className="font-black text-[9px] text-blue-900 tracking-wider uppercase mb-2 border-b pb-1">SUBJECTS</p>
                {subjects.map(s => (
                  <label key={s} className="flex items-center gap-2 mb-1 cursor-pointer text-[10px]"><input type="checkbox" checked={tSubjects.includes(s)} onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s]) : setTSubjects(tSubjects.filter(x => x !== s))} /> {s}</label>
                ))}
              </div>
            </div>
            <button onClick={saveTeacher} className="w-full bg-blue-900 text-white py-3 rounded-xl font-black uppercase tracking-wide shadow-md">Assign System Roles</button>
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            <button onClick={() => window.print()} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black uppercase tracking-wider shadow-md">Print Full Classroom Roster Ledger</button>
            {students.map(s => (
              <div key={s.id} className="bg-white p-4 flex justify-between items-center rounded-xl border shadow-sm">
                <span className="font-black text-sm text-blue-900 uppercase">{s.name}</span>
                <button onClick={() => {const c = document.getElementById(`rep-${s.id}`)?.innerHTML; if(c){const original = document.body.innerHTML; document.body.innerHTML=c; window.print(); document.body.innerHTML = original; window.location.reload();}}} className="text-blue-600 font-black underline hover:text-blue-800">Generate Report Card</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="report-only">
        {students.map(s => (
          <div key={s.id} id={`rep-${s.id}`} className="page-break p-12 bg-white max-w-[210mm] mx-auto min-h-[297mm] border-[8px] border-double border-blue-900">
            <h1 className="text-center text-3xl font-black text-blue-900 uppercase tracking-wide border-b-4 border-green-600 pb-2">New Generation School</h1>
            <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-1 mb-6">Student Terminal Progress Record</p>
            <div className="flex justify-between border-b-2 pb-2 mb-6 font-black uppercase text-[11px] text-gray-800">
              <span>Pupil: {s.name}</span>
              <span>Level: {selectedClass}</span>
            </div>
            <ReportTable studentId={s.id} selectedClass={selectedClass} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTable({ studentId, selectedClass }: { studentId: string; selectedClass: string }) {
  const [marks, setMarks] = useState<any>({});
  
  useEffect(() => {
    const fetchMarks = async () => {
      let m: any = {};
      for (const s of subjects) {
        const snap = await getDoc(doc(db, "students", studentId, "marks", s));
        if (snap.exists()) m[s] = snap.data();
      }
      setMarks(m);
    };
    fetchMarks();
  }, [studentId]);

  let cumulativePoints = 0;
  let activeCount = 0;

  return (
    <div className="mt-4">
      <table className="w-full border-collapse border-2 border-black text-xs font-bold">
        <thead className="bg-gray-100 font-black uppercase text-[10px] tracking-wider text-center">
          <tr>
            <th className="border-2 border-black p-3 text-left w-1/2">Academic Courses</th>
            <th className="border-2 border-black p-3 w-1/2">Term Evaluation Score</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map(s => {
            const d = marks[s] || { t1: 0, m1: 0, t2: 0, m2: 0, exam: 0 };
            const hasData = marks[s] !== undefined;
            const avg = (d.t1 + d.m1 + d.t2 + d.m2 + (d.exam * 2)) / 6;
            
            if(hasData || avg > 0) {
              cumulativePoints += avg;
              activeCount++;
            }

            return (
              <tr key={s} className="uppercase hover:bg-gray-50">
                <td className="border-2 border-black p-3 text-left tracking-wide font-black text-blue-900">{s}</td>
                <td className="border-2 border-black p-3 text-center text-sm font-black">{avg > 0 ? avg.toFixed(1) : "0.0"}</td>
              </tr>
            );
          })}
          <tr className="bg-blue-950 text-white font-black text-sm uppercase">
            <td className="border-2 border-black p-3 text-right">Aggregate System Average</td>
            <td className="border-2 border-black p-3 text-center text-base">
              {activeCount > 0 ? (cumulativePoints / activeCount).toFixed(1) : "0.0"}%
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-12 p-4 border-2 border-dashed border-blue-900 rounded-xl bg-gray-50 text-xs italic text-gray-700">
        <span className="font-black not-italic underline text-blue-900 uppercase tracking-wider block mb-1">Head Teacher Remarks:</span>
        {activeCount > 0 && (cumulativePoints / activeCount) >= 50 ? "Satisfactory progression tracking. Keep maintaining focal determination metrics." : "Requires intentional instructional interventions and focused academic reinforcement."}
      </div>
    </div>
  );
}