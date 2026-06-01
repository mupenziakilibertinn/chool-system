"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const subjectsList = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];
const availableClasses = ["P1", "P2", "P3", "P4", "P5", "P6"];

interface SubjectBuckets {
  eightyPlus: number;
  seventyPlus: number;
  sixtyPlus: number;
  fiftyPlus: number;
  belowFifty: number;
  totalStudentsWithMarks: number;
  runningTotalPercentage: number;
  teacherName: string;
}

function AnalysisDashboardEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const urlClass = searchParams.get("class");
  const activeClass = urlClass ? urlClass.toUpperCase().trim() : "P6";

  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [reportMode, setReportMode] = useState<"mid1" | "mid2" | "summation">("mid1");
  const [loading, setLoading] = useState(true);

  const [classMasterTeacher, setClassMasterTeacher] = useState("LOADING STAFF...");
  const [analysisMatrix, setAnalysisMatrix] = useState<Record<string, SubjectBuckets>>({});
  const [globalClassAverage, setGlobalClassAverage] = useState(0);

  const handleClassSwitch = (className: string) => {
    router.push(`/admin/analytics?class=${className.toLowerCase()}`);
  };

  useEffect(() => {
    const generateAnalysisData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Teachers and apply flexible space-insensitive matching rules
        const teacherSnap = await getDocs(collection(db, "teachers"));
        let calculatedClassMaster = "NOT ASSIGNED";
        let subjectTeacherMap: Record<string, string> = {};

        teacherSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docName = (data.name || "").toUpperCase().trim();
          const docClassTeacherOf = (data.classTeacherOf || "").toUpperCase().trim();
          
          // Match Class Master
          if (docClassTeacherOf === activeClass || docClassTeacherOf === `PRIMARY ${activeClass}`) {
            calculatedClassMaster = docName;
          }

          // Smart matching for specialized subject teachers
          if (data.classes && Array.isArray(data.classes)) {
            // Clean up array items (e.g., ["p4", "P5 "] -> ["P4", "P5"])
            const cleanTeacherClasses = data.classes.map((c: string) => 
              String(c).toUpperCase().replace(/\s+/g, "")
            );

            // Check if active class target exists inside the teacher's profile string
            const teachesThisClass = cleanTeacherClasses.some(c => 
              c === activeClass || c.includes(activeClass)
            );
            
            if (teachesThisClass && data.subjects && Array.isArray(data.subjects)) {
              data.subjects.forEach((sub: string) => {
                const standardizedSubject = String(sub).toUpperCase().trim();
                subjectTeacherMap[standardizedSubject] = docName;
              });
            }
          }
        });
        setClassMasterTeacher(calculatedClassMaster);

        // 2. Fetch Class Registry
        const studentSnap = await getDocs(collection(db, "students"));
        const activeCohort = studentSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
          .filter(s => {
            const studentClass = (s.class || "").toUpperCase().trim();
            return studentClass === activeClass || studentClass === `PRIMARY ${activeClass}`;
          });

        // Initialize clean empty matrix buckets with localized teacher names
        let workingMatrix: Record<string, SubjectBuckets> = {};
        subjectsList.forEach((sub) => {
          const key = sub.toUpperCase();
          workingMatrix[key] = {
            eightyPlus: 0,
            seventyPlus: 0,
            sixtyPlus: 0,
            fiftyPlus: 0,
            belowFifty: 0,
            totalStudentsWithMarks: 0,
            runningTotalPercentage: 0,
            teacherName: subjectTeacherMap[key] || "NO TEACHER ASSIGNED"
          };
        });

        // 3. Process marks maps dynamically per student
        await Promise.all(activeCohort.map(async (student) => {
          const marksSnap = await getDocs(collection(db, "students", student.id, "marks"));
          
          marksSnap.forEach((docSnap) => {
            const subjectKey = docSnap.id.toUpperCase().trim();
            if (!workingMatrix[subjectKey]) return; 

            const mData = docSnap.data();
            const isFrenchP1P5 = subjectKey === "FRENCH" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            const t1 = mData[`${selectedTerm}_t1`] ?? "-";
            const m1 = mData[`${selectedTerm}_m1`] ?? "-";
            const t2 = mData[`${selectedTerm}_t2`] ?? "-";
            const m2 = mData[`${selectedTerm}_m2`] ?? "-";

            const hasMid1Marks = t1 !== "-" || m1 !== "-";
            const hasMid2Marks = t2 !== "-" || m2 !== "-";

            const v1 = t1 !== "-" ? Number(t1) : 0;
            const v2 = m1 !== "-" ? Number(m1) : 0;
            const v3 = t2 !== "-" ? Number(t2) : 0;
            const v4 = m2 !== "-" ? Number(m2) : 0;

            let acquiredScore = 0;
            let currentPeriodMax = 0;

            if (reportMode === "mid1" && hasMid1Marks) {
              acquiredScore = v1 + v2;
              currentPeriodMax = baseMax * 2;
            } else if (reportMode === "mid2" && hasMid2Marks) {
              acquiredScore = v3 + v4;
              currentPeriodMax = baseMax * 2;
            } else if (reportMode === "summation" && (hasMid1Marks || hasMid2Marks)) {
              acquiredScore = v1 + v2 + v3 + v4;
              currentPeriodMax = (hasMid1Marks ? baseMax * 2 : 0) + (hasMid2Marks ? baseMax * 2 : 0);
            }

            if (currentPeriodMax > 0) {
              const studentPercentage = (acquiredScore / currentPeriodMax) * 100;
              
              workingMatrix[subjectKey].totalStudentsWithMarks += 1;
              workingMatrix[subjectKey].runningTotalPercentage += studentPercentage;

              if (studentPercentage >= 80) workingMatrix[subjectKey].eightyPlus += 1;
              else if (studentPercentage >= 70) workingMatrix[subjectKey].seventyPlus += 1;
              else if (studentPercentage >= 60) workingMatrix[subjectKey].sixtyPlus += 1;
              else if (studentPercentage >= 50) workingMatrix[subjectKey].fiftyPlus += 1;
              else workingMatrix[subjectKey].belowFifty += 1;
            }
          });
        }));

        if (activeClass === "P6") {
          delete workingMatrix["FRENCH"];
        }

        let globalSum = 0;
        let globalCount = 0;
        Object.keys(workingMatrix).forEach((key) => {
          const item = workingMatrix[key];
          if (item.totalStudentsWithMarks > 0) {
            globalSum += (item.runningTotalPercentage / item.totalStudentsWithMarks);
            globalCount += 1;
          }
        });

        setGlobalClassAverage(globalCount > 0 ? globalSum / globalCount : 0);
        setAnalysisMatrix(workingMatrix);

      } catch (err) {
        console.error("Critical Analysis Mapping failure:", err);
      }
      setLoading(false);
    };

    generateAnalysisData();
  }, [activeClass, selectedTerm, reportMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center font-black text-blue-900 tracking-widest text-xs uppercase animate-pulse">
          Recalculating Subject Cohort Matrices...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Administrative Class Selector Row */}
        <div className="bg-white p-3 rounded-xl shadow-sm border flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase text-blue-900 tracking-wider">
            Select Class Stream to Inspect:
          </label>
          <div className="grid grid-cols-6 gap-2">
            {availableClasses.map((cls) => {
              const isSelected = activeClass === cls;
              return (
                <button
                  key={cls}
                  onClick={() => handleClassSwitch(cls)}
                  className={`py-3 px-4 rounded-xl font-black text-center text-xs uppercase transition-all border-2 ${
                    isSelected
                      ? "bg-blue-900 border-blue-900 text-white shadow-md scale-[1.02]"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                  }`}
                >
                  Primary {cls}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Top Controls Grid */}
        <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-0.5">Target Term</label>
              <select 
                value={selectedTerm} 
                onChange={(e) => setSelectedTerm(e.target.value)} 
                className="p-2 border-2 rounded-xl font-black bg-gray-50 text-xs text-gray-700 focus:outline-none focus:border-blue-900"
              >
                <option value="term1">Term 1</option>
                <option value="term2">Term 2</option>
                <option value="term3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-blue-900 mb-0.5">Analysis Target Mode</label>
              <select 
                value={reportMode} 
                onChange={(e) => setReportMode(e.target.value as any)} 
                className="p-2 border-2 border-blue-900 rounded-xl font-black bg-white text-xs text-blue-900 focus:outline-none"
              >
                <option value="mid1">Mid-Term 1 Only</option>
                <option value="mid2">Mid-Term 2 Only</option>
                <option value="summation">Full Term Summation Breakdown</option>
              </select>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-black text-gray-400 block uppercase">Cohort Focus Stream</span>
            <span className="text-xl font-black text-blue-950 uppercase">Primary {activeClass} Matrix</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white rounded-xl border p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-950 uppercase">CLASS PERFORMANCE MATRIX</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">CLASS MASTER TEACHER:</span>
              <span className="text-xs font-black text-blue-900 uppercase">{classMasterTeacher}</span>
            </div>
          </div>
          
          <div className="bg-blue-50 border-2 border-blue-200 px-6 py-3 rounded-2xl text-center self-stretch md:self-auto flex flex-col justify-center">
            <span className="text-[9px] font-black tracking-widest text-blue-900 uppercase">CLASS STREAM AVG</span>
            <span className="text-3xl font-black text-blue-600 leading-none mt-1">{globalClassAverage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b text-[10px] font-black text-gray-400 tracking-wider uppercase">
                  <th className="py-4 px-6 w-[25%]">SUBJECT / LESSON</th>
                  <th className="py-4 px-4 w-[25%]">TEACHER-IN-CHARGE</th>
                  <th className="py-4 px-4 text-center w-[40%]">GRADE COHORT BREAKDOWN</th>
                  <th className="py-4 px-6 text-right w-[10%]">SUBJECT AVG</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs font-bold text-gray-700">
                {Object.keys(analysisMatrix).map((subjectName) => {
                  const data = analysisMatrix[subjectName];
                  const avg = data.totalStudentsWithMarks > 0 ? (data.runningTotalPercentage / data.totalStudentsWithMarks) : 0;

                  return (
                    <tr key={subjectName} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-5 px-6 font-black text-blue-950 text-sm tracking-wide uppercase">
                        {subjectName}
                      </td>

                      <td className="py-5 px-4 font-black text-blue-600 tracking-wide uppercase">
                        {data.teacherName}
                      </td>

                      <td className="py-5 px-4">
                        <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-black">
                          <div className="space-y-1">
                            <div className="text-gray-900 uppercase">80+ ({data.eightyPlus})</div>
                            <div className={`h-2.5 rounded-full w-full ${data.eightyPlus > 0 ? "bg-emerald-500" : "bg-gray-200"}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-900 uppercase">70-79 ({data.seventyPlus})</div>
                            <div className={`h-2.5 rounded-full w-full ${data.seventyPlus > 0 ? "bg-blue-500" : "bg-gray-200"}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-900 uppercase">60-69 ({data.sixtyPlus})</div>
                            <div className={`h-2.5 rounded-full w-full ${data.sixtyPlus > 0 ? "bg-indigo-400" : "bg-gray-200"}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-900 uppercase">50-59 ({data.fiftyPlus})</div>
                            <div className={`h-2.5 rounded-full w-full ${data.fiftyPlus > 0 ? "bg-amber-500" : "bg-gray-200"}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-900 uppercase">0-49 ({data.belowFifty})</div>
                            <div className={`h-2.5 rounded-full w-full ${data.belowFifty > 0 ? "bg-rose-500" : "bg-gray-200"}`} />
                          </div>
                        </div>
                      </td>

                      <td className="py-5 px-6 font-black text-right text-sm text-gray-900 tracking-tight">
                        {data.totalStudentsWithMarks > 0 ? `${avg.toFixed(1)}%` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AnalysisDashboardPage() {
  return (
    <Suspense fallback={<div className="text-center font-black p-10 text-blue-900 uppercase text-xs tracking-widest">Initialising Operational Analysis Vectors...</div>}>
      <AnalysisDashboardEngine />
    </Suspense>
  );
}