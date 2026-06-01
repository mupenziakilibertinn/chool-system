"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
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
        const tSnap = await getDocs(collection(db, "teachers"));
        let detectedTeacher = "";
        
        tSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docClassTeacherOf = data.classTeacherOf ? data.classTeacherOf.toUpperCase() : "";
          
          if (docClassTeacherOf === activeClass) {
            detectedTeacher = data.name || "";
          } 
          else if (data.classes && Array.isArray(data.classes)) {
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
          let totalMaxPossible = 0;
          let totalAcquiredMarks = 0;

          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            const mData = studentMarks[sub] || {};
            const t1 = mData[`${selectedTerm}_t1`] ?? "-";
            const m1 = mData[`${selectedTerm}_m1`] ?? "-";
            const t2 = mData[`${selectedTerm}_t2`] ?? "-";
            const m2 = mData[`${selectedTerm}_m2`] ?? "-";

            if (t1 === "-" && m1 === "-" && t2 === "-" && m2 === "-") {
              return; 
            }

            const v1 = t1 !== "-" ? Number(t1) : 0;
            const v2 = m1 !== "-" ? Number(m1) : 0;
            const v3 = t2 !== "-" ? Number(t2) : 0;
            const v4 = m2 !== "-" ? Number(m2) : 0;

            if (reportMode === "mid1") {
              totalAcquiredMarks += (v1 + v2);
              totalMaxPossible += (baseMax * 2);
            } else if (reportMode === "mid2") {
              totalAcquiredMarks += (v3 + v4);
              totalMaxPossible += (baseMax * 2);
            } else {
              totalAcquiredMarks += (v1 + v2 + v3 + v4);
              totalMaxPossible += (baseMax * 2);
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

  const getAutomaticComment = (percentage: number, max: number, studentMarks: any) => {
    if (max === 0) return "No marks recorded for this academic period.";

    let weakSubjects: string[] = [];

    subjectsList.forEach((sub) => {
      if (activeClass === "P6" && sub === "French") return;
      const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
      const baseMax = isFrenchP1P5 ? 25 : 50;

      const mData = studentMarks[sub] || {};
      const t1 = mData[`${selectedTerm}_t1`] ?? "-";
      const m1 = mData[`${selectedTerm}_m1`] ?? "-";
      const t2 = mData[`${selectedTerm}_t2`] ?? "-";
      const m2 = mData[`${selectedTerm}_m2`] ?? "-";

      const v1 = t1 !== "-" ? Number(t1) : 0;
      const v2 = m1 !== "-" ? Number(m1) : 0;
      const v3 = t2 !== "-" ? Number(t2) : 0;
      const v4 = m2 !== "-" ? Number(m2) : 0;
      
      let subTotal = 0;
      let subMax = 0;

      if (reportMode === "mid1") {
        subTotal = v1 + v2;
        subMax = baseMax * 2;
      } else if (reportMode === "mid2") {
        subTotal = v3 + v4;
        subMax = baseMax * 2;
      } else {
        subTotal = v1 + v2 + v3 + v4;
        subMax = baseMax * 2;
      }

      const subPercentage = subMax > 0 ? (subTotal / subMax) * 100 : 100;
      
      if (subPercentage < 65 && (t1 !== "-" || m1 !== "-" || t2 !== "-" || m2 !== "-")) {
        weakSubjects.push(sub.toUpperCase());
      }
    });

    if (percentage >= 85) {
      if (weakSubjects.length > 0) {
        return `An outstanding performance overall! However, more active revision is recommended in ${weakSubjects.join(", ")} to clear minor gaps and keep up this elite standard.`;
      }
      return "An exceptional academic performance this term! Highly disciplined, consistent, and exemplary work across all course pathways. Keep up this brilliant standard.";
    }
    
    if (percentage >= 70) {
      if (weakSubjects.length > 0) {
        return `Very good progress made this term. The learner is capable, but needs closer focus and dynamic improvement in ${weakSubjects.join(", ")} where averages fell below 65%.`;
      }
      return "A very strong and commendable performance. Shows steady focus and capability in all subjects. Keep pushing for even higher grades next term.";
    }
    
    if (percentage >= 50) {
      if (weakSubjects.length > 0) {
        return `Passed successfully, but overall consistency is fair. Focused remedial practice is highly necessary in ${weakSubjects.join(", ")} to push scores above the 65% target baseline.`;
      }
      return "Fair performance this term. The learner has passed, but needs to increase general effort and concentration across all pathways to secure better marks.";
    }
    
    if (weakSubjects.length > 0) {
      return `Performance falls short of expectations. Urgent academic intervention and dedicated study revision are required, especially in ${weakSubjects.join(", ")} to cross the passing thresholds.`;
    }
    return "Performance did not reach the passing threshold this term. Closer supervision, regular study habits, and a complete change of attitude toward schoolwork are required.";
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
    return "OFFICIAL END-OF-TERM PERFORMANCE SUMMATION";
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
          .print-table { margin-top: 14px !important; font-size: 13px !important; flex-grow: 0.2 !important; }
          .print-table th { padding: 10px 6px !important; font-size: 11px !important; }
          .print-table td { padding: 12px 6px !important; font-size: 13px !important; }
          .print-table .tr-total td { padding: 14px 6px !important; font-size: 13px !important; }
          .print-comment-area { margin-top: 16px !important; flex-grow: 1 !important; display: flex !important; flex-direction: column !important; justify-content: flex-start !important; }
          .print-comment-area span { font-size: 12px !important; }
          .print-comment-box { padding: 14px 16px !important; flex-grow: 1 !important; min-height: 90px !important; font-size: 12px !important; margin-top: 6px !important; }
          .print-signatures { margin-top: auto !important; padding-top: 16px !important; }
          .print-signatures span { font-size: 11px !important; }
          .print-stamp { height: 75px !important; width: 145px !important; font-size: 11px !important; }
          .print-teacher-line { font-size: 13px !important; width: 240px !important; height: 36px !important; }
          .print-logo { height: 100px !important; width: 100px !important; display: block !important; }
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
                    Print Only This Card 🖨️
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

                <div className="flex flex-col justify-start space-y-4 flex-grow">
                  <div className="border-b-4 border-black pb-4 print-header">
                    <div className="flex items-center justify-start gap-6 w-full print-header-layout">
                      <img 
                        src="/logo.png" 
                        alt="School Logo" 
                        className="h-24 w-24 object-contain flex-shrink-0 print-logo"
                      />
                      <div className="text-left flex-grow print-text-area">
                        <h2 className="font-black text-3xl tracking-wide text-blue-900 uppercase leading-none m-0">NEW GENERATION SCHOOL</h2>
                        <p className="text-xs font-black uppercase tracking-widest text-blue-900 mt-2">{getReportTitle()}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-left mt-4 text-[11px] font-black bg-gray-50 p-3 rounded-xl border-2 border-gray-200 print-meta w-full">
                      <div className="uppercase">STUDENT: <span className="text-blue-950 text-sm font-black block mt-0.5">{student.name}</span></div>
                      <div className="uppercase">CLASS LEVEL: <span className="text-blue-950 text-sm font-black block mt-0.5">{student.class} Stream</span></div>
                      <div className="uppercase">ACADEMIC PERIOD: <span className="text-blue-950 text-sm font-black font-serif uppercase block mt-0.5">{selectedTerm}</span></div>
                    </div>
                  </div>

                  <table className="w-full text-center border-collapse border-4 border-black text-sm font-black print-table">
                    <thead className="bg-gray-100 border-b-4 border-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5 border-r-4 border-black text-left w-[45%]">COURSE PATHWAY</th>
                        {reportMode === "mid1" && (
                          <>
                            <th className="p-2.5 border-r-4 border-black">TEST 1 (/50)</th>
                            <th className="p-2.5 border-r-4 border-black">MID 1 (/50)</th>
                          </>
                        )}
                        {reportMode === "mid2" && (
                          <>
                            <th className="p-2.5 border-r-4 border-black">TEST 2 (/50)</th>
                            <th className="p-2.5 border-r-4 border-black">MID 2 (/50)</th>
                          </>
                        )}
                        {reportMode === "summation" && (
                          <>
                            <th className="p-2.5 border-r-2 border-black text-[10px]">T1 (/50)</th>
                            <th className="p-2.5 border-r-2 border-black text-[10px]">M1 (/50)</th>
                            <th className="p-2.5 border-r-2 border-black text-[10px]">T2 (/50)</th>
                            <th className="p-2.5 border-r-4 border-black text-[10px]">M2 (/50)</th>
                          </>
                        )}
                        <th className="p-2.5">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectsList.map((sub) => {
                        if (activeClass === "P6" && sub === "French") return null;
                        const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
                        const baseMax = isFrenchP1P5 ? 25 : 50;

                        const mData = studentMarks[sub] || {};
                        const t1 = mData[`${selectedTerm}_t1`] ?? "-";
                        const m1 = mData[`${selectedTerm}_m1`] ?? "-";
                        const t2 = mData[`${selectedTerm}_t2`] ?? "-";
                        const m2 = mData[`${selectedTerm}_m2`] ?? "-";

                        const v1 = t1 !== "-" ? Number(t1) : 0;
                        const v2 = m1 !== "-" ? Number(m1) : 0;
                        const v3 = t2 !== "-" ? Number(t2) : 0;
                        const v4 = m2 !== "-" ? Number(m2) : 0;
                        
                        let subTotal = 0;
                        let subMax = 0;

                        if (reportMode === "mid1") {
                          subTotal = v1 + v2;
                          subMax = baseMax * 2;
                        } else if (reportMode === "mid2") {
                          subTotal = v3 + v4;
                          subMax = baseMax * 2;
                        } else {
                          subTotal = v1 + v2 + v3 + v4;
                          subMax = baseMax * 2;
                        }

                        const hasMarks = t1 !== "-" || m1 !== "-" || t2 !== "-" || m2 !== "-";

                        return (
                          <tr key={sub} className="border-b-2 border-black text-gray-900 text-[13px] font-black">
                            <td className="p-2.5 py-3 border-r-4 border-black text-left font-black uppercase text-blue-950">{sub}</td>
                            {reportMode === "mid1" && (
                              <>
                                <td className="p-2.5 border-r-2 border-black text-gray-950">{t1}</td>
                                <td className="p-2.5 border-r-4 border-black text-gray-950">{m1}</td>
                              </>
                            )}
                            {reportMode === "mid2" && (
                              <>
                                <td className="p-2.5 border-r-2 border-black text-gray-950">{t2}</td>
                                <td className="p-2.5 border-r-4 border-black text-gray-950">{m2}</td>
                              </>
                            )}
                            {reportMode === "summation" && (
                              <>
                                <td className="p-2.5 border-r-2 border-black text-gray-950">{t1}</td>
                                <td className="p-2.5 border-r-2 border-black text-gray-950">{m1}</td>
                                <td className="p-2.5 border-r-2 border-black text-gray-950">{t2}</td>
                                <td className="p-2.5 border-r-4 border-black text-gray-950">{m2}</td>
                              </>
                            )}
                            <td className="p-2.5 font-black text-blue-900">
                              {hasMarks ? `${subTotal} / ${subMax}` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      
                      <tr className="bg-blue-50/80 font-black text-blue-950 border-t-4 border-black text-xs tr-total">
                        <td colSpan={reportMode === "summation" ? 2 : 1} className="p-3 border-r-4 border-black text-center uppercase tracking-wider text-[11px]">
                          TOTAL SCORE: <span className="text-blue-900 text-sm block mt-0.5 font-serif">{student.totalAcquiredMarks} / {student.totalMaxPossible}</span>
                        </td>
                        <td colSpan={reportMode === "summation" ? 2 : 1} className="p-3 border-r-4 border-black text-center uppercase tracking-wider text-[11px]">
                          PERCENTAGE: <span className="text-blue-900 text-sm block mt-0.5 font-serif">{student.percentage.toFixed(1)}%</span>
                        </td>
                        <td colSpan={2} className="p-3 text-center uppercase tracking-wider text-[11px]">
                          POSITION: <span className="text-green-800 text-sm block mt-0.5 font-serif">{formatPosition(student.position)} OUT OF {students.length}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="space-y-1 text-left print-comment-area flex-grow">
                    <span className="text-blue-950 font-black uppercase text-[11px] tracking-wider">Class Teacher's Comments & General Observations:</span>
                    <div className="border-4 border-black rounded-xl p-4 bg-gray-50 font-black text-gray-900 text-[12px] italic tracking-wide leading-relaxed flex items-center print-comment-box min-h-[90px]">
                      "{getAutomaticComment(student.percentage, student.totalMaxPossible, studentMarks)}"
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4 border-t-4 border-dashed border-gray-400 font-black items-end print-signatures mt-auto">
                  <div className="space-y-0.5">
                    <span className="text-gray-400 uppercase tracking-widest block text-[9px]">Class Teacher:</span>
                    <div className="border-b-4 border-black h-9 flex items-end pb-0.5 text-sm uppercase text-blue-900 tracking-wider font-black print-teacher-line">
                      {classTeacherName || "_______________________"}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-0.5">
                    <span className="text-gray-400 uppercase tracking-widest block text-[9px] text-right w-40">Official School Authority:</span>
                    <div className="border-4 border-dashed border-gray-400 rounded-xl w-36 h-16 flex items-center justify-center bg-gray-50/50 text-[9px] uppercase tracking-wider text-gray-400 font-black print-stamp">
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
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 uppercase text-xs tracking-widest">Loading Report Gateway Secure Elements...</div>}>
      <ReportCardsEngine />
    </Suspense>
  );
}
