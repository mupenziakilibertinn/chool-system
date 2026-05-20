"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const allSystemSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const allSystemClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

export default function MarksEntryPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("term1"); // term1, term2, term3
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        const docSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", user.email.toLowerCase())));
        if (!docSnap.empty) {
          const tInfo = docSnap.docs[0].data();
          setTeacherData(tInfo);
          setSelectedClass(tInfo.classes && tInfo.classes.length > 0 ? tInfo.classes[0] : "P1");
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedTerm) {
      loadClassMarks();
    }
  }, [selectedClass, selectedTerm]);

  const loadClassMarks = async () => {
    setLoading(true);
    const q = query(collection(db, "students"), where("class", "==", selectedClass));
    const studentSnap = await getDocs(q);
    const sList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setStudents(sList);

    let currentMarks: any = {};
    await Promise.all(sList.map(async (st) => {
      currentMarks[st.id] = {};
      const mSnap = await getDocs(collection(db, "students", st.id, "marks"));
      mSnap.forEach(docSnap => {
        currentMarks[st.id][docSnap.id] = docSnap.data();
      });
    }));
    setMarks(currentMarks);
    setLoading(false);
  };

  const handleInputChange = (studentId: string, subject: string, field: string, val: string) => {
    setMarks({
      ...marks,
      [studentId]: {
        ...marks[studentId],
        [subject]: {
          ...marks[studentId]?.[subject],
          [`${selectedTerm}_${field}`]: val
        }
      }
    });
  };

  const saveSubjectMarks = async (subject: string) => {
    try {
      await Promise.all(students.map(async (st) => {
        const subData = marks[st.id]?.[subject] || {};
        const tKey = `${selectedTerm}_t1`;
        const mKey = `${selectedTerm}_m1`;
        
        await setDoc(doc(db, "students", st.id, "marks", subject), {
          ...subData,
          [tKey]: Number(subData[tKey] || 0),
          [mKey]: Number(subData[mKey] || 0)
        }, { merge: true });
      }));
      alert(`✅ ${subject} marks saved for ${selectedTerm.toUpperCase()}!`);
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold">LOADING LESSON SCHEDULER...</div>;
  if (!teacherData) return <div className="p-10 text-center text-red-500 font-bold">ACCESS DENIED.</div>;

  const accessibleClasses = teacherData.isAdmin ? allSystemClasses : teacherData.classes;
  const accessibleSubjects = teacherData.isAdmin ? allSystemSubjects : teacherData.subjects;
  const maxMark = selectedClass === "P6" ? 50 : 25;

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-xs font-sans">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-2xl shadow-sm border">
        <h1 className="text-sm font-black text-blue-900 uppercase tracking-wider mb-1">
          Terminal Evaluation Matrix {teacherData.isAdmin && "(ADMIN)"}
        </h1>
        <p className="text-gray-400 font-bold uppercase text-[9px] mb-4">Account: {userEmail}</p>

        <div className="mb-4 flex gap-4 items-center bg-gray-50 p-3 rounded-xl border">
          <div>
            <span className="font-bold uppercase text-gray-500 mr-2">Class:</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border rounded-xl font-bold bg-white text-blue-900">
              {accessibleClasses.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="font-bold uppercase text-gray-500 mr-2">Active Recording Term:</span>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border border-green-600 rounded-xl font-black bg-white text-green-700">
              <option value="term1">TERM 1</option>
              <option value="term2">TERM 2</option>
              <option value="term3">TERM 3</option>
            </select>
          </div>
        </div>

        {accessibleSubjects.map((sub: string) => {
          if (selectedClass === "P6" && sub === "French") return null; 
          const currentMax = sub === "French" ? 25 : 50;

          return (
            <div key={sub} className="mb-8 border p-4 rounded-xl bg-gray-50">
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <h2 className="text-xs font-black text-blue-950 uppercase tracking-wide">{sub} — {selectedTerm.toUpperCase()}</h2>
                <button onClick={() => saveSubjectMarks(sub)} className="bg-blue-900 hover:bg-green-600 text-white font-black px-4 py-1.5 rounded-lg uppercase text-[9px]">
                  Save {sub} Marks
                </button>
              </div>

              <table className="w-full text-left bg-white border font-bold text-gray-700">
                <thead>
                  <tr className="bg-gray-100 font-black uppercase border-b text-gray-500 text-[9px]">
                    <th className="p-2 w-1/2">Student Name</th>
                    <th className="p-2 text-center">Test Score (/{currentMax})</th>
                    <th className="p-2 text-center">Mid-Term Score (/{currentMax})</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(st => {
                    const stMarks = marks[st.id]?.[sub] || {};
                    return (
                      <tr key={st.id} className="border-b uppercase">
                        <td className="p-2 font-black text-gray-900">{st.name}</td>
                        <td className="p-2 text-center">
                          <input type="number" min="0" max={currentMax} value={stMarks[`${selectedTerm}_t1`] ?? ""} onChange={(e) => handleInputChange(st.id, sub, "t1", e.target.value)} className="border p-1 w-16 text-center rounded bg-gray-50" />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" min="0" max={currentMax} value={stMarks[`${selectedTerm}_m1`] ?? ""} onChange={(e) => handleInputChange(st.id, sub, "m1", e.target.value)} className="border p-1 w-16 text-center rounded bg-gray-50" />
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