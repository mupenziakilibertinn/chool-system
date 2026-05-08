"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, setDoc, getDoc } from "firebase/firestore";

export default function TeacherPage() {
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ classes: [], subjects: [] });
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [outOf, setOutOf] = useState(50);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.email) {
        setUser(u);
        const snap = await getDoc(doc(db, "teachers", u.email.toLowerCase()));
        if (snap.exists()) {
          const d = snap.data(); setConfig(d);
          setSelectedClass(d.classes[0]); setSelectedSubject(d.subjects[0]);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const load = async () => {
      const snap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(list);
      for (const s of list) {
        const mSnap = await getDoc(doc(db, "students", s.id, "marks", selectedSubject));
        if (mSnap.exists()) {
          const m = mSnap.data();
          ["t1", "m1", "t2", "m2", "exam"].forEach(f => {
            const el = document.getElementById(`${f}-${s.id}`) as HTMLInputElement;
            if (el) el.value = m[f] || "";
          });
        }
      }
    };
    load();
  }, [selectedClass, selectedSubject]);

  const save = async (sid: string, field: string, val: string) => {
    if (!val) return;
    const target = selectedClass === "P6" ? 100 : 50;
    const final = Math.round((Number(val) / outOf) * target);
    await setDoc(doc(db, "students", sid, "marks", selectedSubject), { [field]: final }, { merge: true });
  };

  if (!user) return <div className="p-10 font-bold uppercase">Please login to access...</div>;

  return (
    <div className="min-h-screen">
      <div className="bg-blue-900 text-white p-4 flex justify-between sticky top-0 z-50">
        <div className="flex gap-2">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="text-black text-xs p-1 font-bold">
            {config.classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="text-black text-xs p-1 font-bold">
            {config.subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-[10px] font-bold">PAPER OUT OF: <input type="number" value={outOf} onChange={(e) => setOutOf(Number(e.target.value))} className="w-8 text-black" /></div>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-200 uppercase"><tr><th className="p-2 border">Name</th>{["t1", "m1", "t2", "m2", "exam"].map(h => <th key={h} className="border p-2">{h}</th>)}</tr></thead>
        <tbody>
          {students.map((s, idx) => (
            <tr key={s.id} className="border-b">
              <td className="p-2 font-bold uppercase">{s.name}</td>
              {["t1", "m1", "t2", "m2", "exam"].map(f => (
                <td key={f} className="p-0 border">
                  <input id={`${f}-${s.id}`} type="number" onBlur={(e) => save(s.id, f, e.target.value)} onKeyDown={(e) => {if(e.key==="Enter") document.getElementById(`${f}-${students[idx+1]?.id}`)?.focus();}} className="w-full p-2 text-center" placeholder={`/${outOf}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}