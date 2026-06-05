"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const academicSubjects = [
  { name: "MATHEMATICS", maxInt: 50, maxEx: 50 },
  { name: "SET", maxInt: 50, maxEx: 50 },
  { name: "SRE", maxInt: 50, maxEx: 50 },
  { name: "KINYARWANDA", maxInt: 50, maxEx: 50 },
  { name: "FRANÇAIS", maxInt: 25, maxEx: 25 },
  { name: "ENGLISH", maxInt: 50, maxEx: 50 }
];

const coCurricularSubjects = [
  { name: "SPORT", maxInt: 5, maxEx: 5 },
  { name: "CREATIVE ART", maxInt: 5, maxEx: 5 }
];

type ViewMode = "midterm_report" | "full_term_report";

function ReportCardsEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Dynamic parameters synced with database tracking values
  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  
  const [activeClass, setActiveClass] = useState(urlClass ? urlClass.toUpperCase() : "P4");
  const [selectedTerm, setSelectedTerm] = useState("term1"); // term1, term2, term3
  const [viewMode, setViewMode] = useState<ViewMode>("full_term_report"); // midterm_report, full_term_report
  
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [classTeacherName, setClassTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(urlStudentId);
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);

  // Sync state cleanly if URL query params change directly
  useEffect(() => {
    if (urlClass) setActiveClass(urlClass.toUpperCase());
  }, [urlClass]);

  useEffect(() => {
    setActiveStudentId(urlStudentId);
  }, [urlStudentId]);

  useEffect(() => {
    const fetchClassReports = async () => {
      setLoading(true);
      try {
        // 1. Fetch Class Teacher Details
        const tSnap = await getDocs(collection(db, "teachers"));
        let detectedTeacher = "";
        tSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docClassTeacherOf = data.classTeacherOf ? data.classTeacherOf.toUpperCase() : "";
          if (docClassTeacherOf === activeClass) {
            detectedTeacher = data.name || "";
          } else if (data.classes && Array.isArray(data.classes)) {
            const hasClass = data.classes.map((c: string) => c.toUpperCase()).includes(activeClass);
            if (hasClass && !detectedTeacher) {
              detectedTeacher = data.name || "";
            }
          }
        });
        setClassTeacherName(detectedTeacher.toUpperCase());

        // 2. Fetch Enrolled Class Population
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        // 3. Collect Marks Ledger Matrix Maps
        let marksMatrix: any = {};
        await Promise.all(classFiltered.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          marksMatrix[student.id] = {};
          mSnap.forEach((docSnap) => {
            const docId = docSnap.id.trim().toUpperCase();
            let key = docId;
            if (docId === "MATH" || docId === "MATHEMATICS") key = "MATHEMATICS";
            if (docId === "KINY" || docId === "KINYARWANDA") key = "KINYARWANDA";
            if (docId === "ENG" || docId === "ENGLISH") key = "ENGLISH";
            if (docId === "SOCIAL" || docId === "SOCIAL STUDIES") key = "SOCIAL STUDIES";
            if (docId === "FRENCH" || docId === "FRANÇAIS") key = "FRANÇAIS";
            marksMatrix[student.id][key] = docSnap.data();
          });
        }));
        setAllMarks(marksMatrix);

        // 4. Compute Aggregate Metrics and Rankings Relative to the Dashboard Choice
        const processedStudents = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          
          let scoreAcquired = 0;
          let scoreMaxTotal = 0;

          // Determine standard assessment criteria scope based on View Mode selection
          if (viewMode === "midterm_report") {
            // Left Layout Mode: Sum up MID 1 and MID 2 values for the selected term
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              const m1 = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
              const m2 = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
              
              if (m1 !== "-") scoreAcquired += Number(m1);
              if (m2 !== "-") scoreAcquired += Number(m2);
              scoreMaxTotal += sub.maxInt + sub.maxEx; 
            });
          } else {
            // Right Layout Mode: Full Term layout (MID + EXAM) for Academic Subjects + Co-Curricular entries
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              const mid = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
              const ex = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
              
              if (mid !== "-") scoreAcquired += Number(mid);
              if (ex !== "-") scoreAcquired += Number(ex);
              scoreMaxTotal += sub.maxInt + sub.maxEx;
            });

            coCurricularSubjects.forEach((sub) => {
              const mData = studentMarks[sub.name] || {};
              const mid = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
              const ex = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
              
              if (mid !== "-") scoreAcquired += Number(mid);
              if (ex !== "-") scoreAcquired += Number(ex);
              scoreMaxTotal += sub.maxInt + sub.maxEx;
            });
          }

          const percentage = scoreMaxTotal > 0 ? (scoreAcquired / scoreMaxTotal) * 100 : 0;

          return {
            ...student,
            scoreAcquired,
            scoreMaxTotal,
            percentage
          };
        });

        // 5. Compute Sorted Ranks dynamically based on selected configurations
        processedStudents.sort((a, b) => b.percentage - a.percentage);
        let currentRank = 1;
        const ranked = processedStudents.map((st, idx, arr) => {
          if (idx > 0 && st.percentage < arr[idx - 1].percentage) {
            currentRank = idx + 1;
          }
          return { ...st, position: currentRank };
        });

        ranked.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setStudents(ranked);
      } catch (err) {
        console.error("Report processing engine pipeline failure:", err);
      }
      setLoading(false);
    };

    fetchClassReports();
  }, [activeClass, selectedTerm, viewMode]);

  const handleClassChange = (newClass: string) => {
    setActiveClass(newClass);
    router.push(`/reports?class=${newClass.toLowerCase()}`);
  };

  const handlePrintAll = () => {
    setIsPrintAllMode(true);
    setActiveStudentId(null);
    setTimeout(() => { window.print(); }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-[11px] pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 4mm 5mm 4mm 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-card {
            border: 3px solid black !important;
            padding: 10px !important;
            margin: 0 auto !important;
            width: 100% !important;
            height: 198mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-teacher-line { border: none !important; text-decoration: none !important; }
          .print-hidden { display: none !important; }
        }
      `}} />

      {/* Functional Header Control Dashboard */}
      <div className="bg-white border-b-2 p-4 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Select Class</label>
              <select 
                value={activeClass} 
                onChange={(e) => handleClassChange(e.target.value)} 
                className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-950 min-w-[140px]"
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
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Active Term</label>
              <select 
                value={selectedTerm} 
                onChange={(e) => setSelectedTerm(e.target.value)} 
                className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-950 min-w-[120px]"
              >
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Report Choice Selection</label>
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value as ViewMode)} 
                className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900 min-w-[280px]"
              >
                <option value="full_term_report">Full Term Report Card View (MID / EXAM)</option>
                <option value="midterm_report">Mid-Term Progress Report Card View (MID 1 / MID 2 Only)</option>
              </select>
            </div>
          </div>

          <button onClick={handlePrintAll} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl shadow tracking-wide mt-4 sm:mt-0">
            Print All Reports 🖨️
          </button>
        </div>
      </div>

      {/* Main Student Card Content Sheet */}
      <div className="max-w-[1140px] mx-auto p-4 space-y-12 mt-4">
        {loading ? (
          <div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest animate-pulse">Loading Report Cards...</div>
        ) : students.length === 0 ? (
          <div className="bg-white border p-12 text-center rounded-xl shadow-sm text-gray-500 text-sm font-bold">
            No students found enrolled in class {activeClass}.
          </div>
        ) : (
          students.map((student) => {
            const studentMarks = allMarks[student.id] || {};
            const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
            if (!isVisible) return null;

            return (
              <div key={student.id} className="bg-white border-[3px] border-black p-4 print-card flex flex-col justify-between shadow-sm">
                <div>
                  {/* Top Sheet Identity Profile Row */}
                  <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 font-black text-[10px]">
                    <div className="uppercase">ANNEE: <span className="text-blue-900 font-serif">2026</span></div>
                    <div className="uppercase">NOM DU STAGIAIRE / STUDENT: <span className="text-blue-900 ml-1 text-xs">{student.name}</span></div>
                    <div className="uppercase">CLASSE: <span className="text-blue-900 ml-1">{student.class}</span></div>
                    <div className="uppercase">Nombre d'élèves: <span className="text-blue-900 font-serif ml-1">{students.length}</span></div>
                  </div>

                  {/* Document Layout Matrix */}
                  <table className="w-full border-collapse border-[3px] border-black text-[11px] font-black">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black h-6">
                        <th colSpan={4} className="border-r-2 border-black text-left pl-2">MATIÈRES / SUBJECTS</th>
                        <th colSpan={3} className="border-r-2 border-black text-center text-[10px] uppercase">{selectedTerm} EVALUATION</th>
                        <th colSpan={3} className="text-center text-[10px]">TOTAL SCORES</th>
                      </tr>
                      
                      <tr className="bg-gray-50 border-b-2 border-black h-6 text-center text-[10px]">
                        <th className="border-r-2 border-black text-left pl-2 w-[25%]">MATIÈRES</th>
                        <th className="border-r border-black w-[8%]">Max INT</th>
                        <th className="border-r border-black w-[8%]">Max EX</th>
                        <th className="border-r-2 border-black w-[10%] bg-gray-100">Max Tot</th>
                        
                        {/* Headers dynamically switch based on your selection */}
                        <th className="border-r border-black w-[11%]">{viewMode === "midterm_report" ? "MID 1" : "MID"}</th>
                        <th className="border-r border-black w-[11%]">{viewMode === "midterm_report" ? "MID 2" : "EXAM"}</th>
                        <th className="border-r-2 border-black w-[11%] bg-gray-100">Total</th>

                        <th className="border-r border-black w-[12%] bg-gray-100">Total Max</th>
                        <th className="border-r border-black w-[12%]">total</th>
                        <th className="w-[12%]">%</th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {/* PART 1: Academic Track Entries */}
                      {academicSubjects.map((sub) => {
                        if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;

                        const mData = studentMarks[sub.name] || {};
                        const m1 = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
                        const m2 = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
                        const total = (m1 !== "-" || m2 !== "-") ? (m1 !== "-" ? Number(m1) : 0) + (m2 !== "-" ? Number(m2) : 0) : "-";

                        const pct = total !== "-" ? ((Number(total) / (sub.maxInt + sub.maxEx)) * 100).toFixed(1) : "-";

                        return (
                          <tr key={sub.name} className="border-b border-black h-7 text-center">
                            <td className="text-left font-black border-r-2 border-black pl-2 uppercase text-blue-950">{sub.name}</td>
                            <td className="border-r border-black text-gray-400 font-serif">{sub.maxInt}</td>
                            <td className="border-r-2 border-black text-gray-400 font-serif">{sub.maxEx}</td>
                            <td className="border-r-2 border-black bg-gray-50">{sub.maxInt + sub.maxEx}</td>
                            
                            <td className="border-r border-black font-serif font-bold">{m1}</td>
                            <td className="border-r border-black font-serif font-bold">{m2}</td>
                            <td className="border-r-2 border-black bg-gray-50 font-serif font-bold text-blue-900">{total}</td>

                            <td className="border-r border-black bg-gray-100 font-serif">{sub.maxInt + sub.maxEx}</td>
                            <td className="border-r border-black font-serif font-bold text-blue-950">{total}</td>
                            <td className="font-serif font-bold text-blue-950">{pct !== "-" ? `${pct}%` : "-"}</td>
                          </tr>
                        );
                      })}

                      {/* PART 2: Co-Curricular Segment Header Block (Rendered ONLY in Full-Term mode layout) */}
                      {viewMode === "full_term_report" && (
                        <>
                          <tr className="bg-gray-100 border-t-2 border-b-2 border-black h-6 font-black text-center">
                            <td colSpan={10} className="tracking-widest text-[10px] uppercase text-gray-800">
                              CO-CURRICULA ACTIVITIES
                            </td>
                          </tr>

                          {coCurricularSubjects.map((sub) => {
                            const mData = studentMarks[sub.name] || {};
                            const m1 = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
                            const m2 = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
                            const total = (m1 !== "-" || m2 !== "-") ? (m1 !== "-" ? Number(m1) : 0) + (m2 !== "-" ? Number(m2) : 0) : "-";
                            const pct = total !== "-" ? ((Number(total) / (sub.maxInt + sub.maxEx)) * 100).toFixed(1) : "-";

                            return (
                              <tr key={sub.name} className="border-b border-black h-7 text-center">
                                <td className="text-left font-black border-r-2 border-black pl-2 uppercase text-gray-700">{sub.name}</td>
                                <td className="border-r border-black text-gray-400 font-serif">{sub.maxInt}</td>
                                <td className="border-r-2 border-black text-gray-400 font-serif">{sub.maxEx}</td>
                                <td className="border-r-2 border-black bg-gray-50">{sub.maxInt + sub.maxEx}</td>
                                
                                <td className="border-r border-black font-serif font-bold">{m1}</td>
                                <td className="border-r border-black font-serif font-bold">{m2}</td>
                                <td className="border-r-2 border-black bg-gray-50 font-serif font-bold text-green-900">{total}</td>

                                <td className="border-r border-black bg-gray-100 font-serif">{sub.maxInt + sub.maxEx}</td>
                                <td className="border-r border-black font-serif font-bold text-gray-800">{total}</td>
                                <td className="font-serif font-bold text-gray-800">{pct !== "-" ? `${pct}%` : "-"}</td>
                              </tr>
                            );
                          })}
                        </>
                      )}

                      {/* AGGREGATE TOTAL SUMMARY GENERAL FOOTER */}
                      <tr className="border-t-2 border-b border-black h-7 bg-gray-50 text-center font-black">
                        <td className="text-left pl-2 border-r-2 border-black text-blue-950 uppercase">TOTAL GENERAL</td>
                        <td className="border-r border-black text-gray-400 font-serif">{viewMode === "midterm_report" ? "275" : "285"}</td>
                        <td className="border-r border-black text-gray-400 font-serif">{viewMode === "midterm_report" ? "275" : "285"}</td>
                        <td className="border-r-2 border-black bg-gray-100 font-serif">{student.scoreMaxTotal}</td>
                        
                        <td colSpan={3} className="border-r-2 border-black font-serif text-sm text-blue-900 bg-blue-50/40">
                          {student.scoreAcquired} <span className="text-[10px] text-gray-400 font-normal">/ {student.scoreMaxTotal}</span>
                        </td>
                        
                        <td className="border-r border-black bg-gray-100 font-serif">{student.scoreMaxTotal}</td>
                        <td className="border-r border-black font-serif text-blue-900 text-sm">{student.scoreAcquired}</td>
                        <td className="font-serif text-blue-900 text-sm">{student.percentage.toFixed(1)}%</td>
                      </tr>

                      {/* POURCENTAGE METRIC ROW */}
                      <tr className="border-b border-black h-7 text-center font-black">
                        <td className="text-left pl-2 border-r-2 border-black uppercase">POURCENTAGE</td>
                        <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                        <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950 bg-blue-50/20">{student.percentage.toFixed(1)}%</td>
                        <td colSpan={3} className="bg-gray-100 font-serif font-bold text-blue-900">{student.percentage.toFixed(1)}%</td>
                      </tr>

                      {/* DYNAMIC TERM RANK ROW */}
                      <tr className="h-7 text-center font-black">
                        <td className="text-left pl-2 border-r-2 border-black uppercase">PLACE / RANK</td>
                        <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                        <td colSpan={3} className="border-r-2 border-black text-green-800 font-serif uppercase bg-green-50/20">
                          {student.position} SUR {students.length}
                        </td>
                        <td colSpan={3} className="bg-green-50 text-green-900 font-serif font-bold text-xs uppercase">
                          {student.position} SUR {students.length}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signature Row (Completely line-free) */}
                <div className="flex justify-between items-end mt-4 text-[10px] font-black">
                  <div>
                    <span className="text-gray-400 uppercase tracking-wider block mb-0.5">Class Teacher Name:</span>
                    <div className="text-xs uppercase text-blue-900 tracking-wide font-black print-teacher-line">
                      {classTeacherName || "NOT ASSIGNED"}
                    </div>
                  </div>
                  <div className="border border-dashed border-gray-400 rounded px-5 py-1.5 bg-gray-50 text-gray-400 uppercase tracking-widest text-[8px]">
                    School Stamp Area
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Fixed Suspense wrapper layout to prevent component build crashes
export default function ReportCardsPage() {
  return (
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest animate-pulse">Initializing Layout System Container...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}