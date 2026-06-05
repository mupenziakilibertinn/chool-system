"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// Visual order strictly matching your official school report tables
const subjectsList = ["Mathematics", "SET", "SRE", "Kinyarwanda", "English", "French"];

type ReportMode = "mid1" | "mid2" | "summation";

function ReportCardsEngine() {
  const searchParams = useSearchParams();
  
  const urlClass = searchParams.get("class");
  const urlStudentId = searchParams.get("studentId");
  const activeClass = urlClass ? urlClass.toUpperCase() : "P6";
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [reportMode, setReportMode] = useState<ReportMode>("summation");
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
        // 1. Fetch Class Teacher Name
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

        // 2. Fetch Students
        const sSnap = await getDocs(collection(db, "students"));
        const classFiltered = sSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter((s) => s.class?.toUpperCase() === activeClass);

        // 3. Fetch All Marks
        let marksMatrix: any = {};
        await Promise.all(classFiltered.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          marksMatrix[student.id] = {};
          mSnap.forEach((docSnap) => {
            marksMatrix[student.id][docSnap.id] = docSnap.data();
          });
        }));
        setAllMarks(marksMatrix);

        // 4. Calculate Totals based on Mode
        const studentsWithScores = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          let totalMaxPossible = 0;
          let totalAcquiredMarks = 0;

          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            
            const baseMax = isFrenchP1P5 ? 25 : 50; 
            const examMax = isFrenchP1P5 ? 50 : 100;

            const mData = studentMarks[sub] || {};
            const t1 = mData[`${selectedTerm}_t1`] ?? "-";
            const m1 = mData[`${selectedTerm}_m1`] ?? "-";
            const t2 = mData[`${selectedTerm}_t2`] ?? "-";
            const m2 = mData[`${selectedTerm}_m2`] ?? "-";
            const exam = mData[`${selectedTerm}_exam`] ?? "-";

            const v1 = t1 !== "-" ? Number(t1) : 0;
            const v2 = m1 !== "-" ? Number(m1) : 0;
            const v3 = t2 !== "-" ? Number(t2) : 0;
            const v4 = m2 !== "-" ? Number(m2) : 0;
            const vExam = exam !== "-" ? Number(exam) : 0;

            if (reportMode === "mid1") {
              totalAcquiredMarks += (v1 + v2);
              totalMaxPossible += (baseMax * 2);
            } else if (reportMode === "mid2") {
              totalAcquiredMarks += (v3 + v4);
              totalMaxPossible += (baseMax * 2);
            } else {
              // Summation calculation matching the layout image columns: Mid 1 + Mid 2 + Exam
              totalAcquiredMarks += (v2 + v4 + vExam);
              totalMaxPossible += (baseMax + baseMax + examMax);
            }
          });

          const percentage = totalMaxPossible > 0 ? (totalAcquiredMarks / totalMaxPossible) * 100 : 0;
          return {
            ...student,
            totalAcquiredMarks,
            totalMaxPossible,
            percentage
          };
        });

        // 5. Establish Positions/Ranks
        studentsWithScores.sort((a, b) => b.totalAcquiredMarks - a.totalAcquiredMarks);
        let currentRank = 1;
        const rankedStudents = studentsWithScores.map((student, index, arr) => {
          if (index > 0 && student.totalAcquiredMarks < arr[index - 1].totalAcquiredMarks) {
            currentRank = index + 1;
          }
          return { ...student, position: currentRank };
        });

        rankedStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setStudents(rankedStudents);
      } catch (err) {
        console.error("Data loading failure:", err);
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

  const getAutomaticComment = (percentage: number, max: number) => {
    if (max === 0) return "No marks recorded for this academic period.";
    if (percentage >= 85) return "An exceptional performance this term! Highly disciplined, consistent, and exemplary work across all course pathways. Keep up this brilliant standard.";
    if (percentage >= 70) return "A very strong and commendable performance. Shows steady focus and capability. Keep pushing for higher grades.";
    if (percentage >= 50) return "Fair performance this term. The learner has passed successfully, but needs to increase concentration and review core academic sections to secure better marks.";
    return "Performance did not reach the baseline passing threshold this term. Closer study habits, remedial assistance, and a focused attitude are required.";
  };

  const formatPosition = (pos: number) => {
    const j = pos % 10, k = pos % 100;
    if (j === 1 && k !== 11) return pos + "st";
    if (j === 2 && k !== 12) return pos + "nd";
    if (j === 3 && k !== 13) return pos + "rd";
    return pos + "th";
  };

  const getReportTitle = () => {
    if (reportMode === "mid1") return "MID-TERM 1 LEARNER TRANSCRIPT";
    if (reportMode === "mid2") return "MID-TERM 2 LEARNER TRANSCRIPT";
    return "FINAL REPORT CARD";
  };

  if (loading) return <div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Generating Clean Report Matrices...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card {
            border: 5px solid black !important;
            padding: 24px 24px 20px 24px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            width: 100% !important;
            max-height: 284mm !important;
            height: 284mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
          .print-header-layout { display: flex !important; align-items: center !important; justify-content: flex-start !important; width: 100% !important; }
          .print-text-area { text-align: left !important; margin-left: 24px !important; flex-grow: 1 !important; }
          .print-header h2 { font-size: 28px !important; margin: 0 !important; }
          .print-header p { font-size: 12px !important; margin-top: 6px !important; }
          .print-meta { padding: 10px 14px !important; margin-top: 12px !important; font-size: 12px !important; }
          .print-meta span { font-size: 14px !important; }
          .print-table { margin-top: 10px !important; font-size: 12px !important; flex-grow: 0.1 !important; }
          .print-table th { padding: 6px 4px !important; font-size: 10px !important; }
          .print-table td { padding: 7px 4px !important; font-size: 12px !important; }
          .print-table .tr-total td { padding: 10px 4px !important; font-size: 12px !important; }
          .print-comment-area { margin-top: 12px !important; flex-grow: 1 !important; display: flex !important; flex-direction: column !important; justify-content: flex-start !important; }
          .print-comment-area span { font-size: 11px !important; }
          .print-comment-box { padding: 10px 14px !important; flex-grow: 1 !important; min-height: 75px !important; font-size: 11px !important; margin-top: 4px !important; }
          .print-signatures { margin-top: auto !important; padding-top: 12px !important; }
          .print-signatures span { font-size: 10px !important; }
          .print-stamp { height: 70px !important; width: 140px !important; font-size: 10px !important; }
          .print-teacher-line { font-size: 12px !important; width: 240px !important; height: 32px !important; border: none !important; text-decoration: none !important; }
          .print-logo { height: 90px !important; width: 90px !important; display: block !important; }
        }
      `}} />

      <div className="bg-white border-b-2 p-4 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Class Focus</label>
              <div className="p-2 border-2 rounded-xl font-black bg-gray-100 text-blue-900 text-xs px-4 uppercase">
                Class Stream {activeClass}
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Target Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="p-2 border-2 rounded-xl font-black bg-white text-xs">
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-blue-900 mb-0.5">Report Layout Type</label>
              <select
                value={reportMode}
                onChange={(e) => setReportMode(e.target.value as ReportMode)}
                className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900"
              >
                <option value="mid1">Separate Mid-Term 1 Report</option>
                <option value="mid2">Separate Mid-Term 2 Report</option>
                <option value="summation">Full Term Summation Report</option>
              </select>
            </div>
          </div>
          <button
            onClick={handlePrintAll}
            className="bg-green-700 hover:bg-green-800 text-white font-black text-xs uppercase px-5 py-3 rounded-xl shadow transition-all flex items-center gap-2"
          >
            Print Entire Class Register (Single Click) 🖨️✨
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-12 mt-6">
        {students.length === 0 ? (
          <div className="text-center font-black p-10 text-gray-400 uppercase">No students discovered registered inside Class Stream {activeClass}</div>
        ) : (
          students.map((student) => {
            const studentMarks = allMarks[student.id] || {};
            const isVisible = isPrintAllMode || activeStudentId === student.id || activeStudentId === null;
            if (!isVisible) return null;

            return (
              <div
                key={student.id}
                className={`bg-white border-4 border-black p-8 shadow-md rounded-xl relative overflow-hidden print-card flex flex-col justify-between ${
                  activeStudentId === student.id ? "ring-4 ring-blue-900" : ""
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
                  <h1 className="text-8xl font-black tracking-widest text-center rotate-[320deg]">NEW GENERATION SCHOOL</h1>
                </div>

                <div className="print:hidden flex justify-end gap-2 mb-4 bg-gray-50 p-2 rounded-lg border">
                  <button
                    onClick={() => handlePrintSingle(student.id)}
                    className="bg-blue-900 text-white font-black px-3 py-1.5 rounded-md uppercase text-[10px]"
                  >
                    Print Only This Card 🖨
                  </button>
                  {activeStudentId !== null && (
                    <button
                      onClick={() => setActiveStudentId(null)}
                      className="bg-gray-600 text-white font-black px-3 py-1.5 rounded-md uppercase text-[10px]"
                    >
                      Show All Cards ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-col justify-start space-y-3 flex-grow">
                  {/* Card Header Banner */}
                  <div className="border-b-4 border-black pb-3 print-header">
                    <div className="flex items-center justify-start gap-6 w-full print-header-layout">
                      <img
                        src="/logo.png"
                        alt="School Logo"
                        className="h-20 w-20 object-contain flex-shrink-0 print-logo"
                      />
                      <div className="text-left flex-grow print-text-area">
                        <h2 className="font-black text-2xl tracking-wide text-blue-900 uppercase leading-none m-0">NEW GENERATION SCHOOL</h2>
                        <p className="text-[11px] font-black uppercase tracking-widest text-blue-900 mt-1.5">{getReportTitle()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-left mt-3 text-[10px] font-black bg-gray-50 p-2.5 rounded-xl border-2 border-gray-200 print-meta w-full">
                      <div className="uppercase">STUDENT: <span className="text-blue-950 text-xs font-black block mt-0.5">{student.name}</span></div>
                      <div className="uppercase">CLASS LEVEL: <span className="text-blue-950 text-xs font-black block mt-0.5">{student.class} Stream</span></div>
                      <div className="uppercase">ACADEMIC PERIOD: <span className="text-blue-950 text-xs font-black font-serif uppercase block mt-0.5">{selectedTerm.toUpperCase()}</span></div>
                    </div>
                  </div>

                  {/* Main Transcript Data Table */}
                  <table className="w-full text-center border-collapse border-4 border-black text-xs font-black print-table">
                    <thead className="bg-gray-100 border-b-4 border-black uppercase text-[9px] tracking-wider">
                      <tr>
                        <th className="p-2 border-r-4 border-black text-left w-[40%]">COURSE PATHWAY</th>
                        {reportMode === "mid1" && (
                          <>
                            <th className="p-2 border-r-4 border-black">TEST 1</th>
                            <th className="p-2 border-r-4 border-black">MID 1</th>
                          </>
                        )}
                        {reportMode === "mid2" && (
                          <>
                            <th className="p-2 border-r-4 border-black">TEST 2</th>
                            <th className="p-2 border-r-4 border-black">MID 2</th>
                          </>
                        )}
                        {reportMode === "summation" && (
                          <>
                            <th className="p-2 border-r-2 border-black">MID 1</th>
                            <th className="p-2 border-r-2 border-black">MID 2</th>
                            <th className="p-2 border-r-4 border-black">EXAM</th>
                          </>
                        )}
                        <th className="p-2">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectsList.map((sub) => {
                        if (activeClass === "P6" && sub === "French") return null;
                        const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
                        
                        const baseMax = isFrenchP1P5 ? 25 : 50;
                        const examMax = isFrenchP1P5 ? 50 : 100;

                        const mData = studentMarks[sub] || {};
                        const t1 = mData[`${selectedTerm}_t1`] ?? "-";
                        const m1 = mData[`${selectedTerm}_m1`] ?? "-";
                        const t2 = mData[`${selectedTerm}_t2`] ?? "-";
                        const m2 = mData[`${selectedTerm}_m2`] ?? "-";
                        const exam = mData[`${selectedTerm}_exam`] ?? "-";

                        const v1 = t1 !== "-" ? Number(t1) : 0;
                        const v2 = m1 !== "-" ? Number(m1) : 0;
                        const v3 = t2 !== "-" ? Number(t2) : 0;
                        const v4 = m2 !== "-" ? Number(m2) : 0;
                        const vExam = exam !== "-" ? Number(exam) : 0;

                        let rowTotal = 0;
                        let rowMax = 0;

                        if (reportMode === "mid1") {
                          rowTotal = v1 + v2;
                          rowMax = baseMax * 2;
                        } else if (reportMode === "mid2") {
                          rowTotal = v3 + v4;
                          rowMax = baseMax * 2;
                        } else {
                          rowTotal = v2 + v4 + vExam;
                          rowMax = baseMax + baseMax + examMax;
                        }

                        const hasMarks = t1 !== "-" || m1 !== "-" || t2 !== "-" || m2 !== "-" || exam !== "-";

                        return (
                          <tr key={sub} className="border-b-2 border-black text-gray-900 text-xs font-black">
                            <td className="p-2 py-2 border-r-4 border-black text-left font-black uppercase text-blue-950">{sub}</td>
                            
                            {reportMode === "mid1" && (
                              <>
                                <td className="p-2 border-r-2 border-black text-gray-950">{t1}</td>
                                <td className="p-2 border-r-4 border-black text-gray-950">{m1}</td>
                              </>
                            )}
                            
                            {reportMode === "mid2" && (
                              <>
                                <td className="p-2 border-r-2 border-black text-gray-950">{t2}</td>
                                <td className="p-2 border-r-4 border-black text-gray-950">{m2}</td>
                              </>
                            )}
                            
                            {reportMode === "summation" && (
                              <>
                                <td className="p-2 border-r-2 border-black text-gray-950">{m1 !== "-" ? `${m1}/${baseMax}` : "-"}</td>
                                <td className="p-2 border-r-2 border-black text-gray-950">{m2 !== "-" ? `${m2}/${baseMax}` : "-"}</td>
                                <td className="p-2 border-r-4 border-black text-gray-950">{exam !== "-" ? `${exam}/${examMax}` : "-"}</td>
                              </>
                            )}
                            
                            <td className="p-2 font-black text-blue-900">
                              {hasMarks ? `${rowTotal} / ${rowMax}` : "-"}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Combined Summation Standing Footer */}
                      <tr className="bg-blue-50/80 font-black text-blue-950 border-t-4 border-black text-xs tr-total">
                        <td colSpan={reportMode === "summation" ? 2 : 1} className="p-2.5 border-r-4 border-black text-center uppercase tracking-wider text-[10px]">
                          TOTAL SCORE: <span className="text-blue-900 text-xs block mt-0.5 font-serif">{student.totalAcquiredMarks} / {student.totalMaxPossible}</span>
                        </td>
                        <td colSpan={reportMode === "summation" ? 1 : 1} className="p-2.5 border-r-4 border-black text-center uppercase tracking-wider text-[10px]">
                          PERCENTAGE: <span className="text-blue-900 text-xs block mt-0.5 font-serif">{student.percentage.toFixed(1)}%</span>
                        </td>
                        <td colSpan={2} className="p-2.5 text-center uppercase tracking-wider text-[10px]">
                          POSITION: <span className="text-green-800 text-xs block mt-0.5 font-serif">{formatPosition(student.position)} OUT OF {students.length}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Comments Box */}
                  <div className="space-y-1 text-left print-comment-area flex-grow">
                    <span className="text-blue-950 font-black uppercase text-[10px] tracking-wider">Class Teacher's Comments & General Observations:</span>
                    <div className="border-4 border-black rounded-xl p-3 bg-gray-50 font-black text-gray-900 text-xs italic tracking-wide leading-relaxed flex items-center print-comment-box min-h-[75px]">
                      "{getAutomaticComment(student.percentage, student.totalMaxPossible)}"
                    </div>
                  </div>
                </div>

                {/* Signatures & Stamps Footer Layout — Stripped of Underlines */}
                <div className="grid grid-cols-2 gap-8 pt-2 border-t-4 border-dashed border-gray-400 font-black items-end print-signatures mt-auto">
                  <div className="space-y-0.5">
                    <span className="text-gray-400 uppercase tracking-widest block text-[9px]">Class Teacher:</span>
                    <div className="h-8 flex items-end pb-0.5 text-xs uppercase text-blue-900 tracking-wider font-black border-0 print-teacher-line style-none" style={{ textDecoration: 'none', borderBottom: 'none' }}>
                      {classTeacherName || "_______________________"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-0.5">
                    <span className="text-gray-400 uppercase tracking-widest block text-[9px] text-right w-40">Official School Authority:</span>
                    <div className="border-4 border-dashed border-gray-400 rounded-xl w-32 h-14 flex items-center justify-center bg-gray-50/50 text-[8px] uppercase tracking-wider text-gray-400 font-black print-stamp">
                      School Stamp Only
                    </div>
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
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 text-xs tracking-widest">Loading Report Hub Layout Matrix...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}