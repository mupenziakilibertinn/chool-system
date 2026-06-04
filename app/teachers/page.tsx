"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  rollNumber: string;
}

export default function TeacherDashboard() {
  const [user, setUser] = useState<any>(null);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, any>>({});
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("term1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      // Fetch teacher assignments
      const q = query(collection(db, "teachers"), where("email", "==", currentUser.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setTeacherData(data);
        if (data.classes && data.classes.length > 0) setSelectedClass(data.classes[0]);
        if (data.subjects && data.subjects.length > 0) setSelectedSubject(data.subjects[0]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;

    const fetchData = async () => {
      // 1. Fetch Students
      const sSnap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
      const sList = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      sList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(sList);

      // 2. Fetch Marks Matrix
      const mMatrix: Record<string, any> = {};
      for (const s of sList) {
        const mSnap = await getDocs(collection(db, "students", s.id, "marks"));
        mSnap.forEach(docSnap => {
          if (docSnap.id === selectedSubject) {
            mMatrix[s.id] = docSnap.data();
          }
        });
      }
      setMarks(mMatrix);
    };

    fetchData();
  }, [selectedClass, selectedSubject]);

  const handleSaveMark = async (studentId: string, assessmentKey: string, rawValue: string, outOf: number) => {
    const dbFieldKey = `${selectedTerm}_${assessmentKey}`; // Production Sync Schema
    const targetMax = selectedClass === "P6" ? 100 : 50;
    
    let processedValue: number | null = null;
    if (rawValue.trim() !== "") {
      const parsed = Number(rawValue);
      if (isNaN(parsed) || parsed < 0 || parsed > outOf) return;
      processedValue = Math.round((parsed / outOf) * targetMax);
    }

    setSaving(`${studentId}-${assessmentKey}`);

    try {
      const docRef = doc(db, "students", studentId, "marks", selectedSubject);
      await setDoc(docRef, { [dbFieldKey]: processedValue }, { merge: true });
      
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
      setSaving(null);
    }
  };

  if (loading) return <div className="p-8 text-center font-medium">Verifying Credentials...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 shadow-sm rounded-lg">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Teacher Grading Portal</h1>
          <p className="text-sm text-gray-500">{user?.email} • {teacherData?.name || "Educator"}</p>
        </div>
        <button onClick={() => signOut(auth)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition">
          Log Out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">Select Term</label>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full p-2 border rounded bg-white">
            <option value="term1">Term 1</option>
            <option value="term2">Term 2</option>
            <option value="term3">Term 3</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">Class Assigned</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full p-2 border rounded bg-white">
            {teacherData?.classes?.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">Subject Assigned</label>
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-2 border rounded bg-white">
            {teacherData?.subjects?.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b text-gray-700 font-medium text-sm">
              <th className="p-3 border-r w-1/4">Student Name</th>
              <th className="p-3 border-r text-center">Test 1 (Out of 40)</th>
              <th className="p-3 border-r text-center">Test 2 (Out of 40)</th>
              <th className="p-3 border-r text-center">Mid-Term (Out of 40)</th>
              <th className="p-3 text-center">Exam (Out of 100)</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const currentRecord = marks[student.id] || {};
              const t1_val = currentRecord[`${selectedTerm}_t1`] ?? "";
              const t2_val = currentRecord[`${selectedTerm}_t2`] ?? "";
              const m1_val = currentRecord[`${selectedTerm}_m1`] ?? "";
              const exam_val = currentRecord[`${selectedTerm}_exam`] ?? "";

              return (
                <tr key={student.id} className="border-b hover:bg-gray-50 transition text-sm">
                  <td className="p-3 border-r font-medium text-gray-800">{student.name}</td>
                  
                  {/* Test 1 */}
                  <td className="p-2 border-r text-center">
                    <input
                      type="number"
                      placeholder={t1_val !== "" ? `Normalized: ${t1_val}` : "0-40"}
                      defaultValue=""
                      onBlur={(e) => handleSaveMark(student.id, "t1", e.target.value, 40)}
                      className="w-24 p-1 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">{saving === `${student.id}-t1` ? "Saving..." : `Current: ${t1_val}`}</div>
                  </td>

                  {/* Test 2 */}
                  <td className="p-2 border-r text-center">
                    <input
                      type="number"
                      placeholder={t2_val !== "" ? `Normalized: ${t2_val}` : "0-40"}
                      defaultValue=""
                      onBlur={(e) => handleSaveMark(student.id, "t2", e.target.value, 40)}
                      className="w-24 p-1 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">{saving === `${student.id}-t2` ? "Saving..." : `Current: ${t2_val}`}</div>
                  </td>

                  {/* Mid-Term */}
                  <td className="p-2 border-r text-center">
                    <input
                      type="number"
                      placeholder={m1_val !== "" ? `Normalized: ${m1_val}` : "0-40"}
                      defaultValue=""
                      onBlur={(e) => handleSaveMark(student.id, "m1", e.target.value, 40)}
                      className="w-24 p-1 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">{saving === `${student.id}-m1` ? "Saving..." : `Current: ${m1_val}`}</div>
                  </td>

                  {/* Exam */}
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      placeholder={exam_val !== "" ? `Normalized: ${exam_val}` : "0-100"}
                      defaultValue=""
                      onBlur={(e) => handleSaveMark(student.id, "exam", e.target.value, 100)}
                      className="w-24 p-1 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">{saving === `${student.id}-exam` ? "Saving..." : `Current: ${exam_val}`}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {students.length === 0 && (
          <div className="p-8 text-center text-gray-500">No students registered in this class layer yet.</div>
        )}
      </div>
    </div>
  );
}