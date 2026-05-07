"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, setDoc, getDoc } from "firebase/firestore";

export default function TeacherPortal() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [myClasses, setMyClasses] = useState<string[]>([]);
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [subject, setSubject] = useState("");
  const [testOutOf, setTestOutOf] = useState(50); 

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const email = user.email.toLowerCase();
        setUserEmail(email);
        const docSnap = await getDoc(doc(db, "teachers", email));
        if (docSnap.exists()) {
          const d = docSnap.data();
          setMyClasses(d.classes); setMySubjects(d.subjects);
          setSelectedClass(d.classes[0]); setSubject(d.subjects[0]);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedClass || !subject) return;
    const fetch = async () => {
      const snap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(list);
      for (const s of list) {
        const mSnap = await getDoc(doc(db, "students", s.id, "marks", subject));
        const marks = mSnap.exists() ? mSnap.data() : {};
        ["t1", "m1", "t2", "m2", "exam"].forEach(f => {
          const el = document.getElementById(`${f}-${s.id}`) as HTMLInputElement;
          if (el) el.value = marks[f] || "";
        });
      }
    };
    fetch();
  }, [selectedClass, subject]);

  const handleAutoSave = (studentId: string, field: string, raw: string) => {
    if (!raw) return;
    const target = selectedClass === "P6" ? 100 : 50;
    const converted = Math.round((Number(raw) / testOutOf) * target);
    setDoc(doc(db, "students", studentId, "marks", subject), { [field]: converted }, { merge: true });
  };

  if (!userEmail) return <div className="p-20 text-center font-black">Loading Teacher Portal...</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-blue-900 p-6 text-white sticky top-0 z-50 flex justify-between items-center shadow-lg">
         <h1 className="text-lg font-black uppercase italic">NGS PORTAL</h1>
         <div className="flex gap-3">
            <div className="bg-blue-800 p-1 rounded-lg flex items-center gap-2 border border-blue-400">
               <span className="text-[8px] font-black uppercase px-2">OUT OF:</span>
               <input type="number" value={testOutOf} onChange={(e) => setTestOutOf(Number(e.target.value))} className="w-10 text-center text-blue-900 rounded font-black h-7" />
            </div>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-1 rounded font-bold text-blue-900 text-xs">
               {myClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="p-1 rounded font-bold text-blue-900 text-xs">
               {mySubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>
      </div>
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-100 text-[10px] font-black uppercase text-blue-900 border-b">
          <tr><th className="p-4 border-r w-1/4">Student</th>{["t1", "m1", "t2", "m2", "exam"].map(h => <th key={h} className="p-2 border-r text-center">{h}</th>)}</tr>
        </thead>
        <tbody>
          {students.map((s, idx) => (
            <tr key={s.id} className="border-b hover:bg-blue-50 transition-colors">
              <td className="p-4 font-black text-blue-900 text-[11px] uppercase border-r bg-gray-50">{s.name}</td>
              {["t1", "m1", "t2", "m2", "exam"].map(f => (
                <td key={f} className="p-0 border-r">
                   <input 
                     id={`${f}-${s.id}`} type="number" 
                     onBlur={(e) => handleAutoSave(s.id, f, e.target.value)}
                     onKeyDown={(e) => { if(e.key === "Enter") document.getElementById(`${f}-${students[idx+1]?.id}`)?.focus(); }}
                     className="w-full p-4 text-center font-black text-blue-900 outline-none focus:bg-white"
                     placeholder={`/${testOutOf}`}
                   />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}