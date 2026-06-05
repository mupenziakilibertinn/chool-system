"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  const activeClass = urlClass ? urlClass.toUpperCase() : "P4";

  const [viewMode, setViewMode] = useState<ViewMode>("full_term_report");
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [classTeacherName, setClassTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(urlStudentId);
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);

  useEffect(() => {
    setActiveStudentId(urlStudentId);
  }, [urlStudentId]);

  useEffect(() => {
    const fetchClassReports = async () => {
      setLoading(true);
      try {
        // 1. Load Teacher Info
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

        // 2. Load Class Roster
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        // 3. Populate Marks Matrices
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

        // 4. Calculate Scores and Ranks based strictly on active layout view mode selection
        const processedStudents = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          
          let scoreAcquired = 0;
          let scoreMaxTotal = 0;

          // Helper logic to map standard terms sequentially
          const terms = ["term1", "term2", "term3"];

          if (viewMode === "midterm_report") {
            // Mid-Term Report: Looks ONLY at MID 1 and MID 2 columns for Academic Subjects across all 3 terms
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              terms.forEach((t) => {
                const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                
                if (m1 !== "-") scoreAcquired += Number(m1);
                if (m2 !== "-") scoreAcquired += Number(m2);
                scoreMaxTotal += sub.maxInt + sub.maxEx;
              });
            });
          } else {
            // Full Term Report: Calculates Academic Subjects (MID + EXAM) + Co-Curricular entries
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              terms.forEach((t) => {
                const mid = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                const ex = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                
                if (mid !== "-") scoreAcquired += Number(mid);
                if (ex !== "-") scoreAcquired += Number(ex);
                scoreMaxTotal += sub.maxInt + sub.maxEx;
              });
            });

            coCurricularSubjects.forEach((sub) => {
              const mData = studentMarks[sub.name] || {};
              terms.forEach((t) => {
                const mid = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                const ex = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                
                if (mid !== "-") scoreAcquired += Number(mid);
                if (ex !== "-") scoreAcquired += Number(ex);
                scoreMaxTotal += sub.maxInt + sub.maxEx;
              });
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

        // 5. Dynamic Rank Place calculation relative to the layout view
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
        console.error("Layout initialization engine breakdown:", err);
      }
      setLoading(false);
    };

    fetchClassReports();
  }, [activeClass, viewMode]);

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

      {/* Control Panel Dashboard */}
      <div className="bg-white border-b-2 p-4 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <label className="block text-[9px] font-black uppercase text-blue-900 mb-0.5">Select Report Sheet Layout View</label>
            <select 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value as ViewMode)} 
              className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900 min-w-[280px]"
            >
              <option value="full_term_report">Full Term Report Card View (MID / EXAM + Co-Curricular)</option>
              <option value="midterm_report">Mid-Term Progress Report Card View (MID 1 / MID 2 Only)</option>
            </select>
          </div>
          <button onClick={handlePrintAll} className="bg-blue-900 hover:bg-blue-950 text-white font-black text-xs uppercase px-6 py-3 rounded-xl shadow transition-all">
            Print Complete Stream Class Sheet 🖨️
          </button>
        </div>
      </div>

      <div className="max-w-[1140px] mx-auto p-4 space-y-12 mt-4">
        {students.map((student) => {
          const studentMarks = allMarks[student.id] || {};
          const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
          if (!isVisible) return null;

          // Process term subaggregates cleanly for the dynamic footer calculations
          const calculateTermTotals = (term: string) => {
            let acq = 0;
            let mx = 0;
            
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              const m1 = mData[`${term}_t1`] ?? mData[`${term}_m1`] ?? "-";
              const m2 = mData[`${term}_t2`] ?? mData[`${term}_m2`] ?? "-";

              if (viewMode === "midterm_report") {
                if (m1 !== "-") acq += Number(m1);
                if (m2 !== "-") acq += Number(m2);
                mx += sub.maxInt + sub.maxEx;
              } else {
                if (m1 !== "-") acq += Number(m1);
                if (m2 !== "-") acq += Number(m2);
                mx += sub.maxInt + sub.maxEx;
              }
            });

            if (viewMode === "full_term_report") {
              coCurricularSubjects.forEach((sub) => {
                const mData = studentMarks[sub.name] || {};
                const m1 = mData[`${term}_t1`] ?? mData[`${term}_m1`] ?? "-";
                const m2 = mData[`${term}_t2`] ?? mData[`${term}_m2`] ?? "-";
                if (m1 !== "-") acq += Number(m1);
                if (m2 !== "-") acq += Number(m2);
                mx += sub.maxInt + sub.maxEx;
              });
            }

            return { acq, mx };
          };

          const t1Data = calculateTermTotals("term1");
          const t2Data = calculateTermTotals("term2");
          const t3Data = calculateTermTotals("term3");

          return (
            <div key={student.id} className="bg-white border-[3px] border-black p-4 print-card flex flex-col justify-between shadow-sm">
              <div>
                
                {/* Meta Layout Header Panel */}
                <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 font-black text-[10px]">
                  <div className="uppercase">ANNEE: <span className="text-blue-900 font-serif">2026</span></div>
                  <div className="uppercase">NOM / STUDENT: <span className="text-blue-900 ml-1 text-xs">{student.name}</span></div>
                  <div className="uppercase">CLASSE: <span className="text-blue-900 ml-1">{student.class}</span></div>
                  <div className="uppercase">Nombre d'élèves: <span className="text-blue-900 font-serif ml-1">{students.length}</span></div>
                </div>

                {/* Main Landscape Ledger Matrix */}
                <table className="w-full border-collapse border-[3px] border-black text-[11px] font-black">
                  <thead>
                    {/* Header Row Level 1 */}
                    <tr className="bg-gray-100 border-b-2 border-black h-6">
                      <th colSpan={4} className="border-r-2 border-black text-left pl-2">
                        {viewMode === "midterm_report" ? "SUBJECTS (MID-TERM EVALUATION TRACK)" : "MATIÈRES / SUBJECTS"}
                      </th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">1st TERM</th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">2nd TERM</th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">3rd TERM</th>
                      <th colSpan={3} className="text-center tracking-wider text-[10px]">TOTAL ANNUEL / ANNUAL TOTAL</th>
                    </tr>
                    
                    {/* Header Row Level 2 */}
                    <tr className="bg-gray-50 border-b-2 border-black h-6 text-center text-[10px]">
                      <th className="border-r-2 border-black text-left pl-2 w-[22%]">MATIÈRES</th>
                      <th className="border-r border-black w-[5%]">Max INT</th>
                      <th className="border-r border-black w-[5%]">Max EX</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Max Tot</th>
                      
                      {/* Sub columns adapt purely to match 1_4.png configurations */}
                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 1" : "MID"}</th>
                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 2" : "EXAM"}</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 1" : "MID"}</th>
                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 2" : "EXAM"}</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 1" : "MID"}</th>
                      <th className="border-r border-black w-[5%]">{viewMode === "midterm_report" ? "MID 2" : "EXAM"}</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[6%] bg-gray-100">Total Max</th>
                      <th className="border-r border-black w-[6%]">total</th>
                      <th className="w-[6%]">%</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {/* PART 1: Academic Track */}
                    {academicSubjects.map((sub) => {
                      if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;

                      const mData = studentMarks[sub.name] || {};
                      
                      // Terms calculation mapping
                      const mapTermFields = (t: string) => {
                        const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                        const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                        const total = (m1 !== "-" || m2 !== "-") ? (m1 !== "-" ? Number(m1) : 0) + (m2 !== "-" ? Number(m2) : 0) : "-";
                        return { m1, m2, total };
                      };

                      const t1 = mapTermFields("term1");
                      const t2 = mapTermFields("term2");
                      const t3 = mapTermFields("term3");

                      const maxRowCombined = (sub.maxInt + sub.maxEx) * 3;
                      const acquiredRowCombined = ((t1.total !== "-" ? t1.total : 0) + (t2.total !== "-" ? t2.total : 0) + (t3.total !== "-" ? t3.total : 0));
                      const percentageRowCombined = acquiredRowCombined > 0 ? ((acquiredRowCombined / maxRowCombined) * 100).toFixed(1) : "-";

                      return (
                        <tr key={sub.name} className="border-b border-black h-7 text-center">
                          <td className="text-left font-black border-r-2 border-black pl-2 uppercase text-blue-950">{sub.name}</td>
                          <td className="border-r border-black text-gray-400 font-serif">{sub.maxInt}</td>
                          <td className="border-r-2 border-black text-gray-400 font-serif">{sub.maxEx}</td>
                          <td className="border-r-2 border-black bg-gray-50">{sub.maxInt + sub.maxEx}</td>
                          
                          {/* Term 1 columns */}
                          <td className="border-r border-black font-serif">{t1.m1}</td>
                          <td className="border-r border-black font-serif">{t1.m2}</td>
                          <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t1.total}</td>

                          {/* Term 2 columns */}
                          <td className="border-r border-black font-serif">{t2.m1}</td>
                          <td className="border-r border-black font-serif">{t2.m2}</td>
                          <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t2.total}</td>

                          {/* Term 3 columns */}
                          <td className="border-r border-black font-serif">{t3.m1}</td>
                          <td className="border-r border-black font-serif">{t3.m2}</td>
                          <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t3.total}</td>

                          {/* Annual Fields */}
                          <td className="border-r border-black bg-gray-100 font-serif">{maxRowCombined}</td>
                          <td className="border-r border-black font-serif font-bold text-blue-950">{acquiredRowCombined || "-"}</td>
                          <td className="font-serif font-bold text-blue-950">{percentageRowCombined !== "-" ? `${percentageRowCombined}%` : "-"}</td>
                        </tr>
                      );
                    })}

                    {/* PART 2 Section Splitter Logic block: Rendered ONLY in Full-Term mode layout */}
                    {viewMode === "full_term_report" && (
                      <>
                        <tr className="bg-gray-100 border-t-2 border-b-2 border-black h-6 font-black text-center">
                          <td colSpan={19} className="tracking-widest text-[10px] uppercase text-gray-800">
                            CO-CURRICULA ACTIVITIES
                          </td>
                        </tr>

                        {coCurricularSubjects.map((sub) => {
                          const mData = studentMarks[sub.name] || {};
                          
                          const mapTermFields = (t: string) => {
                            const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                            const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                            const total = (m1 !== "-" || m2 !== "-") ? (m1 !== "-" ? Number(m1) : 0) + (m2 !== "-" ? Number(m2) : 0) : "-";
                            return { m1, m2, total };
                          };

                          const t1 = mapTermFields("term1");
                          const t2 = mapTermFields("term2");
                          const t3 = mapTermFields("term3");

                          const maxRowCombined = (sub.maxInt + sub.maxEx) * 3;
                          const acquiredRowCombined = ((t1.total !== "-" ? t1.total : 0) + (t2.total !== "-" ? t2.total : 0) + (t3.total !== "-" ? t3.total : 0));
                          const percentageRowCombined = acquiredRowCombined > 0 ? ((acquiredRowCombined / maxRowCombined) * 100).toFixed(1) : "-";

                          return (
                            <tr key={sub.name} className="border-b border-black h-7 text-center">
                              <td className="text-left font-black border-r-2 border-black pl-2 uppercase text-gray-700">{sub.name}</td>
                              <td className="border-r border-black text-gray-400 font-serif">{sub.maxInt}</td>
                              <td className="border-r-2 border-black text-gray-400 font-serif">{sub.maxEx}</td>
                              <td className="border-r-2 border-black bg-gray-50">{sub.maxInt + sub.maxEx}</td>
                              
                              <td className="border-r border-black font-serif">{t1.m1}</td>
                              <td className="border-r border-black font-serif">{t1.m2}</td>
                              <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t1.total}</td>

                              <td className="border-r border-black font-serif">{t2.m1}</td>
                              <td className="border-r border-black font-serif">{t2.m2}</td>
                              <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t2.total}</td>

                              <td className="border-r border-black font-serif">{t3.m1}</td>
                              <td className="border-r border-black font-serif">{t3.m2}</td>
                              <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t3.total}</td>

                              <td className="border-r border-black bg-gray-100 font-serif">{maxRowCombined}</td>
                              <td className="border-r border-black font-serif font-bold text-gray-800">{acquiredRowCombined || "-"}</td>
                              <td className="font-serif font-bold text-gray-800">{percentageRowCombined !== "-" ? `${percentageRowCombined}%` : "-"}</td>
                            </tr>
                          );
                        })}
                      </>
                    )}

                    {/* TOTAL GENERAL FOOTER ROWS */}
                    <tr className="border-t-2 border-b border-black h-7 bg-gray-50/80 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black text-blue-950 uppercase">TOTAL GENERAL</td>
                      <td className="border-r border-black text-gray-400 font-serif">{viewMode === "midterm_report" ? "275" : "285"}</td>
                      <td className="border-r border-black text-gray-400 font-serif">{viewMode === "midterm_report" ? "275" : "285"}</td>
                      <td className="border-r-2 border-black bg-gray-100/70 font-serif">{viewMode === "midterm_report" ? "550" : "570"}</td>
                      
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t1Data.acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {t1Data.mx}</span></td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t2Data.acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {t2Data.mx}</span></td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t3Data.acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {t3Data.mx}</span></td>
                      
                      <td className="border-r border-black bg-gray-100 font-serif">{student.scoreMaxTotal}</td>
                      <td className="border-r border-black font-serif text-blue-900">{student.scoreAcquired}</td>
                      <td className="font-serif text-blue-900">{student.percentage.toFixed(1)}%</td>
                    </tr>

                    {/* POURCENTAGE FOOTER ROW */}
                    <tr className="border-b border-black h-7 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t1Data.mx > 0 ? `${((t1Data.acq / t1Data.mx) * 100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t2Data.mx > 0 ? `${((t2Data.acq / t2Data.mx) * 100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950">{t3Data.mx > 0 ? `${((t3Data.acq / t3Data.mx) * 100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="bg-gray-100 font-serif font-bold text-blue-900">{student.percentage.toFixed(1)}%</td>
                    </tr>

                    {/* PLACE / RANK FOOTER ROW */}
                    <tr className="h-7 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                      <td colSpan={3} className="border-r-2 border-black text-green-800 font-serif uppercase">SUR {students.length}</td>
                      <td colSpan={3} className="border-r-2 border-black text-green-800 font-serif uppercase">SUR {students.length}</td>
                      <td colSpan={3} className="border-r-2 border-black text-green-800 font-serif uppercase">SUR {students.length}</td>
                      <td colSpan={3} className="bg-green-50 text-green-900 font-serif font-bold text-xs uppercase">
                        {student.position} SUR {students.length}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Verified Underline-Free Signature Segment Section */}
              <div className="flex justify-between items-end mt-3 font-black text-[10px]">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block mb-0.5">Class Teacher Name:</span>
                  <div className="text-xs uppercase text-blue-900 tracking-wide font-black print-teacher-line">
                    {classTeacherName || "NOT ASSIGNED"}
                  </div>
                </div>
                <div className="border border-dashed border-gray-400 rounded px-5 py-1.5 bg-gray-50 text-gray-400 uppercase tracking-widest text-[8px]">
                  School Stamp Block Area
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportCardsPage() {
  return (
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Loading Filtered Report Matrices...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}