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
          
          // Determine initial default class display safely
          if (tInfo.isAdmin) {
            setSelectedClass("P6");
          } else if (tInfo.allocations && tInfo.allocations.length > 0) {
            setSelectedClass(tInfo.allocations[0].class);
          } else if (tInfo.classes && tInfo.classes.length > 0) {
            setSelectedClass(tInfo.classes[0]);
          } else {
            setSelectedClass("P1");
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadClassMarks();
    }
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
        mSnap.forEach(docSnap => {
          currentMarks[st.id][docSnap.id] = docSnap.data();
        });
      }));
      setMarks(currentMarks);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleInputChange = (studentId: string, subject: string, field: string, val: string) => {
    setMarks((prev: any) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: {
          ...prev[studentId]?.[subject],
          [`${selectedTerm}_${field}`]: val
        }
      }
    }));
  };

  const saveSubjectMarks = async (subject: string) => {
    try {
      await Promise.all(students.map(async (st) => {
        const subData = marks[st.id]?.[subject] || {};
        const tKey = `${selectedTerm}_t1`;
        const mKey = `${selectedTerm}_m1`;
        
        // Save using merge to protect scores recorded in other terms!
        await setDoc(doc(db, "students", st.id, "marks", subject), {
          ...subData,
          [tKey]: Number(subData[tKey] || 0),
          [mKey]: Number(subData[mKey] || 0)
        }, { merge: true });
      }));
      alert(`✅ saved scores successfully for ${subject} (${selectedTerm.toUpperCase()})!`);
    } catch (err: any) {
      alert("Database error: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold uppercase tracking-wider text-blue-900">Syncing Evaluation Data Matrix...</div>;
  if (!teacherData) return <div className="p-10 text-center text-red-500 font-bold uppercase">ACCESS RESTRICTED.</div>;

  // Compute what classes and lessons this specific teacher is allowed to see
  let classesToDisplay: string[] = [];
  let subjectsToDisplay: string[] = [];

  if (teacherData.isAdmin) {
    classesToDisplay = allSystemClasses;
    subjectsToDisplay = allSystemSubjects;
  } else {
    const allocs = teacherData.allocations || [];
    classesToDisplay = Array.from(new Set(allocs.map((a: any) => a.class)));
    subjectsToDisplay = allocs.filter((a: any) => a.class === selectedClass).map((a: any) => a.subject);
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-xs font-sans text-gray-800">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-base font-black text-blue-900 uppercase tracking-wide mb-1">
          Terminal Mark Input Matrix {teacherData.isAdmin && "(ADMIN MASTER)"}
        </h1>
        <p className="text-gray-400 font-bold uppercase text-[9px] mb-4">Account Profile: {userEmail}</p>

        <div className="mb-6 flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-xl border">
          <div>
            <span className="font-black uppercase text-gray-500 mr-2">Choose Class:</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 rounded-lg font-black bg-white text-blue-900 text-xs">
              {classesToDisplay.length === 0 ? (
                <option value="">No Classes Assigned</option>
              ) : (
                classesToDisplay.map((c: string) => <option key={c} value={c}>{c}</option>)
              )}
            </select>
          </div>
          <div>
            <span className="font-black uppercase text-gray-500 mr-2">Target Academic Term:</span>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 border-green-600 rounded-lg font-black bg-white text-green-700 text-xs">
              <option value="term1">TERM 1</option>
              <option value="term2">TERM 2</option>
              <option value="term3">TERM 3</option>
            </select>
          </div>
        </div>

        {subjectsToDisplay.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-bold italic border-2 border-dashed rounded-xl bg-gray-50">
            No active lessons mapped to your profile for level {selectedClass}. Check Admin settings.
          </div>
        ) : (
          subjectsToDisplay.map((sub: string) => {
            if (selectedClass === "P6" && sub === "French") return null; 
            const maxVal = sub === "French" ? 25 : 50;

            return (
              <div key={sub} className="mb-8 border border-gray-200 p-4 rounded-xl bg-white shadow-sm">
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h2 className="text-xs font-black text-blue-900 uppercase tracking-wide">{sub} &mdash; {selectedTerm.toUpperCase()}</h2>
                  <button onClick={() => saveSubjectMarks(sub)} className="bg-blue-900 hover:bg-green-600 text-white font-black px-4 py-2 rounded-lg uppercase text-[10px] tracking-wider transition-colors shadow-sm">
                    Save {sub} Marks
                  </button>
                </div>

                <table className="w-full text-left border font-bold text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 font-black uppercase border-b text-gray-500 text-[9px]">
                      <th className="p-2 w-1/2 border-r">Pupil Name</th>
                      <th className="p-2 text-center border-r">Test Score (/{maxVal})</th>
                      <th className="p-2 text-center">Mid-Term Score (/{maxVal})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(st => {
                      const stMarks = marks[st.id]?.[sub] || {};
                      return (
                        <tr key={st.id} className="border-b uppercase hover:bg-gray-50/50">
                          <td className="p-2 font-black text-gray-900 border-r">{st.name}</td>
                          <td className="p-2 text-center border-r">
                            <input type="number" min="0" max={maxVal} value={stMarks[`${selectedTerm}_t1`] ?? ""} onChange={(e) => handleInputChange(st.id, sub, "t1", e.target.value)} className="border-2 border-gray-300 rounded p-1 w-20 text-center font-bold bg-gray-50" />
                          </td>
                          <td className="p-2 text-center">
                            <input type="number" min="0" max={maxVal} value={stMarks[`${selectedTerm}_m1`] ?? ""} onChange={(e) => handleInputChange(st.id, sub, "m1", e.target.value)} className="border-2 border-gray-300 rounded p-1 w-20 text-center font-bold bg-gray-50" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}