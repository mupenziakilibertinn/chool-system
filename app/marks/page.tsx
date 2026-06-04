"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

// Course pathway mapping matching your reports setup
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function MarksEntryPage() {
  const router = useRouter();
  const [activeClass, setActiveClass] = useState("P6");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [students, setStudents] = useState<any[]>([]);
  const [marksMatrix, setMarksMatrix] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch students and their current marks matrix
  useEffect(() => {
    const fetchMarksData = async () => {
      setLoading(true);
      try {
        // Fetch all students registered in the system
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass.toUpperCase());

        // Sort students alphabetically by name
        classFiltered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setStudents(classFiltered);

        // Build existing marks matrix from database layers
        let initialMatrix: any = {};
        await Promise.all(classFiltered.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          initialMatrix[student.id] = {};
          mSnap.forEach((docSnap) => {
            initialMatrix[student.id][docSnap.id] = docSnap.data();
          });
        }));
        setMarksMatrix(initialMatrix);
      } catch (err) {
        console.error("Failed to compile marks spreadsheet layer:", err);
      }
      setLoading(false);
    };

    fetchMarksData();
  }, [activeClass]);

  // Handle cell entry updates cleanly within the local matrix state
  const handleInputChange = (studentId: string, subject: string, fieldKey: string, value: string) => {
    setSaveSuccess(false);
    setMarksMatrix((prev: any) => {
      const studentData = prev[studentId] || {};
      const subjectData = studentData[subject] || {};
      
      return {
        ...prev,
        [studentId]: {
          ...studentData,
          [subject]: {
            ...subjectData,
            [`${selectedTerm}_${fieldKey}`]: value === "" ? "-" : value
          }
        }
      };
    });
  };

  // Persist local state updates to Firebase cloud collections
  const handleSaveChanges = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await Promise.all(
        students.map(async (student) => {
          const studentData = marksMatrix[student.id] || {};
          
          // Loop through active pathways to update records
          for (const sub of subjectsList) {
            if (activeClass === "P6" && sub === "French") continue;
            
            const subData = studentData[sub] || {};
            const docRef = doc(db, "students", student.id, "marks", sub);
            
            // Save keeping existing fields for other terms untouched
            await setDoc(docRef, subData, { merge: true });
          }
        })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Cloud document sync failed:", err);
      alert("Error saving marks. Please verify network links or config states.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">
        Loading Class Marks Spreadsheet Grid...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs pb-20">
      {/* Dynamic Top Navigation Panel */}
      <div className="bg-white border-b-2 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Active Target Class</label>
              <select 
                value={activeClass} 
                onChange={(e) => setActiveClass(e.target.value.toUpperCase())} 
                className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-900 uppercase"
              >
                <option value="P1">Primary 1 (P1)</option>
                <option value="P2">Primary 2 (P2)</option>
                <option value="P3">Primary 3 (P3)</option>
                <option value="P4">Primary 4 (P4)</option>
                <option value="P5">Primary 5 (P5)</option>
                <option value="P6">Primary 6 (P6)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Target Academic Term</label>
              <select 
                value={selectedTerm} 
                onChange={(e) => setSelectedTerm(e.target.value)} 
                className="p-2 border-2 rounded-xl font-black bg-white text-xs"
              >
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/reports?class=${activeClass.toLowerCase()}`)}
              className="bg-blue-900 hover:bg-blue-950 text-white font-black text-xs uppercase px-4 py-3 rounded-xl transition-all"
            >
              View Report Hub 📋
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className={`${
                saveSuccess ? "bg-green-600" : "bg-green-700 hover:bg-green-800"
              } text-white font-black text-xs uppercase px-6 py-3 rounded-xl shadow transition-all flex items-center gap-2`}
            >
              {saving ? "Syncing Cloud Records..." : saveSuccess ? "Marks Saved Successfully!  ✔" : "Save Changes to Database  💾"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="max-w-7xl mx-auto p-4 mt-6">
        {students.length === 0 ? (
          <div className="text-center font-black p-10 bg-white border-4 border-black rounded-xl text-gray-400 uppercase">
            No registered students located for Class {activeClass}
          </div>
        ) : (
          <div className="bg-white border-4 border-black rounded-xl p-4 shadow-md overflow-x-auto">
            <h1 className="text-sm font-black text-blue-900 uppercase tracking-wider mb-4 border-b-2 pb-2">
              NEW GENERATION SCHOOL — CLASS {activeClass} SPREADSHEET LEDGER ({selectedTerm.toUpperCase()})
            </h1>
            
            <table className="w-full text-center border-collapse border-2 border-black text-xs font-black">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-black uppercase text-[10px] tracking-wider">
                  <th className="p-2 border-r-2 border-black text-left sticky left-0 bg-gray-100 z-10 min-w-[180px]">Student Name</th>
                  {subjectsList.map((sub) => {
                    if (activeClass === "P6" && sub === "French") return null;
                    const maxLabel = (sub === "French") ? "/25" : "/50";
                    return (
                      <th key={sub} className="p-2 border-r-2 border-black min-w-[140px]" colSpan={4}>
                        {sub.toUpperCase()} ({maxLabel})
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50 border-b-2 border-black uppercase text-[8px] tracking-tight">
                  <th className="p-1 border-r-2 border-black text-left sticky left-0 bg-gray-50 z-10">Matrix Index</th>
                  {subjectsList.map((sub) => {
                    if (activeClass === "P6" && sub === "French") return null;
                    return (
                      <g key={`${sub}-subheaders`}>
                        <th className="p-1 border-r bg-blue-50/50">T1</th>
                        <th className="p-1 border-r bg-blue-50/50">M1</th>
                        <th className="p-1 border-r bg-green-50/50">T2</th>
                        <th className="p-1 border-r-2 border-black bg-green-50/50">M2</th>
                      </g>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student, sIdx) => {
                  const studentData = marksMatrix[student.id] || {};
                  return (
                    <tr key={student.id} className="border-b border-black hover:bg-gray-50 text-gray-900">
                      {/* Fixed Name Column */}
                      <td className="p-2 border-r-2 border-black text-left font-black uppercase text-blue-950 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {sIdx + 1}. {student.name}
                      </td>
                      
                      {/* Pathway Input Loop */}
                      {subjectsList.map((sub) => {
                        if (activeClass === "P6" && sub === "French") return null;
                        
                        const subData = studentData[sub] || {};
                        const t1 = subData[`${selectedTerm}_t1`] === "-" ? "" : subData[`${selectedTerm}_t1`] ?? "";
                        const m1 = subData[`${selectedTerm}_m1`] === "-" ? "" : subData[`${selectedTerm}_m1`] ?? "";
                        const t2 = subData[`${selectedTerm}_t2`] === "-" ? "" : subData[`${selectedTerm}_t2`] ?? "";
                        const m2 = subData[`${selectedTerm}_m2`] === "-" ? "" : subData[`${selectedTerm}_m2`] ?? "";

                        return (
                          <g key={`${student.id}-${sub}`}>
                            {/* Term 1 Components */}
                            <td className="p-1 border-r bg-blue-50/20">
                              <input
                                type="text"
                                value={t1}
                                placeholder="-"
                                onChange={(e) => handleInputChange(student.id, sub, "t1", e.target.value)}
                                className="w-full text-center bg-transparent border-0 font-bold font-serif focus:ring-1 focus:ring-blue-900 rounded"
                              />
                            </td>
                            <td className="p-1 border-r bg-blue-50/20">
                              <input
                                type="text"
                                value={m1}
                                placeholder="-"
                                onChange={(e) => handleInputChange(student.id, sub, "m1", e.target.value)}
                                className="w-full text-center bg-transparent border-0 font-bold font-serif focus:ring-1 focus:ring-blue-900 rounded"
                              />
                            </td>
                            
                            {/* Term 2 Components */}
                            <td className="p-1 border-r bg-green-50/20">
                              <input
                                type="text"
                                value={t2}
                                placeholder="-"
                                onChange={(e) => handleInputChange(student.id, sub, "t2", e.target.value)}
                                className="w-full text-center bg-transparent border-0 font-bold font-serif focus:ring-1 focus:ring-green-800 rounded"
                              />
                            </td>
                            <td className="p-1 border-r-2 border-black bg-green-50/20">
                              <input
                                type="text"
                                value={m2}
                                placeholder="-"
                                onChange={(e) => handleInputChange(student.id, sub, "m2", e.target.value)}
                                className="w-full text-center bg-transparent border-0 font-bold font-serif focus:ring-1 focus:ring-green-800 rounded"
                              />
                            </td>
                          </g>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}