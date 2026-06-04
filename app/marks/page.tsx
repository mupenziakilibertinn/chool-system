"use client";

import { useEffect, useState } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, doc, getDocs, setDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  class: string;
}

export default function TeacherMarksDashboard() {
  const [user, setUser] = useState<any>(null);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, any>>({});
  
  // Selection states
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("term1");
  
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const router = useRouter();

  // 1. Authenticate Teacher and check assignments
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const q = query(collection(db, "teachers"), where("email", "==", currentUser.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setTeacherData(data);
          
          // Auto-select the first assigned class and subject
          if (data.classes && data.classes.length > 0) setSelectedClass(data.classes[0].toUpperCase());
          if (data.subjects && data.subjects.length > 0) setSelectedSubject(data.subjects[0]);
        }
      } catch (err) {
        console.error("Error verifying teacher assignment:", err);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch students and marks matrix for the selected class/subject
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;

    const fetchData = async () => {
      try {
        // Fetch students belonging to the class
        const sSnap = await getDocs(collection(db, "students"));
        const sList = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) } as Student))
          .filter(s => s.class?.toUpperCase() === selectedClass.toUpperCase());
        
        sList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(sList);

        // Fetch marks for the selected subject only
        const mMatrix: Record<string, any> = {};
        await Promise.all(sList.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          mMatrix[student.id] = {};
          mSnap.forEach(docSnap => {
            if (docSnap.id === selectedSubject) {
              mMatrix[student.id] = docSnap.data();
            }
          });
        }));
        setMarks(mMatrix);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [selectedClass, selectedSubject]);

  // 3. Save a cell directly to Firestore when the teacher clicks away (onBlur)
  const handleCellBlur = async (studentId: string, assessmentKey: string, rawValue: string) => {
    // Standardized cloud schema: e.g., term1_t1, term1_m1, term1_t2, term1_m2
    const dbFieldKey = `${selectedTerm}_${assessmentKey}`;
    
    // Determine subject maximum based on stream limits (French exception)
    const isFrenchP1P5 = selectedSubject === "French" && selectedClass !== "P6";
    const maxLimit = isFrenchP1P5 ? 25 : 50;

    let processedValue: any = rawValue.trim();
    if (processedValue === "") {
      processedValue = "-";
    } else {
      const parsed = Number(processedValue);
      if (isNaN(parsed) || parsed < 0 || parsed > maxLimit) {
        alert(`Please enter a valid mark between 0 and ${maxLimit}, or leave it blank.`);
        return;
      }
      processedValue = parsed;
    }

    setSavingStatus(`${studentId}-${assessmentKey}`);

    try {
      const docRef = doc(db, "students", studentId, "marks", selectedSubject);
      await setDoc(docRef, { [dbFieldKey]: processedValue }, { merge: true });
      
      // Keep local state in sync
      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [dbFieldKey]: processedValue
        }
      }));
    } catch (err) {
      console.error("Failed saving mark:", err);
    } finally {
      setSavingStatus(null);
    }
  };

  if (loading) return <div className="p-10 text-center font-black text-blue-900 tracking-widest text-xs">VERIFYING TEACHER PROFILE...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs pb-20">
      {/* Navigation Top Bar */}
      <div className="bg-white border-b-2 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Academic Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs">
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>
            
            {teacherData?.classes && (
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Your Assigned Classes</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value.toUpperCase())} className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-900 uppercase">
                  {teacherData.classes.map((c: string) => <option key={c} value={c.toUpperCase()}>{c.toUpperCase()}</option>)}
                </select>
              </div>
            )}

            {teacherData?.subjects && (
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Your Assigned Subjects</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-900">
                  {teacherData.subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/reports?class=${selectedClass.toLowerCase()}`)}
              className="bg-blue-900 hover:bg-blue-950 text-white font-black text-xs uppercase px-5 py-3 rounded-xl transition-all shadow"
            >
              Observe My Class Reports 📋
            </button>
            <button onClick={() => signOut(auth)} className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase px-4 py-3 rounded-xl transition-all">
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Grading Ledger Table */}
      <div className="max-w-6xl mx-auto p-4 mt-6">
        <div className="bg-white border-4 border-black rounded-xl p-6 shadow-md">
          <div className="border-b-2 pb-2 mb-4 flex justify-between items-center">
            <h1 className="text-sm font-black text-blue-900 uppercase tracking-wider">
              NEW GENERATION SCHOOL — {selectedClass} GRADING MATRIX FOR {selectedSubject.toUpperCase()}
            </h1>
            <span className="text-[10px] font-black bg-blue-50 text-blue-900 px-3 py-1 rounded-full uppercase">
              Active Focus: {selectedTerm.toUpperCase()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border-4 border-black text-sm font-black">
              <thead className="bg-gray-100 border-b-4 border-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 border-r-4 border-black text-left w-[40%]">Student Name</th>
                  <th className="p-3 border-r-2 border-black bg-blue-50/40">Test 1</th>
                  <th className="p-3 border-r-4 border-black bg-blue-50/40">Mid-Term 1</th>
                  <th className="p-3 border-r-2 border-black bg-green-50/40">Test 2</th>
                  <th className="p-3 bg-green-50/40">Mid-Term 2</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const studentRecord = marks[student.id] || {};
                  
                  // Retrieve values safely using the exact state namespace strings
                  const t1 = studentRecord[`${selectedTerm}_t1`] === "-" ? "" : studentRecord[`${selectedTerm}_t1`] ?? "";
                  const m1 = studentRecord[`${selectedTerm}_m1`] === "-" ? "" : studentRecord[`${selectedTerm}_m1`] ?? "";
                  const t2 = studentRecord[`${selectedTerm}_t2`] === "-" ? "" : studentRecord[`${selectedTerm}_t2`] ?? "";
                  const m2 = studentRecord[`${selectedTerm}_m2`] === "-" ? "" : studentRecord[`${selectedTerm}_m2`] ?? "";

                  return (
                    <tr key={student.id} className="border-b-2 border-black text-gray-900 text-[13px] font-black hover:bg-gray-50/60 transition-all">
                      <td className="p-3 border-r-4 border-black text-left font-black uppercase text-blue-950">
                        {index + 1}. {student.name}
                      </td>
                      
                      {/* Test 1 */}
                      <td className="p-2 border-r-2 border-black bg-blue-50/10 text-center">
                        <input
                          type="text"
                          defaultValue={t1}
                          placeholder="-"
                          onBlur={(e) => handleCellBlur(student.id, "t1", e.target.value)}
                          className="w-20 p-1 text-center font-bold font-serif bg-transparent border border-gray-300 rounded focus:border-blue-900 focus:bg-white outline-none"
                        />
                        <div className="text-[9px] text-gray-400 font-sans mt-0.5">
                          {savingStatus === `${student.id}-t1` ? "Saving..." : ""}
                        </div>
                      </td>

                      {/* Mid 1 */}
                      <td className="p-2 border-r-4 border-black bg-blue-50/10 text-center">
                        <input
                          type="text"
                          defaultValue={m1}
                          placeholder="-"
                          onBlur={(e) => handleCellBlur(student.id, "m1", e.target.value)}
                          className="w-20 p-1 text-center font-bold font-serif bg-transparent border border-gray-300 rounded focus:border-blue-900 focus:bg-white outline-none"
                        />
                        <div className="text-[9px] text-gray-400 font-sans mt-0.5">
                          {savingStatus === `${student.id}-m1` ? "Saving..." : ""}
                        </div>
                      </td>

                      {/* Test 2 */}
                      <td className="p-2 border-r-2 border-black bg-green-50/10 text-center">
                        <input
                          type="text"
                          defaultValue={t2}
                          placeholder="-"
                          onBlur={(e) => handleCellBlur(student.id, "t2", e.target.value)}
                          className="w-20 p-1 text-center font-bold font-serif bg-transparent border border-gray-300 rounded focus:border-green-800 focus:bg-white outline-none"
                        />
                        <div className="text-[9px] text-gray-400 font-sans mt-0.5">
                          {savingStatus === `${student.id}-t2` ? "Saving..." : ""}
                        </div>
                      </td>

                      {/* Mid 2 */}
                      <td className="p-2 bg-green-50/10 text-center">
                        <input
                          type="text"
                          defaultValue={m2}
                          placeholder="-"
                          onBlur={(e) => handleCellBlur(student.id, "m2", e.target.value)}
                          className="w-20 p-1 text-center font-bold font-serif bg-transparent border border-gray-300 rounded focus:border-green-800 focus:bg-white outline-none"
                        />
                        <div className="text-[9px] text-gray-400 font-sans mt-0.5">
                          {savingStatus === `${student.id}-m2` ? "Saving..." : ""}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {students.length === 0 && (
            <div className="text-center font-black py-8 text-gray-400 uppercase">
              No registered students located for Class Stream {selectedClass}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}