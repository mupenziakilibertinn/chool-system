"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];
const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

interface StudentRecord {
  id: string;
  name: string;
  class: string;
  marks: { [key: string]: string };
}

export default function RegistreNominatifPage() {
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("P1");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [registryData, setRegistryData] = useState<StudentRecord[]>([]);

  useEffect(() => {
    compileMasterRegister();
  }, [selectedClass, selectedTerm]);

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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
      {/* ON-SCREEN CONTROL BAR */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-8 print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl transition-colors shadow-sm">
            🖨️ Print Master Sheet
          </button>
          <Link href="/admin">
            <span className="text-xs font-black border px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer">&larr; Close</span>
          </Link>
        </div>
      </div>

      {/* LEDGER CANVAS */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-300 shadow-sm p-8 print:p-0 print:border-none print:shadow-none rounded-3xl">
        
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900">NEW GENERATION SCHOOL</h2>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mt-1">
            REGISTRE NOMINATIF DES ÉVALUATIONS &middot; CLASS {selectedClass}
          </h3>
          <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">
            Academic Assessment Matrix Year: 2026 &middot; Mode: {selectedTerm.toUpperCase()}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono font-bold uppercase text-slate-400 tracking-widest">
            Compiling Grade Metrics from Secure Matrix Nodes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border border-slate-400 text-xs">
              <thead>
                <tr className="bg-slate-100 h-10 border border-slate-400 text-slate-900 font-black text-[10px] tracking-wider uppercase">
                  <th className="border border-slate-400 px-3 py-1 text-left w-8">N°</th>
                  <th className="border border-slate-400 px-4 py-1 text-left min-w-[200px]">Nom et Prénom de l'Élève</th>
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
                    <td colSpan={subjectsList.length + 2} className="p-8 text-center text-xs font-bold text-slate-400 tracking-wider">
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