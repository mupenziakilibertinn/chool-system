"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

const allSystemSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function MarksEntryPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("term1"); 
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const inputsRef = useRef<any>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        const docSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", user.email.toLowerCase())));
        if (!docSnap.empty) {
          const tInfo = docSnap.docs[0].data();
          setTeacherData(tInfo);
          setSelectedClass(tInfo.allocations?.[0]?.class || tInfo.classTeacherOf || "P1");
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClass) loadClassMarks();
  }, [selectedClass]);

  const loadClassMarks = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const studentSnap = await getDocs(q);
      const sList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(sList);

      let currentMarks: any = {};
      await Promise.all(sList.map(async (st) => {
        currentMarks[st.id] = {};
        const mSnap = await getDocs(collection(db, "students", st.id, "marks"));
        mSnap.forEach(docSnap => { currentMarks[st.id][docSnap.id] = docSnap.data(); });
      }));
      setMarks(currentMarks);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleInputChange = (studentId: string, studentIndex: number, subject: string, field: string, value: string) => {
    const maxLimit = (selectedClass !== "P6" && subject === "French") ? 25 : 50;

    if (value.includes("\n") || value.includes("\t")) {
      const scoresArray = value.split(/[\n\t]+/).map(s => s.trim()).filter(s => s !== "");
      setMarks((prev: any) => {
        const updated = { ...prev };
        scoresArray.forEach((scoreVal, arrayIdx) => {
          const targetStudent = students[studentIndex + arrayIdx];
          if (targetStudent) {
            if (Number(scoreVal) > maxLimit) return;
            if (!updated[targetStudent.id]) updated[targetStudent.id] = {};
            if (!updated[targetStudent.id][subject]) updated[targetStudent.id][subject] = {};
            updated[targetStudent.id][subject][`${selectedTerm}_${field}`] = scoreVal;
          }
        });
        return updated;
      });
      return;
    }

    if (Number(value) > maxLimit) {
      alert(`❌ CEILING EXCEEDED: Marks cannot be greater than ${maxLimit}!`);
      return;
    }

    setMarks((prev: any) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: { ...prev[studentId]?.[subject], [`${selectedTerm}_${field}`]: value }
      }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string, subject: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInputId = `${index + 1}_${field}_${subject}`;
      if (inputsRef.current[nextInputId]) {
        inputsRef.current[nextInputId].focus();
        inputsRef.current[nextInputId].select();
      }
    }
  };

  const saveSubjectMarks = async (subject: string) => {
    try {
      await Promise.all(students.map(async (st) => {
        const subData = marks[st.id]?.[subject] || {};
        await setDoc(doc(db, "students", st.id, "marks", subject), {
          ...subData,
          [`${selectedTerm}_t1`]: Number(subData[`${selectedTerm}_t1`] || 0),
          [`${selectedTerm}_m1`]: Number(subData[`${selectedTerm}_m1`] || 0),
          [`${selectedTerm}_t2`]: Number(subData[`${selectedTerm}_t2`] || 0),
          [`${selectedTerm}_m2`]: Number(subData[`${selectedTerm}_m2`] || 0),
        }, { merge: true });
      }));
      alert(`✅ Marks saved for ${subject}!`);
    } catch (err: any) { alert("Error: " + err.message); }
  };

  if (loading) return <div className="p-10 text-center font-bold text-blue-900 uppercase">Loading Data Matrix...</div>;
  if (!teacherData) return <div className="p-10 text-center text-red-500 font-bold uppercase">DENIED.</div>;

  const isClassTeacher = teacherData.classTeacherOf && teacherData.classTeacherOf !== "None";
  const subjectsToDisplay = teacherData.isAdmin ? allSystemSubjects : (teacherData.allocations || []).filter((a: any) => a.class === selectedClass).map((a: any) => a.subject);

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-xs font-sans text-gray-800">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <h1 className="text-base font-black text-blue-900 uppercase">NGS Faculty Entry Deck</h1>
            <p className="text-gray-400 font-bold uppercase text-[9px]">Logged in as: {userEmail}</p>
          </div>
          {isClassTeacher && (
            <button onClick={() => router.push("/admin?tab=reports")} className="bg-green-700 hover:bg-black text-white font-black px-4 py-2.5 rounded-xl uppercase text-[10px] tracking-wider transition-all shadow">
              📋 Print Class Report Cards ({teacherData.classTeacherOf})
            </button>
          )}
        </div>

        <div className="mb-6 flex gap-4 items-center bg-gray-50 p-4 rounded-xl border">
          <div>
            <span className="font-black uppercase text-gray-500 mr-2">Stream:</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 rounded-lg font-black bg-white text-blue-900 text-xs">
              {Array.from(new Set((teacherData.allocations || []).map((a: any) => a.class).concat(isClassTeacher ? [teacherData.classTeacherOf] : []))).map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="font-black uppercase text-gray-500 mr-2">Academic Term:</span>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 border-green-600 rounded-lg font-black bg-white text-green-700 text-xs">
              <option value="term1">TERM 1</option>
              <option value="term2">TERM 2</option>
              <option value="term3">TERM 3</option>
            </select>
          </div>
        </div>

        {subjectsToDisplay.map((sub: string) => {
          if (selectedClass === "P6" && sub === "French") return null;
          const maxVal = (selectedClass !== "P6" && sub === "French") ? 25 : 50;

          return (
            <div key={sub} className="mb-8 border p-4 rounded-xl bg-white shadow-sm overflow-x-auto">
              <div className="flex justify-between items-center mb-3 border-b pb-2 min-w-[600px]">
                <h2 className="text-xs font-black text-blue-900 uppercase">{sub} &mdash; {selectedTerm.toUpperCase()}</h2>
                <button onClick={() => saveSubjectMarks(sub)} className="bg-blue-900 text-white font-black px-4 py-2 rounded-lg uppercase text-[10px]">Save {sub}</button>
              </div>
              <table className="w-full text-left font-bold text-gray-700 min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 uppercase text-[8px] text-gray-500 border-b text-center">
                    <th className="p-2 text-left border-r w-1/3">Pupil Name</th>
                    <th className="p-2 border-r bg-blue-50/50" colSpan={2}>MID-TERM ASSESSMENT 1</th>
                    <th className="p-2 bg-green-50/50" colSpan={2}>MID-TERM ASSESSMENT 2</th>
                  </tr>
                  <tr className="bg-gray-100 uppercase text-[8px] text-gray-400 border-b text-center">
                    <th className="p-2 text-left border-r"></th>
                    <th className="p-1 border-r">Test 1 (/{maxVal})</th>
                    <th className="p-1 border-r">Mid 1 (/{maxVal})</th>
                    <th className="p-1 border-r">Test 2 (/{maxVal})</th>
                    <th className="p-1">Mid 2 (/{maxVal})</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, sIdx) => {
                    const stMarks = marks[st.id]?.[sub] || {};
                    return (
                      <tr key={st.id} className="border-b uppercase text-center">
                        <td className="p-2 font-black text-gray-900 text-left border-r">{st.name}</td>
                        <td className="p-1 border-r">
                          <input ref={el => { inputsRef.current[`${sIdx}_t1_${sub}`] = el; }} type="text" value={stMarks[`${selectedTerm}_t1`] ?? ""} onKeyDown={(e) => handleKeyDown(e, sIdx, "t1", sub)} onChange={(e) => handleInputChange(st.id, sIdx, sub, "t1", e.target.value)} className="border rounded p-1 w-16 text-center font-bold bg-gray-50 outline-none" />
                        </td>
                        <td className="p-1 border-r">
                          <input ref={el => { inputsRef.current[`${sIdx}_m1_${sub}`] = el; }} type="text" value={stMarks[`${selectedTerm}_m1`] ?? ""} onKeyDown={(e) => handleKeyDown(e, sIdx, "m1", sub)} onChange={(e) => handleInputChange(st.id, sIdx, sub, "m1", e.target.value)} className="border rounded p-1 w-16 text-center font-bold bg-gray-50 outline-none" />
                        </td>
                        <td className="p-1 border-r">
                          <input ref={el => { inputsRef.current[`${sIdx}_t2_${sub}`] = el; }} type="text" value={stMarks[`${selectedTerm}_t2`] ?? ""} onKeyDown={(e) => handleKeyDown(e, sIdx, "t2", sub)} onChange={(e) => handleInputChange(st.id, sIdx, sub, "t2", e.target.value)} className="border rounded p-1 w-16 text-center font-bold bg-gray-50 outline-none" />
                        </td>
                        <td className="p-1">
                          <input ref={el => { inputsRef.current[`${sIdx}_m2_${sub}`] = el; }} type="text" value={stMarks[`${selectedTerm}_m2`] ?? ""} onKeyDown={(e) => handleKeyDown(e, sIdx, "m2", sub)} onChange={(e) => handleInputChange(st.id, sIdx, sub, "m2", e.target.value)} className="border rounded p-1 w-16 text-center font-bold bg-gray-50 outline-none" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}