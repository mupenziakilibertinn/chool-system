"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

const schoolSubjects = [
  { id: "math", name: "Mathematics" },
  { id: "kiny", name: "Kinyarwanda" },
  { id: "eng", name: "English" },
  { id: "set", name: "Science & Elem. Tech (SET)" },
  { id: "sre", name: "SRE / Religion" },
  { id: "french", name: "French" }
];

const getComment = (avg: number) => {
  if (avg >= 80) return "Excellent Performance.";
  if (avg >= 60) return "Good Work.";
  if (avg >= 50) return "Satisfactory.";
  return "Below average. More effort needed.";
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("register");
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [bulkNames, setBulkNames] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [tSubjects, setTSubjects] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [selectedClass, activeTab]);

  const loadData = async () => {
    if (activeTab === "register" || activeTab === "reports") {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
    }
    if (activeTab === "manage-teachers") {
      const snap = await getDocs(collection(db, "teachers"));
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const handleRegister = async () => {
    const names = bulkNames.split("\n").filter(n => n.trim() !== "");
    for (const name of names) {
      await addDoc(collection(db, "students"), { name: name.trim().toUpperCase(), class: selectedClass });
    }
    setBulkNames(""); loadData();
  };

  const handleSaveTeacher = async () => {
    await setDoc(doc(db, "teachers", tEmail.toLowerCase()), {
      email: tEmail.toLowerCase(), classes: tClasses, subjects: tSubjects
    });
    setTEmail(""); setTClasses([]); setTSubjects([]); loadData();
    alert("Teacher Authorized");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="bg-blue-900 text-white p-6 sticky top-0 z-50 no-print flex justify-between items-center shadow-xl">
        <h1 className="text-xl font-black italic">NGS ADMIN</h1>
        <div className="flex bg-blue-800 p-1 rounded-xl">
          {["register", "manage-teachers", "reports"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${activeTab === t ? "bg-white text-blue-900" : ""}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 no-print">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="mb-6 p-2 rounded-lg border-2 border-blue-900 font-bold">
          {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {activeTab === "register" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
              <h2 className="font-black text-xs mb-4 uppercase">Paste Student Names (One per line)</h2>
              <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} rows={10} className="w-full border p-3 rounded-lg mb-2" placeholder="NAME HERE..."></textarea>
              <button onClick={handleRegister} className="w-full bg-blue-900 text-white font-black py-3 rounded-lg">SAVE TO {selectedClass}</button>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-lg h-[500px] overflow-y-auto">
              <h2 className="font-black text-xs mb-4 uppercase">List ({students.length})</h2>
              {students.map(s => (
                <div key={s.id} className="flex justify-between p-2 border-b text-[11px] font-bold">
                  <span>{s.name}</span>
                  <button onClick={async () => { if(confirm("Delete?")) await deleteDoc(doc(db, "students", s.id)); loadData(); }} className="text-red-600 underline">DEL</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "manage-teachers" && (
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h2 className="font-black text-xs mb-4 uppercase">Teacher Setup</h2>
            <input value={tEmail} onChange={(e) => setTEmail(e.target.value)} placeholder="Teacher Email" className="w-full p-3 border rounded-lg mb-4" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border p-3 rounded-lg">
                 <p className="font-black text-[10px] mb-2">CLASSES</p>
                 {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <label key={c} className="block text-xs font-bold"><input type="checkbox" onChange={(e) => e.target.checked ? setTClasses([...tClasses, c]) : setTClasses(tClasses.filter(x => x !== c))} /> {c}</label>)}
              </div>
              <div className="border p-3 rounded-lg">
                 <p className="font-black text-[10px] mb-2">SUBJECTS</p>
                 {schoolSubjects.map(s => <label key={s.id} className="block text-xs font-bold"><input type="checkbox" onChange={(e) => e.target.checked ? setTSubjects([...tSubjects, s.name]) : setTSubjects(tSubjects.filter(x => x !== s.name))} /> {s.name}</label>)}
              </div>
            </div>
            <button onClick={handleSaveTeacher} className="w-full bg-blue-900 text-white font-black py-3 rounded-lg">AUTHORIZE TEACHER</button>
          </div>
        )}

        {activeTab === "reports" && (
           <div className="space-y-4">
              <button onClick={() => window.print()} className="bg-blue-900 text-white w-full py-5 rounded-2xl font-black uppercase">Print All Reports</button>
              {students.map(s => (
                <div key={s.id} className="bg-white p-4 flex justify-between rounded-xl border font-black text-xs uppercase">
                  <span>{s.name}</span>
                  <button onClick={() => { const content = document.getElementById(`rep-${s.id}`)?.innerHTML; if(content) { document.body.innerHTML = content; window.print(); window.location.reload(); } }} className="text-green-600 underline">Print Individual</button>
                </div>
              ))}
           </div>
        )}
      </div>

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
    <div className="p-10 bg-white w-[210mm] mx-auto border-[10px] border-double border-blue-900 min-h-[295mm]">
      <div className="text-center border-b-4 border-green-600 pb-4 mb-4">
        <h1 className="text-3xl font-black text-blue-900 uppercase">New Generation School</h1>
      </div>
      <div className="flex justify-between font-black text-[10px] mb-6 uppercase border-b pb-2">
         <p>Student: {student.name}</p><p>Class: {selectedClass}</p>
      </div>
      <table className="w-full border-2 border-black">
        <thead className="bg-gray-100 text-[10px] font-black">
          <tr><th className="border border-black p-2 text-left">SUBJECTS</th><th className="border border-black p-2">SCORE /100</th></tr>
        </thead>
        <tbody className="font-bold text-[11px]">
          {schoolSubjects.map(sub => {
             const m = marks[sub.name] || {t1:0, m1:0, t2:0, m2:0, exam:0};
             const avg = (m.t1 + m.m1 + m.t2 + m.m2 + (m.exam * 2)) / 6;
             totalPoints += avg;
             return (
               <tr key={sub.id} className="border border-black">
                 <td className="p-2 border-r border-black uppercase">{sub.name}</td>
                 <td className="p-2 text-center">{avg > 0 ? avg.toFixed(1) : "0.0"}</td>
               </tr>
             );
          })}
          <tr className="bg-blue-900 text-white font-black">
            <td className="p-2 text-right">TOTAL AVERAGE</td>
            <td className="p-2 text-center">{(totalPoints/schoolSubjects.length).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-10 border-2 border-blue-900 p-4 text-xs italic">
         <span className="font-black not-italic underline">HEAD TEACHER'S REMARK:</span> {getComment(totalPoints/schoolSubjects.length)}
      </div>
    </div>
  );
}