"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";

interface Student {
  id: string;
  name: string;
  class: string;
}

const subjectsList = [
  { id: "math", name: "Mathematics" },
  { id: "kiny", name: "Kinyarwanda" },
  { id: "eng", name: "English" },
  { id: "set", name: "Science & Elem. Tech (SET)" },
  { id: "sre", name: "SRE / Religion" },
  { id: "social", name: "Social Studies" },
  { id: "french", name: "French" }
];

export default function EnterMarksPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("P4");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [selectedSubject, setSelectedSubject] = useState("math");
  
  const [marksData, setMarksData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // CORRECTED: French is out of 25, everything else is out of 50
  const getExamMax = (subjectId: string) => {
    if (subjectId === "french") return 25; 
    return 50; 
  };

  const getTestMax = (subjectId: string) => {
    if (subjectId === "french") return 25;
    return 50;
  };

  useEffect(() => {
    const loadClassData = async () => {
      setLoading(true);
      try {
        const sSnap = await getDocs(collection(db, "students"));
        const classList = sSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Student))
          .filter((s) => s.class?.toUpperCase() === selectedClass.toUpperCase());
        
        classList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(classList);

        const temporaryMarks: Record<string, any> = {};
        await Promise.all(
          classList.map(async (student) => {
            const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
            mSnap.forEach((docSnap) => {
              if (docSnap.id.toLowerCase().trim() === selectedSubject.toLowerCase()) {
                temporaryMarks[student.id] = docSnap.data();
              }
            });
          })
        );
        setMarksData(temporaryMarks);
      } catch (err) {
        console.error("Error loading registry:", err);
      }
      setLoading(false);
    };

    loadClassData();
  }, [selectedClass, selectedSubject]);

  const handleInputChange = (studentId: string, field: string, value: string) => {
    setMarksData((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value === "" ? "" : Number(value)
      }
    }));
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    try {
      await Promise.all(
        students.map(async (student) => {
          const studentRecord = marksData[student.id] || {};
          const ref = doc(db, "students", student.id, "marks", selectedSubject.toLowerCase());
          await setDoc(ref, studentRecord, { merge: true });
        })
      );
      alert("Marks saved successfully! 👍");
    } catch (err) {
      console.error("Save failure:", err);
      alert("Failed to save changes.");
    }
    setSaving(false);
  };

  const testMax = getTestMax(selectedSubject);
  const examMax = getExamMax(selectedSubject);

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        
        {/* Controls Bar Header */}
        <div className="border-b pb-4 mb-6">
          <h1 className="text-xl font-black text-blue-900 uppercase tracking-wide">Learner Marks Ledger</h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full border p-2 rounded-xl text-xs font-bold bg-white">
                <option value="P1">Primary 1 (P1)</option>
                <option value="P2">Primary 2 (P2)</option>
                <option value="P3">Primary 3 (P3)</option>
                <option value="P4">Primary 4 (P4)</option>
                <option value="P5">Primary 5 (P5)</option>
                <option value="P6">Primary 6 (P6)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Academic Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full border p-2 rounded-xl text-xs font-bold bg-white">
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Course Pathway</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full border p-2 rounded-xl text-xs font-bold bg-white">
                {subjectsList.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Parameter Label */}
        <div className="bg-blue-50 border border-blue-200 text-blue-950 font-bold rounded-xl px-4 py-2.5 text-xs mb-4 uppercase tracking-tight flex justify-between">
          <span>Active Assessment Parameters:</span>
          <span>Mid Test: /{testMax} | Final Exam: <span className="underline text-red-700 font-black">/{examMax}</span></span>
        </div>

        {/* Grid Ledger Table */}
        {loading ? (
          <div className="text-center font-bold text-gray-400 p-12 tracking-widest animate-pulse">Loading Register Sheet...</div>
        ) : (
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 font-black text-[10px] tracking-wider uppercase text-gray-700 h-10">
                  <th className="text-left pl-4 w-[40%]">Student Full Name</th>
                  <th className="w-[20%]">Mid Test 1 (/{testMax})</th>
                  <th className="w-[20%]">Final Exam (/{examMax})</th>
                  <th className="w-[20%] bg-gray-50/80">Combined Score</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const record = marksData[student.id] || {};
                  const tKey = `${selectedTerm}_t1`;
                  const mKey = `${selectedTerm}_m1`;

                  const scoreT = record[tKey] !== undefined && record[tKey] !== "" ? Number(record[tKey]) : "";
                  const scoreM = record[mKey] !== undefined && record[mKey] !== "" ? Number(record[mKey]) : "";
                  
                  const combinedTotal = (scoreT !== "" ? scoreT : 0) + (scoreM !== "" ? scoreM : 0);
                  const hasValues = scoreT !== "" || scoreM !== "";

                  return (
                    <tr key={student.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50/50 h-12">
                      <td className="text-left pl-4 font-black text-gray-900 uppercase">{student.name}</td>
                      
                      {/* Mid Test Score */}
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          max={testMax}
                          placeholder={`Max ${testMax}`}
                          value={scoreT}
                          onChange={(e) => handleInputChange(student.id, tKey, e.target.value)}
                          className="w-24 border-2 rounded-lg p-1.5 text-center font-bold font-mono focus:border-blue-900 focus:outline-none"
                        />
                      </td>

                      {/* Final Exam Column - Corrected Highlight and Limit */}
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          max={examMax}
                          placeholder={`Max ${examMax}`}
                          value={scoreM}
                          onChange={(e) => handleInputChange(student.id, mKey, e.target.value)}
                          className={`w-24 border-2 rounded-lg p-1.5 text-center font-bold font-mono focus:outline-none ${
                            selectedSubject === "french" ? "border-amber-500 focus:border-amber-700" : "focus:border-blue-900"
                          }`}
                        />
                      </td>

                      <td className="font-mono font-black text-blue-900 text-sm bg-gray-50/50">
                        {hasValues ? `${combinedTotal} / ${testMax + examMax}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveMarks}
            disabled={saving || loading}
            className="bg-blue-900 hover:bg-blue-950 disabled:bg-gray-400 text-white font-black text-xs uppercase px-8 py-3 rounded-xl shadow transition-all tracking-wide"
          >
            {saving ? "Saving Changes... 💾" : "Save Input Ledger Marks 💾"}
          </button>
        </div>

      </div>
    </div>
  );
}