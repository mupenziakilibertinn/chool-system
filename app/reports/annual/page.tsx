"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

function AnnualReportContent() {
  const searchParams = useSearchParams();
  const classParam = searchParams.get("class") || "P3";

  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allMarks, setAllMarks] = useState<Record<string, Record<string, any>>>({});
  const [coCurricularMarks, setCoCurricularMarks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const terms = ["term1", "term2", "term3"];

  useEffect(() => {
    if (classParam) {
      fetchAnnualReportData();
    }
  }, [classParam]);

  const fetchAnnualReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch student roster for the target stream class
      const sSnap = await getDocs(
        query(collection(db, "students"), where("class", "==", classParam.trim().toUpperCase()))
      );
      const sortedStudents = sSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));

      setStudents(sortedStudents);

      // 2. Map structural layout data matrices
      const subjectSet = new Set<string>();
      const tempMarks: Record<string, Record<string, any>> = {};
      const tempCoCurricular: Record<string, any> = {};

      await Promise.all(
        sortedStudents.map(async (student) => {
          const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
          
          mSnap.forEach((docSnap) => {
            const docId = docSnap.id;
            const data = docSnap.data();

            if (docId === "co_curricular") {
              tempCoCurricular[student.id] = data;
            } else {
              subjectSet.add(docId);
              if (!tempMarks[student.id]) {
                tempMarks[student.id] = {};
              }
              tempMarks[student.id][docId] = data;
            }
          });
        })
      );

      setSubjects(Array.from(subjectSet).sort());
      setAllMarks(tempMarks);
      setCoCurricularMarks(tempCoCurricular);
    } catch (err) {
      console.error("Failed to compile annual metrics data engine:", err);
    }
    setLoading(false);
  };

  const parseScore = (val: any): number => {
    if (val === undefined || val === null || val === "" || isNaN(Number(val))) return 0;
    return Number(val);
  };

  if (loading) {
    return (
      <div className="text-center font-black p-12 text-blue-900 text-xs uppercase tracking-widest animate-pulse">
        Compiling Global Annual Matrix Records...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center font-black p-12 text-gray-500 text-xs uppercase">
        No active student roster data sheets discovered for Stream Class {classParam}.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-6 print:bg-white print:p-0 font-sans text-gray-900">
      {/* Safe Print-Layout Head CSS Injected safely inside standard JSX rendering paths */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print { display: none !important; }
          .page-break-after { 
            page-break-after: always !important; 
            break-after: page !important;
          }
          body { 
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}} />

      {/* Control Banner */}
      <div className="no-print max-w-5xl mx-auto mb-6 bg-white border-2 border-black p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3 font-black shadow-sm">
        <div>
          <h1 className="text-xs uppercase text-blue-950">
            Annual Comprehensive Consolidated Ledger — Stream {classParam}
          </h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
            Verified Layout configured with auto page-breaks
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-900 text-white font-black uppercase text-[10px] tracking-wider px-5 py-2.5 rounded-lg border border-black shadow hover:bg-blue-950 transition-all flex items-center gap-2"
        >
          Print Records Portfolio 🖨️
        </button>
      </div>

      {/* Main Student Loop Layout Engine */}
      <div className="max-w-5xl mx-auto space-y-12 print:space-y-0">
        {students.map((student, studentIdx) => {
          const studentProfileMarks = allMarks[student.id] || {};
          const studentCoCurricular = coCurricularMarks[student.id] || {};

          let grandTotalPossible = 0;
          let grandTotalScored = 0;

          return (
            <div
              key={student.id}
              className="bg-white border-4 border-black p-6 rounded-2xl relative shadow-md print:shadow-none print:border-4 print:rounded-none print:p-4 print:my-0 page-break-after"
            >
              {/* Layout Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0 overflow-hidden">
                <h1 className="text-[6rem] font-black tracking-tighter text-center leading-none uppercase rotate-12">
                  NEW GENERATION SCHOOL
                </h1>
              </div>

              <div className="relative z-10 space-y-4">
                {/* School Administrative Header */}
                <div className="border-b-4 border-black pb-3 text-center space-y-1">
                  <h2 className="text-base font-black uppercase tracking-wide text-blue-950">
                    NEW GENERATION SCHOOL
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Progressive Academic Excellence Portfolio
                  </p>
                  <h3 className="text-xs font-black bg-black text-white px-3 py-1 inline-block uppercase tracking-wider rounded">
                    Annual Student Performance Report Card
                  </h3>
                </div>

                {/* Metadata Ledger Subgrid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-black uppercase border-b-2 border-black pb-3">
                  <div>
                    <span className="text-gray-400 block text-[8px]">Student Name:</span>
                    <span className="text-blue-950 text-xs">{student.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[8px]">Class Level Stream:</span>
                    <span>{classParam}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[8px]">Academic Year:</span>
                    <span>2026</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[8px]">Roll Number Assignment:</span>
                    <span>NGS-{studentIdx + 1}</span>
                  </div>
                </div>

                {/* Performance Double-Table Cross Matrix Layout */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full border-collapse border-4 border-black text-center text-[10px] font-black">
                    <thead>
                      <tr className="bg-gray-100 border-b-4 border-black text-[9px] tracking-wider uppercase text-gray-900">
                        <th className="border-r-2 border-black p-2 text-left w-[22%]">Subject Name</th>
                        {terms.map((t) => (
                          <th key={t} className="border-r-2 border-black p-1 w-[20%]" colSpan={2}>
                            {t.replace("term", "Term ")}
                          </th>
                        ))}
                        <th className="p-2 w-[18%]" colSpan={2}>Annual Summary</th>
                      </tr>
                      <tr className="bg-gray-50 border-b-2 border-black text-[8px] uppercase text-gray-600">
                        <th className="border-r-2 border-black p-1 text-left">Course Units</th>
                        <th className="border-r border-black p-1">Mid (/50)</th>
                        <th className="border-r-2 border-black p-1">Exam /50</th>
                        <th className="border-r border-black p-1">Mid (/50)</th>
                        <th className="border-r-2 border-black p-1">Exam /50</th>
                        <th className="border-r border-black p-1">Mid (/50)</th>
                        <th className="border-r-2 border-black p-1">Exam /50</th>
                        <th className="border-r border-black p-1">Total Score</th>
                        <th className="p-1">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Section A: Regular Subjects Rendering Block */}
                      {subjects.map((subKey) => {
                        const subjectData = studentProfileMarks[subKey] || {};
                        let courseTotalScored = 0;
                        let courseTotalPossible = 0;

                        const isFrench = subKey.toUpperCase().trim() === "FRENCH";
                        const isP6 = classParam.toUpperCase().trim() === "P6";
                        const maxTestMark = isFrench && !isP6 ? 25 : 50;

                        return (
                          <tr key={subKey} className="border-b-2 border-black hover:bg-gray-50/50">
                            <td className="border-r-2 border-black p-2 text-left uppercase font-black text-blue-950">
                              {subKey}
                            </td>
                            {terms.map((t) => {
                              // Compute Mid /50 out of the average of quiz fields saved by database
                              const t1 = subjectData[`${t}_t1`];
                              const m1 = subjectData[`${t}_m1`];
                              const t2 = subjectData[`${t}_t2`];
                              const m2 = subjectData[`${t}_m2`];
                              
                              const rawExam = subjectData[`${t}_exam`]; // Pulls target field key mapping safely

                              const validQuizzes = [t1, m1, t2, m2].filter(v => v !== undefined && v !== null && v !== "");
                              const quizzesSum = validQuizzes.reduce((acc, curr) => acc + parseScore(curr), 0);
                              
                              const midScore = validQuizzes.length > 0 ? (quizzesSum / validQuizzes.length) : 0;
                              const examScore = parseScore(rawExam);

                              // Only scale totals if database inputs are loaded
                              const hasData = validQuizzes.length > 0 || (rawExam !== undefined && rawExam !== null && rawExam !== "");
                              if (hasData) {
                                courseTotalScored += midScore + examScore;
                                courseTotalPossible += maxTestMark + maxTestMark;
                              }

                              return (
                                <Suspense key={t} fallback={<td>-</td>}>
                                  <td className="border-r border-black p-1 text-gray-900 font-bold">
                                    {validQuizzes.length > 0 ? midScore.toFixed(1) : "-"}
                                  </td>
                                  <td className="border-r-2 border-black p-1 text-gray-900 font-bold">
                                    {rawExam !== undefined && rawExam !== null && rawExam !== "" ? examScore : "-"}
                                  </td>
                                </Suspense>
                              );
                            })}

                            {(() => {
                              grandTotalScored += courseTotalScored;
                              grandTotalPossible += courseTotalPossible;

                              const coursePct =
                                courseTotalPossible > 0
                                  ? (courseTotalScored / courseTotalPossible) * 100
                                  : 0;

                              return (
                                <>
                                  <td className="border-r border-black p-2 bg-blue-50/40 text-blue-950 font-black">
                                    {courseTotalPossible > 0 ? `${courseTotalScored.toFixed(1)} / ${courseTotalPossible}` : "-"}
                                  </td>
                                  <td className={`p-2 font-black ${coursePct < 50 ? "text-red-600 bg-red-50/30" : "text-emerald-700 bg-emerald-50/20"}`}>
                                    {courseTotalPossible > 0 ? `${coursePct.toFixed(1)}%` : "-"}
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        );
                      })}

                      {/* Section B: Co-Curricular (Sport & Creative Art) Processing */}
                      {["Sport", "Creative Art"].map((activity) => {
                        const subDbKey = activity === "Sport" ? "sport" : "art";
                        let activityTotalScored = 0;
                        let activityTotalPossible = 0;

                        return (
                          <tr key={activity} className="border-b-2 border-black bg-yellow-50/20 hover:bg-yellow-50/40">
                            <td className="border-r-2 border-black p-2 text-left uppercase italic font-black text-amber-900">
                              {activity}
                            </td>
                            {terms.map((t) => {
                              const testRaw = studentCoCurricular[`${t}_${subDbKey}_test`];
                              const examRaw = studentCoCurricular[`${t}_${subDbKey}_exam`];

                              const testScore = parseScore(testRaw);
                              const examScore = parseScore(examRaw);

                              const hasData = (testRaw !== undefined && testRaw !== "") || (examRaw !== undefined && examRaw !== "");
                              if (hasData) {
                                activityTotalScored += testScore + examScore;
                                activityTotalPossible += 10; // Out of 5 for test + 5 for exam
                              }

                              return (
                                <Suspense key={t} fallback={<td>-</td>}>
                                  <td className="border-r border-black p-1 text-gray-800 font-bold">
                                    {testRaw !== undefined && testRaw !== "" ? testScore : "-"}
                                  </td>
                                  <td className="border-r-2 border-black p-1 text-gray-800 font-bold">
                                    {examRaw !== undefined && examRaw !== "" ? examScore : "-"}
                                  </td>
                                </Suspense>
                              );
                            })}

                            {(() => {
                              grandTotalScored += activityTotalScored;
                              grandTotalPossible += activityTotalPossible;

                              const activityPct =
                                activityTotalPossible > 0
                                  ? (activityTotalScored / activityTotalPossible) * 100
                                  : 0;

                              return (
                                <>
                                  <td className="border-r border-black p-2 bg-amber-50/40 text-amber-950 font-black">
                                    {activityTotalPossible > 0 ? `${activityTotalScored} / ${activityTotalPossible}` : "-"}
                                  </td>
                                  <td className={`p-2 font-black ${activityPct < 50 ? "text-red-600 bg-red-50/30" : "text-emerald-700 bg-emerald-50/20"}`}>
                                    {activityTotalPossible > 0 ? `${activityPct.toFixed(1)}%` : "-"}
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        );
                      })}

                      {/* Summary Metrics Row */}
                      <tr className="bg-blue-900 text-white font-black text-[11px] uppercase tracking-wide">
                        <td className="border-r-2 border-black p-2.5 text-left bg-blue-950">
                          Aggregated Performance
                        </td>
                        <td className="border-r-2 border-black p-2 text-center" colSpan={6}>
                          Consolidated Term Analytics Record Blocks
                        </td>
                        <td className="border-r border-black p-2.5 bg-blue-950 text-center">
                          {grandTotalScored.toFixed(1)} / {grandTotalPossible}
                        </td>
                        <td className="p-2.5 bg-yellow-600 text-white font-black text-center text-xs">
                          {grandTotalPossible > 0
                            ? `${((grandTotalScored / grandTotalPossible) * 100).toFixed(2)}%`
                            : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footnotes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-[9px] font-black uppercase text-gray-700 border-t-2 border-dashed border-gray-400">
                  <div className="space-y-1 bg-gray-50 p-2.5 border border-black rounded-lg">
                    <span className="text-gray-400 block text-[8px]">Class Teacher Observations:</span>
                    <p className="text-gray-900 leading-relaxed font-bold h-10 normal-case">
                      {grandTotalPossible > 0 && (grandTotalScored / grandTotalPossible) >= 0.5
                        ? "Demonstrates great dedication, high competency, and continuous academic adaptability throughout the year."
                        : "Requires focused remedial reinforcement exercises and sustained targeted learning intervention support blocks."}
                    </p>
                  </div>
                  <div className="space-y-1 bg-gray-50 p-2.5 border border-black rounded-lg">
                    <span className="text-gray-400 block text-[8px]">Administration Placement Action:</span>
                    <p className="text-gray-900 font-bold h-10 flex items-center">
                      {grandTotalPossible > 0 && ((grandTotalScored / grandTotalPossible) * 100) >= 50
                        ? "APPROVED FOR PROMOTION PROGRESSION PATHWAYS"
                        : "RETAINED FOR REMEDIAL COMPLIANCE TRACKING"}
                    </p>
                  </div>
                  <div className="flex flex-col justify-between items-center text-center p-1">
                    <div className="w-32 border-b border-black mt-6"></div>
                    <span className="text-blue-950 font-black text-[8px] tracking-widest uppercase block mt-1">
                      New Generation Administration
                    </span>
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

export default function AnnualReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center font-black p-10 text-blue-900 text-xs uppercase">
          Loading Data Engine Components...
        </div>
      }
    >
      <AnnualReportContent />
    </Suspense>
  );
}