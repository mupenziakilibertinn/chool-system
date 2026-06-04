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

        // Fetch marks for all documents
        const mMatrix: Record<string, any> = {};
        await Promise.all(sList.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          mMatrix[student.id] = {};
          mSnap.forEach(docSnap => {
            mMatrix[student.id][docSnap.id] = docSnap.data();
          });
        }));
        setMarks(mMatrix);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [selectedClass, selectedSubject]);

  // 3. Save a cell directly to Firestore (onBlur)
  const handleCellBlur = async (studentId: string, subjectKey: string, assessmentKey: string, rawValue: string) => {
    const dbFieldKey = `${selectedTerm}_${assessmentKey}`;
    
    // Set validation limits dynamically
    let maxLimit = 50;
    if (subjectKey === "CreativeArts" || subjectKey === "Sports") {
      maxLimit = 5; // Enforce Test /5 and Exam /5 max boundaries
    } else if (subjectKey === "French" && selectedClass !== "P6") {
      maxLimit = 25;
    } else if (assessmentKey === "exam") {
      maxLimit = 100; 
    }

    let processedValue: any = rawValue.trim();
    if (processedValue === "") {
      processedValue = "-";
    } else {
      const parsed = Number(processedValue);
      if (isNaN(parsed) || parsed < 0 || parsed > maxLimit) {
        alert(`Please enter a valid mark between 0 and ${maxLimit}, or leave blank.`);
        return;
      }
      processedValue = parsed;
    }

    setSavingStatus(`${studentId}-${subjectKey}-${assessmentKey}`);

    try {
      const docRef = doc(db, "students", studentId, "marks", subjectKey);
      await setDoc(docRef, { [dbFieldKey]: processedValue }, { merge: true });
      
      // Keep local state in sync
      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [subjectKey]: {
            ...(prev[studentId]?.[subjectKey] || {}),
            [dbFieldKey]: processedValue
          }
        }
      }));
    } catch (err) {
      console.error("Failed saving mark:", err);
    } finally {
      setSavingStatus(null);
    }
  };

  if (loading) return <div className="p-10 text-center font-black text-blue-900 tracking-widest text-xs">VERIFYING TEACHER PROFILE...</div>;

  // Security Check: Verify if this specific teacher is registered as the main Class Teacher for the viewed group
  const isAuthorizedClassTeacher = teacherData?.classTeacherOf?.toUpperCase() === selectedClass.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs pb-20">
      
      {/* Top Banner with Teacher's Name */}
      <div className="bg-blue-900 text-white px-6 py-2 flex justify-between items-center font-black uppercase tracking-wider">
        <div>
          Teacher Dashboard: <span className="text-yellow-400">{teacherData?.name || "Mupenzi Akili Bertin"}</span>
        </div>
        <div className="text-[10px] text-blue-200">
          New Generation School Portal
        </div>
      </div>

      {/* Navigation Top Bar Controls */}
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

      {/* Main Work Area */}
      <div className="max-w-7xl mx-auto p-4 mt-6 space-y-8">
        
        {/* SECTION 1: MAIN SUBJECT MARKS MATRIX */}
        <div className="bg-white border-4 border-black rounded-xl p-6 shadow-md">
          <div className="border-b-2 pb-2 mb-4 flex justify-between items-center">
            <h1 className="text-sm font-black text-blue-900 uppercase tracking-wider">
              1. ACADEMIC MARKS FOR {selectedSubject.toUpperCase()} ({selectedClass})
            </h1>
            <span className="text-[10px] font-black bg-blue-50 text-blue-900 px-3 py-1 rounded-full uppercase">
              {selectedTerm.toUpperCase()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border-4 border-black text-sm font-black">
              <thead className="bg-gray-100 border-b-4 border-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 border-r-4 border-black text-left w-[30%]">Student Name</th>
                  <th className="p-3 border-r-2 border-black bg-blue-50/40">Test 1 (/50)</th>
                  <th className="p-3 border-r-2 border-black bg-blue-50/40">Mid-Term 1 (/50)</th>
                  <th className="p-3 border-r-2 border-black bg-green-50/40">Test 2 (/50)</th>
                  <th className="p-3 border-r-4 border-black bg-green-50/40">Mid-Term 2 (/50)</th>
                  <th className="p-3 bg-yellow-50/50 text-blue-900">Final Exam (/100)</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const subjectData = marks[student.id]?.[selectedSubject] || {};
                  
                  const t1 = subjectData[`${selectedTerm}_t1`] === "-" ? "" : subjectData[`${selectedTerm}_t1`] ?? "";
                  const m1 = subjectData[`${selectedTerm}_m1`] === "-" ? "" : subjectData[`${selectedTerm}_m1`] ?? "";
                  const t2 = subjectData[`${selectedTerm}_t2`] === "-" ? "" : subjectData[`${selectedTerm}_t2`] ?? "";
                  const m2 = subjectData[`${selectedTerm}_m2`] === "-" ? "" : subjectData[`${selectedTerm}_m2`] ?? "";
                  const exam = subjectData[`${selectedTerm}_exam`] === "-" ? "" : subjectData[`${selectedTerm}_exam`] ?? "";

                  return (
                    <tr key={student.id} className="border-b-2 border-black text-gray-900 text-[13px] font-black hover:bg-gray-50/60 transition-all">
                      <td className="p-3 border-r-4 border-black text-left uppercase text-blue-950">
                        {index + 1}. {student.name}
                      </td>
                      
                      {/* Test 1 */}
                      <td className="p-2 border-r-2 border-black text-center">
                        <input type="text" defaultValue={t1} placeholder="-" onBlur={(e) => handleCellBlur(student.id, selectedSubject, "t1", e.target.value)} className="w-16 p-1 text-center font-bold font-serif border border-gray-300 rounded focus:border-blue-900 outline-none" />
                        <div className="text-[8px] text-gray-400 font-sans">{savingStatus === `${student.id}-${selectedSubject}-t1` ? "Saving..." : ""}</div>
                      </td>

                      {/* Mid 1 */}
                      <td className="p-2 border-r-2 border-black text-center">
                        <input type="text" defaultValue={m1} placeholder="-" onBlur={(e) => handleCellBlur(student.id, selectedSubject, "m1", e.target.value)} className="w-16 p-1 text-center font-bold font-serif border border-gray-300 rounded focus:border-blue-900 outline-none" />
                        <div className="text-[8px] text-gray-400 font-sans">{savingStatus === `${student.id}-${selectedSubject}-m1` ? "Saving..." : ""}</div>
                      </td>

                      {/* Test 2 */}
                      <td className="p-2 border-r-2 border-black text-center">
                        <input type="text" defaultValue={t2} placeholder="-" onBlur={(e) => handleCellBlur(student.id, selectedSubject, "t2", e.target.value)} className="w-16 p-1 text-center font-bold font-serif border border-gray-300 rounded focus:border-green-800 outline-none" />
                        <div className="text-[8px] text-gray-400 font-sans">{savingStatus === `${student.id}-${selectedSubject}-t2` ? "Saving..." : ""}</div>
                      </td>

                      {/* Mid 2 */}
                      <td className="p-2 border-r-4 border-black text-center">
                        <input type="text" defaultValue={m2} placeholder="-" onBlur={(e) => handleCellBlur(student.id, selectedSubject, "m2", e.target.value)} className="w-16 p-1 text-center font-bold font-serif border border-gray-300 rounded focus:border-green-800 outline-none" />
                        <div className="text-[8px] text-gray-400 font-sans">{savingStatus === `${student.id}-${selectedSubject}-m2` ? "Saving..." : ""}</div>
                      </td>

                      {/* Final Exam */}
                      <td className="p-2 bg-yellow-50/20 text-center">
                        <input type="text" defaultValue={exam} placeholder="-" onBlur={(e) => handleCellBlur(student.id, selectedSubject, "exam", e.target.value)} className="w-20 p-1 text-center font-bold font-serif border-2 border-yellow-600 rounded bg-white focus:ring-2 focus:ring-yellow-600 outline-none" />
                        <div className="text-[8px] text-yellow-600 font-sans">{savingStatus === `${student.id}-${selectedSubject}-exam` ? "Saving..." : ""}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: SPORTS & CREATIVE ARTS LEDGER - PRIVATE CLASS TEACHER VIEW ONLY */}
        {isAuthorizedClassTeacher ? (
          <div className="bg-white border-4 border-black rounded-xl p-6 shadow-md animate-fadeIn">
            <div className="border-b-2 pb-2 mb-4 flex justify-between items-center">
              <div>
                <h1 className="text-sm font-black text-green-800 uppercase tracking-wider">
                  2. SPORTS & CREATIVE ARTS ASSESSMENT GRADES
                </h1>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">Authorized View: Class Teacher Only. Maximum marks: Test (/5) + Exam (/5) = Total /10.</p>
              </div>
              <span className="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-black uppercase">Main Teacher Access Only</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse border-4 border-black text-sm font-black">
                <thead className="bg-gray-100 border-b-4 border-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th rowSpan={2} className="p-3 border-r-4 border-black text-left w-[30%]">Student Name</th>
                    <th colSpan={3} className="p-2 border-r-4 border-black bg-purple-50 text-purple-900 border-b-2">Creative Arts</th>
                    <th colSpan={3} className="p-2 bg-orange-50 text-orange-900 border-b-2">Physical Education & Sports</th>
                  </tr>
                  <tr>
                    <th className="p-1.5 border-r-2 border-black bg-purple-50/60 font-black text-[9px]">Test (/5)</th>
                    <th className="p-1.5 border-r-2 border-black bg-purple-50/60 font-black text-[9px]">Exam (/5)</th>
                    <th className="p-1.5 border-r-4 border-black bg-purple-100 text-purple-950 font-black text-[10px]">Total (/10)</th>
                    <th className="p-1.5 border-r-2 border-black bg-orange-50/60 font-black text-[9px]">Test (/5)</th>
                    <th className="p-1.5 border-r-2 border-black bg-orange-50/60 font-black text-[9px]">Exam (/5)</th>
                    <th className="p-1.5 bg-orange-100 text-orange-950 font-black text-[10px]">Total (/10)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => {
                    const artsData = marks[student.id]?.["CreativeArts"] || {};
                    const sportsData = marks[student.id]?.["Sports"] || {};

                    const artTest = artsData[`${selectedTerm}_t1`] === "-" ? "" : artsData[`${selectedTerm}_t1`] ?? "";
                    const artExam = artsData[`${selectedTerm}_exam`] === "-" ? "" : artsData[`${selectedTerm}_exam`] ?? "";
                    
                    const sportTest = sportsData[`${selectedTerm}_t1`] === "-" ? "" : sportsData[`${selectedTerm}_t1`] ?? "";
                    const sportExam = sportsData[`${selectedTerm}_exam`] === "-" ? "" : sportsData[`${selectedTerm}_exam`] ?? "";

                    // Calculate totals safely
                    const artTotal = (typeof artTest === "number" ? artTest : 0) + (typeof artExam === "number" ? artExam : 0);
                    const sportTotal = (typeof sportTest === "number" ? sportTest : 0) + (typeof sportExam === "number" ? sportExam : 0);

                    const hasArtsData = artTest !== "" || artExam !== "";
                    const hasSportsData = sportTest !== "" || sportExam !== "";

                    return (
                      <tr key={`co-${student.id}`} className="border-b-2 border-black text-gray-900 text-[13px] font-black hover:bg-gray-50/60 transition-all">
                        <td className="p-3 border-r-4 border-black text-left uppercase text-gray-700">
                          {index + 1}. {student.name}
                        </td>

                        {/* Creative Arts fields */}
                        <td className="p-1 border-r-2 border-black bg-purple-50/10 text-center">
                          <input type="text" defaultValue={artTest} placeholder="-" onBlur={(e) => handleCellBlur(student.id, "CreativeArts", "t1", e.target.value)} className="w-12 p-1 text-center font-bold font-serif border border-purple-300 rounded focus:border-purple-800 outline-none text-xs" />
                          <div className="text-[7px] text-purple-600 font-sans">{savingStatus === `${student.id}-CreativeArts-t1` ? "Saving..." : ""}</div>
                        </td>
                        <td className="p-1 border-r-2 border-black bg-purple-50/10 text-center">
                          <input type="text" defaultValue={artExam} placeholder="-" onBlur={(e) => handleCellBlur(student.id, "CreativeArts", "exam", e.target.value)} className="w-12 p-1 text-center font-bold font-serif border border-purple-300 rounded focus:border-purple-800 outline-none text-xs" />
                          <div className="text-[7px] text-purple-600 font-sans">{savingStatus === `${student.id}-CreativeArts-exam` ? "Saving..." : ""}</div>
                        </td>
                        <td className="p-1 border-r-4 border-black bg-purple-100/50 text-center font-black font-serif text-purple-950 text-sm">
                          {hasArtsData ? artTotal : "-"}
                        </td>

                        {/* Sports fields */}
                        <td className="p-1 border-r-2 border-black bg-orange-50/10 text-center">
                          <input type="text" defaultValue={sportTest} placeholder="-" onBlur={(e) => handleCellBlur(student.id, "Sports", "t1", e.target.value)} className="w-12 p-1 text-center font-bold font-serif border border-orange-300 rounded focus:border-orange-800 outline-none text-xs" />
                          <div className="text-[7px] text-orange-600 font-sans">{savingStatus === `${student.id}-Sports-t1` ? "Saving..." : ""}</div>
                        </td>
                        <td className="p-1 border-r-2 border-black bg-orange-50/10 text-center">
                          <input type="text" defaultValue={sportExam} placeholder="-" onBlur={(e) => handleCellBlur(student.id, "Sports", "exam", e.target.value)} className="w-12 p-1 text-center font-bold font-serif border border-orange-300 rounded focus:border-orange-800 outline-none text-xs" />
                          <div className="text-[7px] text-orange-600 font-sans">{savingStatus === `${student.id}-Sports-exam` ? "Saving..." : ""}</div>
                        </td>
                        <td className="p-1 bg-orange-100/50 text-center font-black font-serif text-orange-950 text-sm">
                          {hasSportsData ? sportTotal : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-4 border-dashed border-amber-400 rounded-xl p-4 text-center font-black text-amber-800 uppercase tracking-wider text-[11px]">
            🔒 Sports & Creative Arts entry ledger is locked. Only visible to the assigned Class Teacher of {selectedClass}.
          </div>
        )}

      </div>
    </div>
  );
}