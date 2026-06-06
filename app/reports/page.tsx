"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const subjectsList = ["Mathematics", "SET", "SRE", "Kinyarwanda", "French", "English"];
const coCurricularList = ["Sport", "Creative Art"];
type ReportMode = "mid1" | "mid2" | "summation" | "annual";

function ReportCardsEngine() {
  const searchParams = useSearchParams();

  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  const activeClass = urlClass ? urlClass.toUpperCase() : "P1";
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [reportMode, setReportMode] = useState<ReportMode>("annual");
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

        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        let marksMatrix: any = {};
        await Promise.all(classFiltered.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          marksMatrix[student.id] = {};
          mSnap.forEach((docSnap) => {
            marksMatrix[student.id][docSnap.id] = docSnap.data();
          });
        }));
        setAllMarks(marksMatrix);

        const studentsWithScores = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          let overallYearMax = 0;
          let overallYearEarned = 0;

          // Calculate standard totals across all paths to sort rankings correctly
          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            ["term1", "term2", "term3"].forEach((tKey) => {
              const mData = studentMarks[sub] || {};
              const t1 = mData[`${tKey}_t1`] ?? "-";
              const m1 = mData[`${tKey}_m1`] ?? "-";
              const t2 = mData[`${tKey}_t2`] ?? "-";
              const m2 = mData[`${tKey}_m2`] ?? "-";

              const v1 = t1 !== "-" ? Number(t1) : 0;
              const v2 = m1 !== "-" ? Number(m1) : 0;
              const v3 = t2 !== "-" ? Number(t2) : 0;
              const v4 = m2 !== "-" ? Number(m2) : 0;

              overallYearEarned += (v1 + v2 + v3 + v4);
              overallYearMax += (baseMax * 4);
            });
          });

          coCurricularList.forEach((sub) => {
            ["term1", "term2", "term3"].forEach((tKey) => {
              const mData = studentMarks[sub] || {};
              const t1 = mData[`${tKey}_t1`] ?? "-";
              const m1 = mData[`${tKey}_m1`] ?? "-";
              const v1 = t1 !== "-" ? Number(t1) : 0;
              const v2 = m1 !== "-" ? Number(m1) : 0;
              overallYearEarned += (v1 + v2);
              overallYearMax += 10;
            });
          });

          const percentage = overallYearMax > 0 ? (overallYearEarned / overallYearMax) * 100 : 0;
          return {
            ...student,
            totalAcquiredMarks: overallYearEarned,
            totalMaxPossible: overallYearMax,
            percentage
          };
        });

        studentsWithScores.sort((a, b) => b.percentage - a.percentage);
        let currentRank = 1;
        const rankedStudents = studentsWithScores.map((student, index, arr) => {
          if (index > 0 && student.percentage < arr[index - 1].percentage) {
            currentRank = index + 1;
          }
          return { ...student, position: currentRank };
        });

        rankedStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setStudents(rankedStudents);
      } catch (err) {
        console.error("Data matrix failure:", err);
      }
      setLoading(false);
    };

    fetchClassReports();
  }, [activeClass, selectedTerm, reportMode]);

  const handlePrintAll = () => {
    setIsPrintAllMode(true);
    setActiveStudentId(null);
    setTimeout(() => { window.print(); }, 500);
  };

  const handlePrintSingle = (studentId: string) => {
    setIsPrintAllMode(false);
    setActiveStudentId(studentId);
    setTimeout(() => { window.print(); }, 500);
  };

  if (loading) return <div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Generating Clean Report Matrices...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 4mm 5mm 4mm 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-card { border: 4px solid black !important; padding: 14px !important; margin: 0 auto !important; box-shadow: none !important; width: 100% !important; height: 198mm !important; max-height: 198mm !important; page-break-after: always !important; page-break-inside: avoid !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; box-sizing: border-box !important; }
          .print-header-layout { display: flex !important; align-items: center !important; }
          .print-logo { height: 60px !important; width: 60px !important; }
          .print-table { font-size: 11px !important; }
          .print-table th, .print-table td { padding: 4px 2px !important; font-size: 11px !important; border: 2px solid black !important; }
          .print-signatures { margin-top: auto !important; padding-top: 6px !important; }
        }
      `}} />

      <div className="bg-white border-b-2 p-4 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <div className="p-2 border-2 rounded-xl font-black bg-gray-100 text-blue-900 text-xs px-4 uppercase">
                Class Stream {activeClass}
              </div>
            </div>
            {reportMode !== "annual" && (
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs">
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            )}
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value as ReportMode)}
              className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900"
            >
              <option value="annual">Whole Year Annual Report (G_2.png Layout)</option>
              <option value="summation">Full Term Summation Report</option>
              <option value="mid1">Separate Mid-Term 1 Report</option>
              <option value="mid2">Separate Mid-Term 2 Report</option>
            </select>
          </div>
          <button onClick={handlePrintAll} className="bg-green-700 text-white font-black text-xs uppercase px-5 py-3 rounded-xl shadow">
            Print Entire Class Register (Single Click) 🖨️✨
          </button>
        </div>
      </div>

      <div className="max-w-[98%] mx-auto p-4 space-y-8 mt-4">
        {students.map((student) => {
          const studentMarks = allMarks[student.id] || {};
          const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
          if (!isVisible) return null;

          // Helper metric parser to clean rendering up
          const parseCell = (val: any) => (val === undefined || val === null || val === "-") ? "-" : Number(val);

          // Totals accumulators for columns footer mapping (Exactly matching G_2.png metrics)
          let t1MidGrand = 0, t1ExGrand = 0, t1TotGrand = 0;
          let t2MidGrand = 0, t2ExGrand = 0, t2TotGrand = 0;
          let t3MidGrand = 0, t3ExGrand = 0, t3TotGrand = 0;
          let annualMaxGrand = 0, annualEarnedGrand = 0;

          return (
            <div key={student.id} className="bg-white border-4 border-black p-4 rounded-xl print-card flex flex-col justify-between">
              <div className="print:hidden flex justify-end gap-2 mb-2">
                <button onClick={() => handlePrintSingle(student.id)} className="bg-blue-900 text-white font-black px-3 py-1 rounded-md text-[10px] uppercase">
                  Print Only This Card 🖨
                </button>
                {activeStudentId !== null && (
                  <button onClick={() => setActiveStudentId(null)} className="bg-gray-600 text-white font-black px-3 py-1 rounded-md text-[10px] uppercase">
                    Show All
                  </button>
                )}
              </div>

              <div className="border-b-2 border-black pb-2 mb-2 print-header">
                <div className="flex items-center justify-between w-full print-header-layout">
                  <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="NGS Logo" className="h-14 w-14 object-contain print-logo" />
                    <div>
                      <h2 className="font-black text-xl text-blue-900 m-0">NEW GENERATION SCHOOL</h2>
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">OFFICIAL WHOLE YEAR ANNUAL PERFORMANCE SUMMARY</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-black space-y-0.5">
                    <div>STUDENT: <span className="text-blue-950 text-xs">{student.name}</span></div>
                    <div>CLASS LEVEL: <span className="text-blue-950 text-xs">{student.class} Stream</span></div>
                  </div>
                </div>
              </div>

              {/* G_2.png Dual Table Stack Layout Implementation */}
              <table className="w-full text-center border-collapse border-2 border-black text-[11px] font-black print-table">
                <thead>
                  <tr className="border-2 border-black bg-gray-50">
                    <th colSpan={4} className="text-left p-1 uppercase border-2 border-black text-blue-950 font-black">MATIÈRES / SUBJECTS</th>
                    <th colSpan={3} className="border-2 border-black font-black">1st TERM</th>
                    <th colSpan={3} className="border-2 border-black font-black">2nd TERM</th>
                    <th colSpan={3} className="border-2 border-black font-black">3rd TERM</th>
                    <th colSpan={3} className="border-2 border-black font-black text-blue-900">ANNUAL TOTAL</th>
                  </tr>
                  <tr className="border-2 border-black bg-gray-100 text-[10px]">
                    <th className="text-left p-1 border-2 border-black w-[18%]">MATIÈRES</th>
                    <th className="border-2 border-black w-[5%]">Max INT</th>
                    <th className="border-2 border-black w-[5%]">Max EX</th>
                    <th className="border-2 border-black w-[5%]">Max Tot</th>
                    <th className="border-2 border-black w-[5%]">MID</th>
                    <th className="border-2 border-black w-[5%]">EXAM</th>
                    <th className="border-2 border-black w-[5%]">Total</th>
                    <th className="border-2 border-black w-[5%]">MID</th>
                    <th className="border-2 border-black w-[5%]">EXAM</th>
                    <th className="border-2 border-black w-[5%]">Total</th>
                    <th className="border-2 border-black w-[5%]">MID</th>
                    <th className="border-2 border-black w-[5%]">EXAM</th>
                    <th className="border-2 border-black w-[5%]">Total</th>
                    <th className="border-2 border-black w-[6%] text-blue-950">Total Max</th>
                    <th className="border-2 border-black w-[6%] text-blue-900">total</th>
                    <th className="border-2 border-black w-[6%] text-green-800">%</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Part 1: Core Subjects Loop */}
                  {subjectsList.map((sub) => {
                    if (activeClass === "P6" && sub === "French") return null;
                    const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
                    const maxInt = isFrenchP1P5 ? 25 : 50;
                    const maxEx = isFrenchP1P5 ? 25 : 50;
                    const maxTot = maxInt + maxEx;

                    const mData = studentMarks[sub] || {};
                    
                    // Term parsing metrics maps
                    const t1_m = parseCell(mData.term1_t1) !== "-" || parseCell(mData.term1_m1) !== "-" ? Number(mData.term1_t1 || 0) + Number(mData.term1_m1 || 0) : "-";
                    const t1_e = parseCell(mData.term1_t2) !== "-" || parseCell(mData.term1_m2) !== "-" ? Number(mData.term1_t2 || 0) + Number(mData.term1_m2 || 0) : "-";
                    const t1_tot = t1_m !== "-" || t1_e !== "-" ? (t1_m !== "-" ? t1_m : 0) + (t1_e !== "-" ? t1_e : 0) : "-";

                    const t2_m = parseCell(mData.term2_t1) !== "-" || parseCell(mData.term2_m1) !== "-" ? Number(mData.term2_t1 || 0) + Number(mData.term2_m1 || 0) : "-";
                    const t2_e = parseCell(mData.term2_t2) !== "-" || parseCell(mData.term2_m2) !== "-" ? Number(mData.term2_t2 || 0) + Number(mData.term2_m2 || 0) : "-";
                    const t2_tot = t2_m !== "-" || t2_e !== "-" ? (t2_m !== "-" ? t2_m : 0) + (t2_e !== "-" ? t2_e : 0) : "-";

                    const t3_m = parseCell(mData.term3_t1) !== "-" || parseCell(mData.term3_m1) !== "-" ? Number(mData.term3_t1 || 0) + Number(mData.term3_m1 || 0) : "-";
                    const t3_e = parseCell(mData.term3_t2) !== "-" || parseCell(mData.term3_m2) !== "-" ? Number(mData.term3_t2 || 0) + Number(mData.term3_m2 || 0) : "-";
                    const t3_tot = t3_m !== "-" || t3_e !== "-" ? (t3_m !== "-" ? t3_m : 0) + (t3_e !== "-" ? t3_e : 0) : "-";

                    const rowEarned = (t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0);
                    const rowMax = maxTot * 3;
                    const rowPct = rowMax > 0 ? ((rowEarned / rowMax) * 100).toFixed(1) + "%" : "-";

                    // Accumulate Subject Row stats into column calculations totals safely
                    annualMaxGrand += maxTot;
                    if (t1_m !== "-") t1MidGrand += t1_m; if (t1_e !== "-") t1ExGrand += t1_e; if (t1_tot !== "-") t1TotGrand += t1_tot;
                    if (t2_m !== "-") t2MidGrand += t2_m; if (t2_e !== "-") t2ExGrand += t2_e; if (t2_tot !== "-") t2TotGrand += t2_tot;
                    if (t3_m !== "-") t3MidGrand += t3_m; if (t3_e !== "-") t3ExGrand += t3_e; if (t3_tot !== "-") t3TotGrand += t3_tot;
                    annualEarnedGrand += rowEarned;

                    return (
                      <tr key={sub} className="border-2 border-black font-black text-gray-900">
                        <td className="text-left p-1 border-2 border-black uppercase font-black text-blue-950">{sub}</td>
                        <td className="border-2 border-black">{maxInt}</td>
                        <td className="border-2 border-black">{maxEx}</td>
                        <td className="border-2 border-black bg-gray-50/50">{maxTot}</td>
                        <td className="border-2 border-black text-gray-600">{t1_m}</td>
                        <td className="border-2 border-black text-gray-600">{t1_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t1_tot}</td>
                        <td className="border-2 border-black text-gray-600">{t2_m}</td>
                        <td className="border-2 border-black text-gray-600">{t2_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t2_tot}</td>
                        <td className="border-2 border-black text-gray-600">{t3_m}</td>
                        <td className="border-2 border-black text-gray-600">{t3_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t3_tot}</td>
                        <td className="border-2 border-black bg-gray-50">{rowMax}</td>
                        <td className="border-2 border-black text-blue-900 font-black">{rowEarned}</td>
                        <td className="border-2 border-black text-green-800 font-black">{rowPct}</td>
                      </tr>
                    );
                  })}

                  {/* Part 2: Co-Curricula Header Separator Line */}
                  <tr className="bg-gray-50 text-center tracking-wider border-2 border-black">
                    <td colSpan={16} className="p-1 uppercase border-2 border-black text-blue-950 font-black text-[10px]">CO-CURRICULA ACTIVITIES</td>
                  </tr>

                  {/* Part 3: Co-Curricula Rows Loop */}
                  {coCurricularList.map((sub) => {
                    const mData = studentMarks[sub] || {};
                    const cMaxInt = 5;
                    const cMaxEx = 5;
                    const cMaxTot = 10;

                    const t1_m = parseCell(mData.term1_t1);
                    const t1_e = parseCell(mData.term1_m1);
                    const t1_tot = t1_m !== "-" || t1_e !== "-" ? (t1_m !== "-" ? t1_m : 0) + (t1_e !== "-" ? t1_e : 0) : "-";

                    const t2_m = parseCell(mData.term2_t1);
                    const t2_e = parseCell(mData.term2_m1);
                    const t2_tot = t2_m !== "-" || t2_e !== "-" ? (t2_m !== "-" ? t2_m : 0) + (t2_e !== "-" ? t2_e : 0) : "-";

                    const t3_m = parseCell(mData.term3_t1);
                    const t3_e = parseCell(mData.term3_m1);
                    const t3_tot = t3_m !== "-" || t3_e !== "-" ? (t3_m !== "-" ? t3_m : 0) + (t3_e !== "-" ? t3_e : 0) : "-";

                    const rowEarned = (t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0);
                    const rowMax = cMaxTot * 3;
                    const rowPct = rowMax > 0 ? ((rowEarned / rowMax) * 100).toFixed(1) + "%" : "-";

                    annualMaxGrand += cMaxTot;
                    if (t1_m !== "-") t1MidGrand += t1_m; if (t1_e !== "-") t1ExGrand += t1_e; if (t1_tot !== "-") t1TotGrand += t1_tot;
                    if (t2_m !== "-") t2MidGrand += t2_m; if (t2_e !== "-") t2ExGrand += t2_e; if (t2_tot !== "-") t2TotGrand += t2_tot;
                    if (t3_m !== "-") t3MidGrand += t3_m; if (t3_e !== "-") t3ExGrand += t3_e; if (t3_tot !== "-") t3TotGrand += t3_tot;
                    annualEarnedGrand += rowEarned;

                    return (
                      <tr key={sub} className="border-2 border-black font-black text-gray-900">
                        <td className="text-left p-1 border-2 border-black uppercase font-black text-blue-950">{sub}</td>
                        <td className="border-2 border-black">{cMaxInt}</td>
                        <td className="border-2 border-black">{cMaxEx}</td>
                        <td className="border-2 border-black bg-gray-50/50">{cMaxTot}</td>
                        <td className="border-2 border-black text-gray-500">{t1_m}</td>
                        <td className="border-2 border-black text-gray-500">{t1_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t1_tot}</td>
                        <td className="border-2 border-black text-gray-500">{t2_m}</td>
                        <td className="border-2 border-black text-gray-500">{t2_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t2_tot}</td>
                        <td className="border-2 border-black text-gray-500">{t3_m}</td>
                        <td className="border-2 border-black text-gray-500">{t3_e}</td>
                        <td className="border-2 border-black bg-gray-50 font-black">{t3_tot}</td>
                        <td className="border-2 border-black bg-gray-50">{rowMax}</td>
                        <td className="border-2 border-black text-blue-900 font-black">{rowEarned}</td>
                        <td className="border-2 border-black text-green-800 font-black">{rowPct}</td>
                      </tr>
                    );
                  })}

                  {/* Part 4: General Multi-Column Summary Rows (Directly matching G_2.png) */}
                  <tr className="bg-blue-50/50 border-4 border-black text-blue-950 text-[11px] font-black">
                    <td className="text-left p-1 border-2 border-black uppercase tracking-wider font-black">TOTAL GENERAL</td>
                    <td className="border-2 border-black">{annualMaxGrand}</td>
                    <td className="border-2 border-black">{annualMaxGrand}</td>
                    <td className="border-2 border-black bg-gray-100">{annualMaxGrand * 2}</td>
                    <td className="border-2 border-black text-gray-700">{t1MidGrand}</td>
                    <td className="border-2 border-black text-gray-700">{t1ExGrand}</td>
                    <td className="border-2 border-black font-serif text-blue-900 text-xs">{t1TotGrand} <span className="text-[10px] text-gray-400 font-normal">/ {annualMaxGrand * 2}</span></td>
                    <td className="border-2 border-black text-gray-700">{t2MidGrand}</td>
                    <td className="border-2 border-black text-gray-700">{t2ExGrand}</td>
                    <td className="border-2 border-black font-serif text-blue-900 text-xs">{t2TotGrand} <span className="text-[10px] text-gray-400 font-normal">/ {annualMaxGrand * 2}</span></td>
                    <td className="border-2 border-black text-gray-700">{t3MidGrand}</td>
                    <td className="border-2 border-black text-gray-700">{t3ExGrand}</td>
                    <td className="border-2 border-black font-serif text-blue-900 text-xs">{t3TotGrand} <span className="text-[10px] text-gray-400 font-normal">/ {annualMaxGrand * 2}</span></td>
                    <td className="border-2 border-black bg-gray-100">{annualMaxGrand * 6}</td>
                    <td className="border-2 border-black text-blue-950 font-black text-xs">{annualEarnedGrand}</td>
                    <td className="border-2 border-black text-green-800 text-xs">{student.percentage.toFixed(1)}%</td>
                  </tr>

                  <tr className="border-2 border-black text-[11px] font-black">
                    <td className="text-left p-1 border-2 border-black uppercase font-black">POURCENTAGE</td>
                    <td colSpan={3} className="border-2 border-black bg-gray-50">-</td>
                    <td colSpan={3} className="border-2 border-black text-blue-950 font-serif text-xs">{((t1TotGrand / (annualMaxGrand * 2)) * 100).toFixed(1)}%</td>
                    <td colSpan={3} className="border-2 border-black text-blue-950 font-serif text-xs">{t2TotGrand !== 0 ? ((t2TotGrand / (annualMaxGrand * 2)) * 100).toFixed(1) + "%" : "0.0%"}</td>
                    <td colSpan={3} className="border-2 border-black text-blue-950 font-serif text-xs">{((t3TotGrand / (annualMaxGrand * 2)) * 100).toFixed(1)}%</td>
                    <td colSpan={3} className="border-2 border-black text-green-800 bg-blue-50/50 text-xs">{student.percentage.toFixed(1)}%</td>
                  </tr>

                  <tr className="border-2 border-black text-[11px] font-black">
                    <td className="text-left p-1 border-2 border-black uppercase font-black">PLACE / RANK</td>
                    <td colSpan={3} className="border-2 border-black bg-gray-50">-</td>
                    <td colSpan={3} className="border-2 border-black text-emerald-800 font-black">SUR {students.length}</td>
                    <td colSpan={3} className="border-2 border-black text-emerald-800 font-black">SUR {students.length}</td>
                    <td colSpan={3} className="border-2 border-black text-emerald-800 font-black">SUR {students.length}</td>
                    <td colSpan={3} className="border-2 border-black text-green-800 bg-green-50 text-xs font-serif uppercase">{student.position} SUR {students.length}</td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Signatures Layout - Striped Clean Lines with No Text Decoration Underlines */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t-2 border-dashed border-gray-300 font-black items-end print-signatures mt-auto">
                <div className="space-y-0.5">
                  <span className="text-gray-400 uppercase tracking-widest block text-[8px]">Class Teacher:</span>
                  <div className="h-6 flex items-end text-xs uppercase text-blue-900 tracking-wider font-black border-none decoration-transparent select-none">
                    {classTeacherName || "_______________________"}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-0.5">
                  <span className="text-gray-400 uppercase tracking-widest block text-[8px] text-right">Official School Authority:</span>
                  <div className="border-2 border-dashed border-gray-400 rounded-lg w-28 h-10 flex items-center justify-center bg-gray-50/50 text-[8px] uppercase tracking-wider text-gray-400 font-black">
                    Stamp Container
                  </div>
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
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Loading Engine Pipelines...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}