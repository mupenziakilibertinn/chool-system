"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const subjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "Social Studies", "French"];

export default function AdminPage() {
  const [tab, setTab] = useState("students");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
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
    if (tab === "teachers") {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const saveStudents = async () => {
    const names = bulkNames.split("\n").filter(n => n.trim() !== "");
    for (const n of names) { await addDoc(collection(db, "students"), { name: n.trim().toUpperCase(), class: selectedClass }); }
    setBulkNames(""); loadData();
    alert("Saved!");
  };

  const saveTeacher = async () => {
    await setDoc(doc(db, "teachers", tEmail.toLowerCase()), { email: tEmail.toLowerCase(), classes: tClasses, subjects: tSubjects });
    setTEmail(""); setTClasses([]); setTSubjects([]); loadData();
    alert("Teacher Authorized!");
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center no-print">
        <h1 className="font-bold">NGS ADMIN</h1>
        <div className="flex gap-2">
          {["students", "teachers", "reports"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded uppercase text-[10px] font-bold ${tab === t ? "bg-white text-blue-900" : "bg-blue-800"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto no-print">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="mb-4 p-2 border-2 border-blue-900 rounded font-bold">
          {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {tab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="font-bold mb-2">Register Students (One per line)</h2>
              <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full border p-2 h-40 mb-2" />
              <button onClick={saveStudents} className="w-full bg-blue-900 text-white py-2 font-bold">SAVE TO {selectedClass}</button>
            </div>
            <div className="bg-white p-4 rounded shadow h-80 overflow-y-auto">
              <h2 className="font-bold mb-2">Student List ({students.length})</h2>
              {students.map(s => <div key={s.id} className="text-xs border-b p-1 flex justify-between"><span>{s.name}</span><button onClick={async () => {await deleteDoc(doc(db, "students", s.id)); loadData();}} className="text-red-500">DEL</button></div>)}
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <div className="bg-white p-6 rounded shadow max-w-md mx-auto">
            <h2 className="font-bold mb-4">Add Teacher</h2>
            <input placeholder="Email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="w-full border p-2 mb-4" />
            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold mb-4">
              <div className="border p-2">
                <p>CLASSES</p>
                {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <label key={c} className="block"><input type="checkbox" onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}</label>)}
              </div>
              <div className="border p-2">
                <p>SUBJECTS</p>
                {subjects.map(s => <label key={s} className="block"><input type="checkbox" onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s]) : setTSubjects(tSubjects.filter(x => x !== s))} /> {s}</label>)}
              </div>
            </div>
            <button onClick={saveTeacher} className="w-full bg-blue-900 text-white py-2 font-bold uppercase">Authorize</button>
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-2">
            <button onClick={() => window.print()} className="w-full bg-green-600 text-white py-3 font-bold mb-4">PRINT FULL CLASS</button>
            {students.map(s => (
              <div key={s.id} className="bg-white p-3 flex justify-between border">
                <span className="font-bold text-sm">{s.name}</span>
                <button onClick={() => {const c = document.getElementById(`rep-${s.id}`)?.innerHTML; if(c){document.body.innerHTML=c; window.print(); window.location.reload();}}} className="text-blue-600 font-bold underline">Individual Report</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="report-only">
        {students.map(s => (
          <div key={s.id} id={`rep-${s.id}`} className="page-break p-10">
            <h1 className="text-center text-2xl font-bold uppercase border-b-2">New Generation School Report</h1>
            <div className="flex justify-between py-4 font-bold uppercase text-xs"><span>Name: {s.name}</span><span>Class: {selectedClass}</span></div>
            <ReportTable studentId={s.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTable({ studentId }: { studentId: string }) {
  const [marks, setMarks] = useState<any>({});
  useEffect(() => {
    const fetch = async () => {
      let m: any = {};
      for (const s of subjects) {
        const snap = await getDoc(doc(db, "students", studentId, "marks", s));
        if (snap.exists()) m[s] = snap.data();
      }
      setMarks(m);
    };
    fetch();
  }, [studentId]);

  return (
    <table className="w-full border-collapse border border-black text-sm">
      <thead className="bg-gray-200"><tr><th className="border border-black p-2">SUBJECT</th><th className="border border-black p-2">SCORE / 100</th></tr></thead>
      <tbody>
        {subjects.map(s => {
          const d = marks[s] || { t1: 0, m1: 0, t2: 0, m2: 0, exam: 0 };
          const avg = (d.t1 + d.m1 + d.t2 + d.m2 + (d.exam * 2)) / 6;
          return <tr key={s}><td className="border border-black p-2 uppercase">{s}</td><td className="border border-black p-2 text-center">{avg.toFixed(1)}</td></tr>;
        })}
      </tbody>
    </table>
  );
}