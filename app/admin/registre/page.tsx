"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../../../lib/firebase";
import { collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";

const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

interface StudentRecord {
  id: string;
  name: string;
  gender?: "Male" | "Female" | "Unassigned";
  class: string;
  marks: { [key: string]: string };
}

interface DraftStudent {
  name: string;
  gender: "Male" | "Female";
}

export default function RegistreNominatifPage() {
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("P1");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [registryData, setRegistryData] = useState<StudentRecord[]>([]);

  // Bulk Paste & Add Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [rawPastedText, setRawPastedText] = useState("");
  const [parsedDrafts, setParsedDrafts] = useState<DraftStudent[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    compileMasterRegister();
  }, [selectedClass, selectedTerm]);

  // Fetch & Build Master Register Matrix
  const compileMasterRegister = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(collection(db, "students"));
      const filteredStudents = sSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(s => s.class === selectedClass)
        .sort((a, b) => a.name.localeCompare(b.name));

      const fullMatrix: StudentRecord[] = await Promise.all(
        filteredStudents.map(async (student) => {
          const studentMarks: { [key: string]: string } = {};
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          
          mSnap.forEach(docSnap => {
            const subjectId = docSnap.id;
            if (!subjectsList.includes(subjectId)) return;

            const mData = docSnap.data();
            let scoreSum = 0;
            let maxSum = 0;
            const baseMax = (subjectId === "French" && selectedClass !== "P6") ? 25 : 50;

            [1, 2].forEach(n => {
              const tVal = mData[`${selectedTerm}_t${n}`];
              const mVal = mData[`${selectedTerm}_m${n}`];
              if (tVal !== undefined && tVal !== null && tVal !== "-") { scoreSum += Number(tVal); maxSum += baseMax; }
              if (mVal !== undefined && mVal !== null && mVal !== "-") { scoreSum += Number(mVal); maxSum += baseMax; }
            });

            studentMarks[subjectId] = maxSum > 0 ? `${scoreSum}/${maxSum}` : "-";
          });

          return {
            id: student.id,
            name: student.name,
            gender: student.gender || "Unassigned",
            class: student.class,
            marks: studentMarks
          };
        })
      );

      setRegistryData(fullMatrix);
    } catch (err) {
      console.error("Critical nominal ledger extraction error:", err);
    }
    setLoading(false);
  };

  // Inline Gender Update for Existing Registered Students
  const handleGenderUpdate = async (studentId: string, newGender: "Male" | "Female") => {
    try {
      const studentRef = doc(db, "students", studentId);
      await updateDoc(studentRef, { gender: newGender });
      
      setRegistryData(prev =>
        prev.map(s => (s.id === studentId ? { ...s, gender: newGender } : s))
      );
    } catch (err) {
      console.error("Failed to update student gender:", err);
      alert("Error updating gender in database.");
    }
  };

  // Parse Raw Copied Text from Excel / Word into Clean Draft Rows
  const handleParsePastedText = () => {
    if (!rawPastedText.trim()) return;

    const lines = rawPastedText
      .split(/\r?\n/)
      .map(line => line.replace(/^[0-9]+[\.\-\)\s]+/, "").trim()) // Remove leading row numbers
      .filter(line => line.length > 0);

    const initialDrafts: DraftStudent[] = lines.map(name => ({
      name,
      gender: "Male" // Default initial selection
    }));

    setParsedDrafts(initialDrafts);
  };

  // Update Individual Draft Row in Modal
  const updateDraft = (index: number, field: keyof DraftStudent, value: string) => {
    setParsedDrafts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove Individual Draft Row from Modal
  const removeDraft = (index: number) => {
    setParsedDrafts(prev => prev.filter((_, i) => i !== index));
  };

  // Save All Draft Students in Batch to Firestore
  const handleSaveBatchStudents = async () => {
    if (parsedDrafts.length === 0) return;
    setIsSaving(true);

    try {
      const batch = writeBatch(db);

      parsedDrafts.forEach(student => {
        const newRef = doc(collection(db, "students"));
        batch.set(newRef, {
          name: student.name,
          gender: student.gender,
          class: selectedClass,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();

      // Reset Modal & Reload Register
      setRawPastedText("");
      setParsedDrafts([]);
      setShowAddModal(false);
      await compileMasterRegister();
    } catch (err) {
      console.error("Batch student creation failed:", err);
      alert("Failed to commit batch registration.");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculated Demographic Summary Counts
  const totalCount = registryData.length;
  const maleCount = registryData.filter(s => s.gender === "Male").length;
  const femaleCount = registryData.filter(s => s.gender === "Female").length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
      {/* ON-SCREEN CONTROL BAR */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-6 print:hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">📄 REGISTRE NOMINATIF DES RÉSULTATS</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Official Master Assessment Ledger Sheets</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-slate-100 border rounded-xl px-3 py-2 text-xs font-black focus:outline-none">
            {availableClasses.map(c => <option key={c} value={c}>{c} Class Stream</option>)}
          </select>

          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="bg-slate-100 border rounded-xl px-3 py-2 text-xs font-black focus:outline-none">
            <option value="term1">1st Term / Premier Trimestre</option>
            <option value="term2">2nd Term / Deuxième Trimestre</option>
            <option value="term3">3rd Term / Troisième Trimestre</option>
          </select>

          <button 
            onClick={() => setShowAddModal(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            ➕ Bulk Register / Paste Names
          </button>

          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl transition-colors shadow-sm">
            🖨️ Print Master Sheet
          </button>

          <Link href="/admin">
            <span className="text-xs font-black border px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer inline-block">&larr; Close</span>
          </Link>
        </div>
      </div>

      {/* DEMOGRAPHIC SUMMARY COUNTER BAR */}
      <div className="max-w-7xl mx-auto mb-6 print:hidden flex items-center gap-4 bg-slate-900 text-white p-4 rounded-2xl shadow-sm font-mono text-xs">
        <span className="font-bold uppercase text-slate-400">Demographics Breakdown ({selectedClass}):</span>
        <span className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">Total: <strong>{totalCount}</strong></span>
        <span className="bg-blue-950 text-blue-300 px-3 py-1 rounded-lg border border-blue-800">Boys (M): <strong>{maleCount}</strong></span>
        <span className="bg-pink-950 text-pink-300 px-3 py-1 rounded-lg border border-pink-800">Girls (F): <strong>{femaleCount}</strong></span>
      </div>

      {/* LEDGER CANVAS */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-300 shadow-sm p-8 print:p-0 print:border-none print:shadow-none rounded-3xl">
        
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900">NEW GENERATION SCHOOL</h2>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mt-1">
            REGISTRE NOMINATIF DES ÉVALUATIONS &middot; CLASS {selectedClass}
          </h3>
          <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">
            Academic Assessment Matrix Year: 2026 &middot; Mode: {selectedTerm.toUpperCase()} &middot; Total Enrolled: {totalCount} (M: {maleCount} | F: {femaleCount})
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono font-bold uppercase text-slate-400 tracking-widest">
            Compiling Grade Metrics & Demographic Nodes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border border-slate-400 text-xs">
              <thead>
                <tr className="bg-slate-100 h-10 border border-slate-400 text-slate-900 font-black text-[10px] tracking-wider uppercase">
                  <th className="border border-slate-400 px-3 py-1 text-left w-8">N°</th>
                  <th className="border border-slate-400 px-4 py-1 text-left min-w-[200px]">Nom et Prénom de l'Élève</th>
                  <th className="border border-slate-400 px-2 py-1 min-w-[90px]">Sexe / Gender</th>
                  {subjectsList.map((sub) => {
                    if (selectedClass === "P6" && sub === "French") return null;
                    return (
                      <th key={sub} className="border border-slate-400 px-2 py-1 uppercase text-[9px] font-black">
                        {sub}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-bold uppercase text-slate-800">
                {registryData.map((student, index) => (
                  <tr key={student.id} className="h-9 hover:bg-slate-50/50 transition-colors">
                    <td className="border border-slate-300 px-3 py-1 text-left font-mono text-[10px] text-slate-400">{index + 1}</td>
                    <td className="border border-slate-300 px-4 py-1 text-left font-black tracking-wide text-slate-900 max-w-xs truncate">
                      {student.name}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">
                      {/* Printable View Static Gender Indicator */}
                      <span className="hidden print:inline font-bold">
                        {student.gender === "Male" ? "M" : student.gender === "Female" ? "F" : "-"}
                      </span>

                      {/* On-Screen Interactive Gender Selector for Registered Students */}
                      <select
                        value={student.gender || "Unassigned"}
                        onChange={(e) => handleGenderUpdate(student.id, e.target.value as "Male" | "Female")}
                        className={`print:hidden text-[10px] font-black px-2 py-1 rounded-lg border focus:outline-none ${
                          student.gender === "Male"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : student.gender === "Female"
                            ? "bg-pink-50 text-pink-700 border-pink-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        <option value="Unassigned" disabled>Select Gender</option>
                        <option value="Male">M (Male)</option>
                        <option value="Female">F (Female)</option>
                      </select>
                    </td>
                    {subjectsList.map((sub) => {
                      if (selectedClass === "P6" && sub === "French") return null;
                      const scoreStr = student.marks[sub] || "-";
                      return (
                        <td key={sub} className="border border-slate-300 px-2 py-1 font-mono text-[11px]">
                          <span className={scoreStr === "-" ? "text-slate-300" : "text-slate-900"}>
                            {scoreStr}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {registryData.length === 0 && (
                  <tr>
                    <td colSpan={subjectsList.length + 3} className="p-8 text-center text-xs font-bold text-slate-400 tracking-wider">
                      NO STUDENT ENTITIES COMMITTED TO THE {selectedClass} CLASSIFICATION TRACK.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-dashed border-slate-300 hidden print:flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-slate-400">
          <span>Prepared by: Tr. MUPENZI &middot; System Master Engine</span>
          <span>Date Signature Verification: {new Date().toLocaleDateString()}</span>
        </div>

      </div>

      {/* BULK REGISTRATION / PASTE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">Batch Register Students into {selectedClass}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">Paste list from Excel/Word or add individual names</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setParsedDrafts([]); setRawPastedText(""); }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Step 1: Raw Paste Box */}
              {parsedDrafts.length === 0 ? (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-slate-600 block">
                    Paste Student Names List (One name per line):
                  </label>
                  <textarea
                    rows={8}
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    placeholder={`Example:\n1. Mugisha Patrick\n2. Ishimwe Diane\n3. Keza Divine`}
                    className="w-full border border-slate-300 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleParsePastedText}
                    disabled={!rawPastedText.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black text-xs uppercase rounded-xl transition-colors"
                  >
                    Parse Names List
                  </button>
                </div>
              ) : (
                /* Step 2: Verification and Gender Assignment Table */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-slate-700">
                      Verify Parsed Drafts ({parsedDrafts.length} Students)
                    </span>
                    <button
                      onClick={() => setParsedDrafts([])}
                      className="text-xs font-bold text-slate-500 hover:underline"
                    >
                      &larr; Re-paste List
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-black text-slate-700 uppercase">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Gender Tag</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {parsedDrafts.map((draft, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(e) => updateDraft(idx, "name", e.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none font-bold"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={draft.gender}
                                onChange={(e) => updateDraft(idx, "gender", e.target.value)}
                                className={`text-xs font-black px-2 py-1 rounded-lg border focus:outline-none ${
                                  draft.gender === "Male"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-pink-50 text-pink-700 border-pink-200"
                                }`}
                              >
                                <option value="Male">Male (Boy)</option>
                                <option value="Female">Female (Girl)</option>
                              </select>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => removeDraft(idx)}
                                className="text-red-500 hover:text-red-700 text-xs font-black"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); setParsedDrafts([]); setRawPastedText(""); }}
                className="px-4 py-2 border rounded-xl text-xs font-black text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              {parsedDrafts.length > 0 && (
                <button
                  onClick={handleSaveBatchStudents}
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase transition-colors"
                >
                  {isSaving ? "Saving Students..." : `Save All ${parsedDrafts.length} Students to ${selectedClass}`}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          header, footer, nav { display: none !important; }
          table { border: 2px solid #000000 !important; }
          th, td { border: 1px solid #000000 !important; color: #000000 !important; }
        }
      `}</style>
    </div>
  );
}