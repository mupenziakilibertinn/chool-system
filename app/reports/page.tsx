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

function ReportCardsEngine() {
  const searchParams = useSearchParams();
  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  const activeClass = urlClass ? urlClass.toUpperCase() : "P4";

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
        // 1. Fetch Class Teacher Profile Details
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

        // 2. Fetch Class Roster
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        // 3. Populate Marks Matrices across Terms
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

        // 4. Processing Annual Metrics
        const processedStudents = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          
          let academicMaxTotal = 0;
          let academicAcquiredTotal = 0;
          let fullMaxTotal = 0;
          let fullAcquiredTotal = 0;

          // Compute Term totals cleanly
          const getTermTotals = (term: string) => {
            let acq = 0;
            let mx = 0;
            [...academicSubjects, ...coCurricularSubjects].forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              const midVal = mData[`${term}_t1`] ?? mData[`${term}_m1`] ?? "-";
              const exVal = mData[`${term}_t2`] ?? mData[`${term}_m2`] ?? "-";
              
              if (midVal !== "-" || exVal !== "-") {
                acq += (midVal !== "-" ? Number(midVal) : 0) + (exVal !== "-" ? Number(exVal) : 0);
              }
              mx += sub.maxInt + sub.maxEx;
            });
            return { acq, mx };
          };

          const t1Metrics = getTermTotals("term1");
          const t2Metrics = getTermTotals("term2");
          const t3Metrics = getTermTotals("term3");

          academicSubjects.forEach((sub) => {
            if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
            academicMaxTotal += (sub.maxInt + sub.maxEx) * 3;
            const mData = studentMarks[sub.name] || {};
            ["term1", "term2", "term3"].forEach((t) => {
              const m = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
              const e = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
              academicAcquiredTotal += (m !== "-" ? Number(m) : 0) + (e !== "-" ? Number(e) : 0);
            });
          });

          coCurricularSubjects.forEach((sub) => {
            fullMaxTotal += (sub.maxInt + sub.maxEx) * 3;
            const mData = studentMarks[sub.name] || {};
            ["term1", "term2", "term3"].forEach((t) => {
              const m = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
              const e = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
              fullAcquiredTotal += (m !== "-" ? Number(m) : 0) + (e !== "-" ? Number(e) : 0);
            });
          });

          fullMaxTotal += academicMaxTotal;
          fullAcquiredTotal += academicAcquiredTotal;

          const percentage = fullMaxTotal > 0 ? (fullAcquiredTotal / fullMaxTotal) * 100 : 0;

          return {
            ...student,
            t1Acq: t1Metrics.acq, t1Max: t1Metrics.mx,
            t2Acq: t2Metrics.acq, t2Max: t2Metrics.mx,
            t3Acq: t3Metrics.acq, t3Max: t3Metrics.mx,
            academicAcquiredTotal, academicMaxTotal,
            fullAcquiredTotal, fullMaxTotal,
            percentage
          };
        });

        // Calculate Rankings
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
        console.error("Layout engine error:", err);
      }
      setLoading(false);
    };

    fetchClassReports();
  }, [activeClass]);

  const handlePrintAll = () => {
    setIsPrintAllMode(true);
    setActiveStudentId(null);
    setTimeout(() => { window.print(); }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-[11px] pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 5mm 5mm 5mm 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-card {
            border: 3px solid black !important;
            padding: 12px !important;
            margin: 0 auto !important;
            width: 100% !important;
            height: 198mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          .print-teacher-line { border: none !important; text-decoration: none !important; }
          .print-hidden { display: none !important; }
        }
      `}} />

      <div className="bg-white border-b-2 p-4 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="font-black text-blue-900 uppercase tracking-wider text-sm">
            Active Layout Stream Focus: {activeClass}
          </div>
          <button onClick={handlePrintAll} className="bg-blue-900 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl shadow">
            Print Landscape Grade Sheets (Single-Click) 🖨️
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 space-y-12 mt-4">
        {students.map((student) => {
          const studentMarks = allMarks[student.id] || {};
          const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
          if (!isVisible) return null;

          const renderRows = (list: typeof academicSubjects) => {
            return list.map((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;
              
              const mData = studentMarks[sub.name] || {};
              
              const t1_m = mData["term1_t1"] ?? mData["term1_m1"] ?? "-";
              const t1_e = mData["term1_t2"] ?? mData["term1_m2"] ?? "-";
              const t1_tot = (t1_m !== "-" || t1_e !== "-") ? (t1_m !== "-" ? Number(t1_m) : 0) + (t1_e !== "-" ? Number(t1_e) : 0) : "-";

              const t2_m = mData["term2_t1"] ?? mData["term2_m1"] ?? "-";
              const t2_e = mData["term2_t2"] ?? mData["term2_m2"] ?? "-";
              const t2_tot = (t2_m !== "-" || t2_e !== "-") ? (t2_m !== "-" ? Number(t2_m) : 0) + (t2_e !== "-" ? Number(t2_e) : 0) : "-";

              const t3_m = mData["term3_t1"] ?? mData["term3_m1"] ?? "-";
              const t3_e = mData["term3_t2"] ?? mData["term3_m2"] ?? "-";
              const t3_tot = (t3_m !== "-" || t3_e !== "-") ? (t3_m !== "-" ? Number(t3_m) : 0) + (t3_e !== "-" ? Number(t3_e) : 0) : "-";

              const annualMax = (sub.maxInt + sub.maxEx) * 3;
              const annualTot = ((t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0));
              const annualPct = annualTot > 0 ? ((annualTot / annualMax) * 100).toFixed(1) : "-";

              return (
                <tr key={sub.name} className="border-b border-black h-7 text-center">
                  <td className="text-left font-black border-r-2 border-black pl-2 uppercase">{sub.name}</td>
                  <td className="border-r border-black">{sub.maxInt}</td>
                  <td className="border-r border-black">{sub.maxEx}</td>
                  <td className="border-r-2 border-black bg-gray-50">{sub.maxInt + sub.maxEx}</td>
                  
                  {/* Term 1 */}
                  <td className="border-r border-black font-serif">{t1_m}</td>
                  <td className="border-r border-black font-serif">{t1_e}</td>
                  <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t1_tot}</td>

                  {/* Term 2 */}
                  <td className="border-r border-black font-serif">{t2_m}</td>
                  <td className="border-r border-black font-serif">{t2_e}</td>
                  <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t2_tot}</td>

                  {/* Term 3 */}
                  <td className="border-r border-black font-serif">{t3_m}</td>
                  <td className="border-r border-black font-serif">{t3_e}</td>
                  <td className="border-r-2 border-black bg-gray-50 font-serif font-bold">{t3_tot}</td>

                  {/* Annual Summary Columns */}
                  <td className="border-r border-black bg-gray-100">{annualMax}</td>
                  <td className="border-r border-black font-serif font-bold text-blue-900">{annualTot || "-"}</td>
                  <td className="font-serif font-bold text-blue-900">{annualPct !== "-" ? `${annualPct}%` : "-"}</td>
                </tr>
              );
            });
          };

          return (
            <div key={student.id} className="bg-white border-[3px] border-black p-4 print-card flex flex-col justify-between shadow-sm">
              <div>
                {/* Meta Matrix Banner Block */}
                <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 font-black">
                  <div className="uppercase">ANNEE: <span className="text-blue-900 ml-1 font-serif">2026</span></div>
                  <div className="uppercase">NOM DU STAGIAIRE / STUDENT: <span className="text-blue-900 ml-1 text-xs">{student.name}</span></div>
                  <div className="uppercase">CLASSE: <span className="text-blue-900 ml-1">{student.class}</span></div>
                  <div className="uppercase">Nombre d'élèves: <span className="text-blue-900 ml-1 font-serif">{students.length}</span></div>
                </div>

                {/* Main Landscape Ledger Table */}
                <table className="w-full border-collapse border-[3px] border-black text-[11px] font-black">
                  <thead>
                    {/* Level 1 Group Header Row */}
                    <tr className="bg-gray-100 border-b-2 border-black h-6">
                      <th colSpan={4} className="border-r-2 border-black text-left pl-2">MATIÈRES / SUBJECTS</th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">1st TERM</th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">2nd TERM</th>
                      <th colSpan={3} className="border-r-2 border-black text-center tracking-wider text-[10px]">3rd TERM</th>
                      <th colSpan={3} className="text-center tracking-wider text-[10px]">ANNUAL TOTAL</th>
                    </tr>
                    {/* Level 2 Subtitle Column Identifiers */}
                    <tr className="bg-gray-50 border-b-2 border-black h-6 text-center text-[10px]">
                      <th className="border-r-2 border-black text-left pl-2 w-[22%]">MATIÈRES</th>
                      <th className="border-r border-black w-[5%]">Max INT</th>
                      <th className="border-r border-black w-[5%]">Max EX</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Max Tot</th>
                      
                      <th className="border-r border-black w-[5%]">MID</th>
                      <th className="border-r border-black w-[5%]">EXAM</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[5%]">MID</th>
                      <th className="border-r border-black w-[5%]">EXAM</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[5%]">MID</th>
                      <th className="border-r border-black w-[5%]">EXAM</th>
                      <th className="border-r-2 border-black w-[6%] bg-gray-100">Total</th>

                      <th className="border-r border-black w-[6%] bg-gray-100">Total Max</th>
                      <th className="border-r border-black w-[6%]">total</th>
                      <th className="w-[6%]">%</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {/* Section A: Academic Track */}
                    {renderRows(academicSubjects)}

                    {/* Section B: Co-Curricula Segment Header Banner */}
                    <tr className="bg-gray-100 border-t-2 border-b-2 border-black h-6 font-black text-center">
                      <td colSpan={19} className="tracking-widest text-[10px] uppercase text-gray-800">
                        CO-CURRICULA ACTIVITIES
                      </td>
                    </tr>

                    {/* Section C: Co-Curricula Data Rows */}
                    {renderRows(coCurricularSubjects)}

                    {/* Section D: Aggregate Data Footers */}
                    <tr className="border-t-2 border-b border-black h-7 bg-gray-50 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black text-blue-950 uppercase">TOTAL GENERAL</td>
                      <td className="border-r border-black">285</td>
                      <td className="border-r border-black">285</td>
                      <td className="border-r-2 border-black font-serif">570</td>
                      
                      <td colSpan={3} className="border-r-2 border-black font-serif text-xs text-blue-950">{student.t1Acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {student.t1Max}</span></td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-xs text-blue-950">{student.t2Acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {student.t2Max}</span></td>
                      <td colSpan={3} className="border-r-2 border-black font-serif text-xs text-blue-950">{student.t3Acq || "-"} <span className="text-[9px] text-gray-400 font-normal">/ {student.t3Max}</span></td>
                      
                      <td className="border-r border-black bg-gray-100 font-serif">{student.fullMaxTotal}</td>
                      <td className="border-r border-black font-serif text-blue-900 text-xs">{student.fullAcquiredTotal}</td>
                      <td className="font-serif text-blue-900 text-xs">{student.percentage.toFixed(1)}%</td>
                    </tr>

                    <tr className="border-b border-black h-7 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="border-r-2 border-black bg-gray-100">-</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif">{student.t1Max > 0 ? `${((student.t1Acq/student.t1Max)*100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif">{student.t2Max > 0 ? `${((student.t2Acq/student.t2Max)*100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="border-r-2 border-black font-serif">{student.t3Max > 0 ? `${((student.t3Acq/student.t3Max)*100).toFixed(1)}%` : "-"}</td>
                      <td colSpan={3} className="bg-gray-50 font-serif font-bold text-blue-900">{student.percentage.toFixed(1)}%</td>
                    </tr>

                    <tr className="h-7 text-center font-black">
                      <td className="text-left pl-2 border-r-2 border-black uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="border-r-2 border-black bg-gray-100">-</td>
                      <td colSpan={3} className="border-r-2 border-black uppercase font-serif text-green-800">SUR {students.length}</td>
                      <td colSpan={3} className="border-r-2 border-black uppercase font-serif text-green-800">SUR {students.length}</td>
                      <td colSpan={3} className="border-r-2 border-black uppercase font-serif text-green-800">SUR {students.length}</td>
                      <td colSpan={3} className="bg-green-50 text-green-900 font-serif font-bold text-xs">
                        {student.position} SUR {students.length}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Verified Underline-Free Signature Segment Block */}
              <div className="flex justify-between items-end mt-4 font-black text-[10px]">
                <div className="w-[30%]">
                  <span className="text-gray-400 uppercase tracking-wider block mb-1">Class Teacher Name:</span>
                  <div className="text-xs uppercase text-blue-900 tracking-wide font-black print-teacher-line">
                    {classTeacherName || "NOT ASSIGNED"}
                  </div>
                </div>
                <div className="border border-dashed border-gray-400 rounded px-6 py-2 bg-gray-50 text-gray-400 uppercase tracking-widest text-[9px]">
                  School Stamp Area
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
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Initialising Grade Sheet Array Engine...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}