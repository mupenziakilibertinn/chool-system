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

type ReportType = "mid1_report" | "mid2_report" | "final_report";

function ReportCardsEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  
  const [activeClass, setActiveClass] = useState(urlClass ? urlClass.toUpperCase() : "P4");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [reportType, setReportType] = useState<ReportType>("final_report");
  
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [classTeacherName, setClassTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(urlStudentId);
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);

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

        // 2. Fetch Student Population
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        // 3. Collect Marks Matrices
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

        // 4. Calculate Values & Dynamic Performance Metrics
        const processedStudents = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          let scoreAcquired = 0;
          let scoreMaxTotal = 0;

          if (reportType === "mid1_report" || reportType === "mid2_report") {
            // Mid Term Single-Assessment Mode
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              const targetField = reportType === "mid1_report" 
                ? (mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-")
                : (mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-");

              if (targetField !== "-") scoreAcquired += Number(targetField);
              scoreMaxTotal += reportType === "mid1_report" ? sub.maxInt : sub.maxEx;
            });
          } else {
            // Final Report Mode - Cumulative Full Term Matrix System across ALL 3 Terms
            const termsList = ["term1", "term2", "term3"];
            academicSubjects.forEach((sub) => {
              if (activeClass === "P6" && sub.name === "FRANÇAIS") return;
              const mData = studentMarks[sub.name] || {};
              termsList.forEach((t) => {
                const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                if (m1 !== "-") scoreAcquired += Number(m1);
                if (m2 !== "-") scoreAcquired += Number(m2);
                scoreMaxTotal += sub.maxInt + sub.maxEx;
              });
            });

            coCurricularSubjects.forEach((sub) => {
              const mData = studentMarks[sub.name] || {};
              termsList.forEach((t) => {
                const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                if (m1 !== "-") scoreAcquired += Number(m1);
                if (m2 !== "-") scoreAcquired += Number(m2);
                scoreMaxTotal += sub.maxInt + sub.maxEx;
              });
            });
          }

          const percentage = scoreMaxTotal > 0 ? (scoreAcquired / scoreMaxTotal) * 100 : 0;
          return { ...student, scoreAcquired, scoreMaxTotal, percentage };
        });

        // Calculate Position Rankings
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
        console.error("Data tracking failure:", err);
      }
      setLoading(false);
    };

    fetchClassReports();
  }, [activeClass, selectedTerm, reportType]);

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
            padding: 8px !important;
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

      {/* Control Dashboard Panel */}
      <div className="bg-white border-b-2 p-4 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Select Class</label>
              <select value={activeClass} onChange={(e) => handleClassChange(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-950 min-w-[140px]">
                <option value="P1">Primary 1 (P1)</option>
                <option value="P2">Primary 2 (P2)</option>
                <option value="P3">Primary 3 (P3)</option>
                <option value="P4">Primary 4 (P4)</option>
                <option value="P5">Primary 5 (P5)</option>
                <option value="P6">Primary 6 (P6)</option>
              </select>
            </div>

            {reportType !== "final_report" && (
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Active Term</label>
                <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs text-blue-950 min-w-[120px]">
                  <option value="term1">Term 1</option>
                  <option value="term2">Term 2</option>
                  <option value="term3">Term 3</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Report Choice Selection</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900 min-w-[280px]">
                <option value="mid1_report">1. MID TERM 1 (Clean Single Layout)</option>
                <option value="mid2_report">2. MID TERM 2 (Clean Single Layout)</option>
                <option value="final_report">3. FINAL REPORT CARD (Dual Layout View)</option>
              </select>
            </div>
          </div>

          <button onClick={handlePrintAll} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl shadow mt-4 sm:mt-0">
            Print Complete Report Batch 🖨️
          </button>
        </div>
      </div>

      {/* Main Container Layout Frame */}
      <div className="max-w-[1140px] mx-auto p-4 space-y-12 mt-4">
        {loading ? (
          <div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest animate-pulse">Processing Layout Systems...</div>
        ) : students.length === 0 ? (
          <div className="bg-white border p-12 text-center rounded-xl shadow-sm text-gray-500 text-sm font-bold">No students found.</div>
        ) : (
          students.map((student) => {
            const studentMarks = allMarks[student.id] || {};
            const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
            if (!isVisible) return null;

            // Compute dynamic aggregations for single midterm layouts
            let totalMaxGeneral = 0;
            let totalAcquiredGeneral = 0;

            // Midterm Part 1 dynamic sub aggregates for the side-by-side template layout 
            let leftSideTerm1Sum = 0;
            let leftSideTerm2Sum = 0;
            let leftSideTerm3Sum = 0;
            let leftSideMaxSubtotals = 0;

            // Part 2 dynamic calculations for academic sub entries on right layout card
            let rightSideAcademicAcq = 0;
            let rightSideAcademicMax = 0;

            return (
              <div key={student.id} className="bg-white border-[3px] border-black p-4 print-card flex flex-col justify-between shadow-sm">
                
                {/* ==================== FORMAT VIEW 1: MID TERM 1 & 2 (SINGLE CLEAN TABLE) ==================== */}
                {(reportType === "mid1_report" || reportType === "mid2_report") && (
                  <div>
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 font-black text-[10px]">
                      <div className="uppercase">ANNEE: <span className="text-blue-900 font-serif">2026</span></div>
                      <div className="uppercase">NOM DU STAGIAIRE / STUDENT: <span className="text-blue-900 ml-1 text-xs">{student.name}</span></div>
                      <div className="uppercase">CLASSE: <span className="text-blue-900 ml-1">{student.class}</span></div>
                      <div className="uppercase">Nombre d'élèves: <span className="text-blue-900 font-serif ml-1">{students.length}</span></div>
                    </div>

                    <table className="w-full border-collapse border-[3px] border-black text-[11px] font-black">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-black h-6">
                          <th colSpan={4} className="border-r-2 border-black text-left pl-2 uppercase">MATIÈRES / SUBJECTS</th>
                          <th colSpan={3} className="border-r-2 border-black text-center text-[10px] uppercase">{selectedTerm} EVALUATION</th>
                          <th colSpan={3} className="text-center text-[10px]">TOTAL SCORES</th>
                        </tr>
                        <tr className="bg-gray-50 border-b-2 border-black h-6 text-center text-[10px]">
                          <th className="border-r-2 border-black text-left pl-2 w-[25%]">MATIÈRES</th>
                          <th className="border-r border-black w-[8%]">Max INT</th>
                          <th className="border-r border-black w-[8%]">Max EX</th>
                          <th className="border-r-2 border-black w-[10%] bg-gray-100">Max Tot</th>
                          <th className="border-r border-black w-[11%]">{reportType === "mid1_report" ? "MID 1" : "MID 2"}</th>
                          <th className="border-r border-black w-[11%]">-</th>
                          <th className="border-r-2 border-black w-[11%] bg-gray-100">Total</th>
                          <th className="border-r border-black w-[12%] bg-gray-100">Total Max</th>
                          <th className="border-r border-black w-[12%]">total</th>
                          <th className="w-[12%]">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {academicSubjects.map((sub) => {
                          if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;
                          const mData = studentMarks[sub.name] || {};
                          const mark = reportType === "mid1_report"
                            ? (mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-")
                            : (mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-");

                          const rowMax = reportType === "mid1_report" ? sub.maxInt : sub.maxEx;
                          if (mark !== "-") {
                            totalAcquiredGeneral += Number(mark);
                          }
                          totalMaxGeneral += rowMax;

                          const rowPct = mark !== "-" ? ((Number(mark) / rowMax) * 100).toFixed(1) : "-";

                          return (
                            <tr key={sub.name} className="border-b border-black h-7 text-center">
                              <td className="text-left font-black border-r-2 border-black pl-2 uppercase text-blue-950">{sub.name}</td>
                              <td className="border-r border-black text-gray-400 font-serif">{sub.maxInt}</td>
                              <td className="border-r-2 border-black text-gray-400 font-serif">{sub.maxEx}</td>
                              <td className="border-r-2 border-black bg-gray-50">{rowMax}</td>
                              <td className="border-r border-black font-serif font-bold">{mark}</td>
                              <td className="border-r border-black font-serif text-gray-300">-</td>
                              <td className="border-r-2 border-black bg-gray-50 font-serif font-bold text-blue-900">{mark}</td>
                              <td className="border-r border-black bg-gray-100 font-serif">{rowMax}</td>
                              <td className="border-r border-black font-serif font-bold text-blue-950">{mark}</td>
                              <td className="font-serif font-bold text-blue-950">{rowPct !== "-" ? `${rowPct}%` : "-"}</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-b border-black h-7 bg-gray-50 text-center font-black">
                          <td className="text-left pl-2 border-r-2 border-black text-blue-950 uppercase">TOTAL GENERAL</td>
                          <td colSpan={3} className="border-r-2 border-black bg-gray-100 font-serif">{totalMaxGeneral}</td>
                          <td colSpan={3} className="border-r-2 border-black font-serif text-blue-900 text-sm">{totalAcquiredGeneral}</td>
                          <td className="border-r border-black bg-gray-100 font-serif">{totalMaxGeneral}</td>
                          <td className="border-r border-black font-serif text-blue-900 text-sm">{totalAcquiredGeneral}</td>
                          <td className="font-serif text-blue-900 text-sm">
                            {totalMaxGeneral > 0 ? `${((totalAcquiredGeneral / totalMaxGeneral) * 100).toFixed(1)}%` : "-"}
                          </td>
                        </tr>
                        <tr className="border-b border-black h-7 text-center font-black">
                          <td className="text-left pl-2 border-r-2 border-black uppercase">POURCENTAGE</td>
                          <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                          <td colSpan={3} className="border-r-2 border-black font-serif text-blue-950 bg-blue-50/20">
                            {totalMaxGeneral > 0 ? `${((totalAcquiredGeneral / totalMaxGeneral) * 100).toFixed(1)}%` : "-"}
                          </td>
                          <td colSpan={3} className="bg-gray-100 font-serif font-bold text-blue-900">
                            {totalMaxGeneral > 0 ? `${((totalAcquiredGeneral / totalMaxGeneral) * 100).toFixed(1)}%` : "-"}
                          </td>
                        </tr>
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
                )}

                {/* ==================== FORMAT VIEW 2: FINAL REPORT CARD (SIDE-BY-SIDE TWO PARTS) ==================== */}
                {reportType === "final_report" && (
                  <div className="flex gap-4 items-start w-full">
                    
                    {/* -------------------- LEFT SIDE: PART 1 (Academic Midterms Combination) -------------------- */}
                    <div className="w-[50%] border-[2px] border-black p-1.5 bg-white">
                      <div className="flex justify-between text-[8px] font-black uppercase mb-1 border-b border-black pb-0.5">
                        <span>ANNEE: 2026</span>
                        <span className="text-blue-900 text-[9px]">{student.name}</span>
                        <span>CLASSE: {student.class}</span>
                      </div>
                      
                      <table className="w-full border-collapse border border-black text-[9px] font-black text-center">
                        <thead>
                          <tr className="bg-gray-100 border-b border-black h-5">
                            <th className="text-left pl-1 border-r border-black w-[28%]">SUBJECTS</th>
                            <th className="border-r border-black w-[8%]">MID 1</th>
                            <th className="border-r border-black w-[8%]">MID 2</th>
                            <th className="border-r-2 border-black bg-gray-50 w-[10%]">Total</th>
                            <th className="border-r border-black w-[8%]">1st T</th>
                            <th className="border-r border-black w-[8%]">2nd T</th>
                            <th className="border-r border-black w-[8%]">3rd T</th>
                            <th className="border-r border-black w-[10%] bg-gray-50">Max</th>
                            <th className="border-r border-black w-[10%]">Total</th>
                            <th className="w-[8%]">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {academicSubjects.map((sub) => {
                            if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;
                            const mData = studentMarks[sub.name] || {};
                            
                            const getTermTotal = (t: string) => {
                              const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                              const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                              return (m1 !== "-" || m2 !== "-") ? (m1 !== "-" ? Number(m1) : 0) + (m2 !== "-" ? Number(m2) : 0) : 0;
                            };

                            const t1 = getTermTotal("term1");
                            const t2 = getTermTotal("term2");
                            const t3 = getTermTotal("term3");
                            
                            leftSideTerm1Sum += t1;
                            leftSideTerm2Sum += t2;
                            leftSideTerm3Sum += t3;

                            const sumAcq = t1 + t2 + t3;
                            const maxRow = (sub.maxInt + sub.maxEx) * 3;
                            leftSideMaxSubtotals += maxRow;

                            return (
                              <tr key={sub.name} className="border-b border-black h-6">
                                <td className="text-left pl-1 border-r border-black uppercase text-blue-950 text-[8px]">{sub.name}</td>
                                <td className="border-r border-black font-serif text-gray-500">{sub.maxInt}</td>
                                <td className="border-r border-black font-serif text-gray-500">{sub.maxEx}</td>
                                <td className="border-r-2 border-black bg-gray-50 font-serif">{sub.maxInt + sub.maxEx}</td>
                                <td className="border-r border-black font-serif">{t1 || "-"}</td>
                                <td className="border-r border-black font-serif">{t2 || "-"}</td>
                                <td className="border-r border-black font-serif">{t3 || "-"}</td>
                                <td className="border-r border-black bg-gray-50 font-serif">{maxRow}</td>
                                <td className="border-r border-black font-serif text-blue-900">{sumAcq || "-"}</td>
                                <td className="font-serif text-blue-900">{sumAcq > 0 ? `${((sumAcq / maxRow) * 100).toFixed(0)}%` : "-"}</td>
                              </tr>
                            );
                          })}
                          
                          {/* Part 1 Summary Rows */}
                          <tr className="bg-gray-50 font-bold h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">TOTAL GENER.</td>
                            <td className="border-r border-black font-serif text-gray-400">{activeClass === "P6" ? "250" : "275"}</td>
                            <td className="border-r border-black font-serif text-gray-400">{activeClass === "P6" ? "250" : "275"}</td>
                            <td className="border-r-2 border-black bg-gray-100 font-serif">{activeClass === "P6" ? "500" : "550"}</td>
                            <td className="border-r border-black font-serif text-blue-900">{leftSideTerm1Sum || "-"}</td>
                            <td className="border-r border-black font-serif text-blue-900">{leftSideTerm2Sum || "-"}</td>
                            <td className="border-r border-black font-serif text-blue-900">{leftSideTerm3Sum || "-"}</td>
                            <td className="border-r border-black font-serif bg-gray-100">{leftSideMaxSubtotals}</td>
                            <td colSpan={2} className="font-serif text-blue-900 text-center text-xs">{(leftSideTerm1Sum + leftSideTerm2Sum + leftSideTerm3Sum) || "-"}</td>
                          </tr>
                          <tr className="h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">POURCENTAGE</td>
                            <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                            <td colSpan={3} className="border-r border-black font-serif text-blue-900">
                              {leftSideMaxSubtotals > 0 ? `${(((leftSideTerm1Sum + leftSideTerm2Sum + leftSideTerm3Sum) / leftSideMaxSubtotals) * 100).toFixed(1)}%` : "-"}
                            </td>
                            <td colSpan={3} className="font-serif font-bold text-blue-900 text-center">
                              {leftSideMaxSubtotals > 0 ? `${(((leftSideTerm1Sum + leftSideTerm2Sum + leftSideTerm3Sum) / leftSideMaxSubtotals) * 100).toFixed(1)}%` : "-"}
                            </td>
                          </tr>
                          <tr className="h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">PLACE</td>
                            <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                            <td colSpan={3} className="border-r border-black text-green-800 text-center font-serif text-[8px]">SUR {students.length}</td>
                            <td colSpan={3} className="bg-green-50 text-green-900 font-serif text-center font-bold text-[9px]">
                              {student.position} SUR {students.length}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* -------------------- RIGHT SIDE: PART 2 (Cumulative MID + EXAM + Co-Curricular) -------------------- */}
                    <div className="w-[50%] border-[2px] border-black p-1.5 bg-white">
                      <div className="flex justify-between text-[8px] font-black uppercase mb-1 border-b border-black pb-0.5">
                        <span>MATIÈRES / ENTRIES</span>
                        <span>Nombre d'élèves: {students.length}</span>
                      </div>
                      
                      <table className="w-full border-collapse border border-black text-[9px] font-black text-center">
                        <thead>
                          <tr className="bg-gray-100 border-b border-black h-5">
                            <th className="text-left pl-1 border-r border-black w-[25%]">MATIÈRES</th>
                            <th className="border-r border-black w-[6%]">MaxI</th>
                            <th className="border-r border-black w-[6%]">MaxE</th>
                            <th className="border-r border-black w-[8%] bg-gray-50">Tot</th>
                            <th className="border-r border-black w-[8%]">MID</th>
                            <th className="border-r border-black w-[8%]">EXAM</th>
                            <th className="border-r border-black w-[9%] bg-gray-50">Total</th>
                            <th className="border-r border-black w-[10%] bg-gray-50">TotalMax</th>
                            <th className="border-r border-black w-[10%]">total</th>
                            <th className="w-[10%]">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {academicSubjects.map((sub) => {
                            if (activeClass === "P6" && sub.name === "FRANÇAIS") return null;
                            const mData = studentMarks[sub.name] || {};
                            
                            // Load selected active term evaluation marks for tracking display
                            const mid = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
                            const ex = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
                            const total = (mid !== "-" || ex !== "-") ? (mid !== "-" ? Number(mid) : 0) + (ex !== "-" ? Number(ex) : 0) : "-";

                            const subTotalMax = (sub.maxInt + sub.maxEx) * 3;
                            rightSideAcademicMax += subTotalMax;

                            // Dynamic annual subject computation
                            const getSubjectAnnualTotal = () => {
                              let s = 0;
                              ["term1", "term2", "term3"].forEach((t) => {
                                const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                                const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                                if (m1 !== "-") s += Number(m1);
                                if (m2 !== "-") s += Number(m2);
                              });
                              return s;
                            };
                            const annualSubTotal = getSubjectAnnualTotal();
                            rightSideAcademicAcq += annualSubTotal;

                            return (
                              <tr key={sub.name} className="border-b border-black h-6">
                                <td className="text-left pl-1 border-r border-black uppercase text-[8px] text-gray-700">{sub.name}</td>
                                <td className="border-r border-black font-serif text-gray-400">{sub.maxInt}</td>
                                <td className="border-r border-black font-serif text-gray-400">{sub.maxEx}</td>
                                <td className="border-r border-black bg-gray-50 font-serif">{sub.maxInt + sub.maxEx}</td>
                                <td className="border-r border-black font-serif">{mid}</td>
                                <td className="border-r border-black font-serif">{ex}</td>
                                <td className="border-r border-black bg-gray-50 font-serif text-blue-900">{total}</td>
                                <td className="border-r border-black bg-gray-100 font-serif">{subTotalMax}</td>
                                <td className="border-r border-black font-serif font-bold text-blue-900">{annualSubTotal || "-"}</td>
                                <td className="font-serif font-bold text-blue-900">
                                  {annualSubTotal > 0 ? `${((annualSubTotal / subTotalMax) * 100).toFixed(0)}%` : "-"}
                                </td>
                              </tr>
                            );
                          })}

                          {/* CO-CURRICULAR SECTION INSERTS */}
                          <tr className="bg-gray-100 border-t border-b border-black h-5 font-black text-center text-[8px] tracking-wider">
                            <td colSpan={10}>CO-CURRICULA ACTIVITIES</td>
                          </tr>

                          {coCurricularSubjects.map((sub) => {
                            const mData = studentMarks[sub.name] || {};
                            const mid = mData[`${selectedTerm}_t1`] ?? mData[`${selectedTerm}_m1`] ?? "-";
                            const ex = mData[`${selectedTerm}_t2`] ?? mData[`${selectedTerm}_m2`] ?? "-";
                            const total = (mid !== "-" || ex !== "-") ? (mid !== "-" ? Number(mid) : 0) + (ex !== "-" ? Number(ex) : 0) : "-";

                            const subTotalMax = (sub.maxInt + sub.maxEx) * 3;
                            rightSideAcademicMax += subTotalMax;

                            const getCoCurricularAnnualTotal = () => {
                              let s = 0;
                              ["term1", "term2", "term3"].forEach((t) => {
                                const m1 = mData[`${t}_t1`] ?? mData[`${t}_m1`] ?? "-";
                                const m2 = mData[`${t}_t2`] ?? mData[`${t}_m2`] ?? "-";
                                if (m1 !== "-") s += Number(m1);
                                if (m2 !== "-") s += Number(m2);
                              });
                              return s;
                            };
                            const annualCoTotal = getCoCurricularAnnualTotal();
                            rightSideAcademicAcq += annualCoTotal;

                            return (
                              <tr key={sub.name} className="border-b border-black h-5 text-center">
                                <td className="text-left pl-1 border-r border-black uppercase text-[8px] text-gray-600">{sub.name}</td>
                                <td className="border-r border-black font-serif text-gray-400">{sub.maxInt}</td>
                                <td className="border-r border-black font-serif text-gray-400">{sub.maxEx}</td>
                                <td className="border-r border-black bg-gray-50 font-serif">{sub.maxInt + sub.maxEx}</td>
                                <td className="border-r border-black font-serif">{mid}</td>
                                <td className="border-r border-black font-serif">{ex}</td>
                                <td className="border-r border-black bg-gray-50 font-serif text-green-900">{total}</td>
                                <td className="border-r border-black bg-gray-100 font-serif">{subTotalMax}</td>
                                <td className="border-r border-black font-serif font-bold text-green-900">{annualCoTotal || "-"}</td>
                                <td className="font-serif text-green-900">
                                  {annualCoTotal > 0 ? `${((annualCoTotal / subTotalMax) * 100).toFixed(0)}%` : "-"}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Part 2 Summary Rows */}
                          <tr className="bg-gray-50 font-bold h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">TOTAL GENER.</td>
                            <td className="border-r border-black font-serif text-gray-400">{activeClass === "P6" ? "260" : "285"}</td>
                            <td className="border-r border-black font-serif text-gray-400">{activeClass === "P6" ? "260" : "285"}</td>
                            <td className="border-r border-black bg-gray-100 font-serif">{activeClass === "P6" ? "520" : "570"}</td>
                            <td colSpan={3} className="border-r border-black font-serif text-blue-900">-</td>
                            <td className="border-r border-black font-serif bg-gray-100">{rightSideAcademicMax}</td>
                            <td colSpan={2} className="font-serif text-blue-900 text-center text-xs">{rightSideAcademicAcq || "-"}</td>
                          </tr>
                          <tr className="h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">POURCENTAGE</td>
                            <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                            <td colSpan={3} className="border-r border-black font-serif text-blue-950">..................%</td>
                            <td colSpan={3} className="bg-gray-100 font-serif font-bold text-blue-900 text-center text-xs">
                              {rightSideAcademicMax > 0 ? `${((rightSideAcademicAcq / rightSideAcademicMax) * 100).toFixed(1)}%` : "-"}
                            </td>
                          </tr>
                          <tr className="h-6 border-t border-black">
                            <td className="text-left pl-1 border-r border-black text-[8px]">PLACE</td>
                            <td colSpan={3} className="border-r-2 border-black bg-gray-100 text-gray-400">-</td>
                            <td colSpan={3} className="border-r border-black text-green-800 text-center font-serif text-[8px]">..................Sur {students.length}</td>
                            <td colSpan={3} className="bg-green-50 text-green-900 font-serif text-center font-bold text-[9px]">
                              {student.position} SUR {students.length}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                )}

                {/* Teacher Signature Block Area */}
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

export default function ReportCardsPage() {
  return (
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest animate-pulse">Initializing Layout System Container...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}