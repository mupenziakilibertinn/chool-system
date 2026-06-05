"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function MarksEntryPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [teacherData, setTeacherData] = useState<any>(null);
  const [selectedAlloc, setSelectedAlloc] = useState<any>(null);
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("teacherEmail");
      if (savedEmail) {
        setUserEmail(savedEmail.trim().toLowerCase());
        verifyTeacherPermission(savedEmail.trim().toLowerCase());
      } else {
        setAuthLoading(false);
      }
    }
  }, []);

  const verifyTeacherPermission = async (email: string) => {
    setAuthLoading(true);
    try {
      const tSnap = await getDocs(collection(db, "teachers"));
      const match = tSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find((t: any) => t.email?.trim().toLowerCase() === email.trim().toLowerCase());
      if (match) {
        setTeacherData(match);
        if ((match as any).allocations && (match as any).allocations.length > 0) {
          setSelectedAlloc((match as any).allocations[0]);
        }
      } else {
        alert(" 🚫  ACCESS REJECTED: This email address is not permitted in your dashboard lists.");
        localStorage.removeItem("teacherEmail");
      }
    } catch (err) {
      console.error(err);
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    if (selectedAlloc) {
      setValidationError(null);
      fetchStudentRoster();
    }
  }, [selectedAlloc, selectedTerm]);

  const fetchStudentRoster = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(query(collection(db, "students"), where("class", "==", selectedAlloc.class)));
      const sortedStudents = sSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as { name?: string; class?: string }) }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(sortedStudents);

      let loadedMarks: any = {};
      await Promise.all(sortedStudents.map(async (student) => {
        const mSnap = await getDocs(collection(db, "students", student.id, "marks"));
        mSnap.forEach((docSnap) => {
          if (docSnap.id === selectedAlloc.subject) {
            loadedMarks[student.id] = docSnap.data();
          }
        });
      }));
      setMarks(loadedMarks);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Dynamic parameters helper configuration functions
  const isFrench = selectedAlloc?.subject?.toUpperCase().trim() === "FRENCH";
  const isP6 = selectedAlloc?.class?.toUpperCase().trim() === "P6";
  const isFrenchP1P5 = isFrench && !isP6;

  const getCellConfiguration = (assessmentKey: string) => {
    if (assessmentKey === "exam") {
      const maxVal = isFrenchP1P5 ? 25 : 50;
      return {
        maxMarkValue: maxVal,
        maxMarkLabel: `/${maxVal}`,
        passMarkValue: maxVal / 2
      };
    }
    // Fallback configurations for TEST 1, MID 1, TEST 2, MID 2 rows
    const maxVal = isFrenchP1P5 ? 25 : 50;
    return {
      maxMarkValue: maxVal,
      maxMarkLabel: `/${maxVal}`,
      passMarkValue: maxVal / 2
    };
  };

  const handleMarkChange = (studentId: string, assessmentKey: string, value: string) => {
    setValidationError(null);
    const { maxMarkValue } = getCellConfiguration(assessmentKey);

    if (value !== "") {
      const numValue = Number(value);
      if (numValue > maxMarkValue || numValue < 0) {
        setValidationError(` ❌  ERROR: Maximum score limit for this section is ${maxMarkValue}. Please check values.`);
        return;
      }
    }
    setMarks((prev: any) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [`${selectedTerm}_${assessmentKey}`]: value
      }
    }));
  };

  const handleExcelPaste = (e: React.ClipboardEvent<HTMLInputElement>, studentIndex: number, assessmentKey: string) => {
    e.preventDefault();
    setValidationError(null);
    const { maxMarkValue } = getCellConfiguration(assessmentKey);

    const pastedData = e.clipboardData.getData("text");
    const rows = pastedData.split(/\r?\n/).map(row => row.trim()).filter(row => row !== "");
    if (rows.length > 0) {
      const hasBadValues = rows.some(val => val !== "" && (Number(val) > maxMarkValue || Number(val) < 0));

      if (hasBadValues) {
        setValidationError(` 🚫  PASTE BLOCKED: One or more values in your Excel column exceed the maximum limit of ${maxMarkValue} marks!`);
        return;
      }
      const updatedMarks = { ...marks };
      rows.forEach((value, offset) => {
        const targetStudent = students[studentIndex + offset];
        if (targetStudent) {
          if (!updatedMarks[targetStudent.id]) updatedMarks[targetStudent.id] = {};
          updatedMarks[targetStudent.id][`${selectedTerm}_${assessmentKey}`] = value;
        }
      });
      setMarks(updatedMarks);
    }
  };

  const handleColumnAction = async (assessmentKey: string, actionType: "copy" | "cut" | "clear") => {
    setValidationError(null);

    const targetScores = students.map(student => {
      const score = marks[student.id]?.[`${selectedTerm}_${assessmentKey}`];
      return score !== undefined && score !== null ? String(score) : "";
    });
    const columnTextTextareaFormat = targetScores.join("\n");
    if (actionType === "copy" || actionType === "cut") {
      try {
        await navigator.clipboard.writeText(columnTextTextareaFormat);
        alert(` 📋  Column marks successfully ${actionType === "cut" ? "cut" : "copied"} to your system clipboard! Ready for Excel.`);
      } catch (err) {
        alert("Clipboard hardware access failed.");
      }
    }
    if (actionType === "cut" || actionType === "clear") {
      const updatedMarks = { ...marks };
      students.forEach(student => {
        if (!updatedMarks[student.id]) updatedMarks[student.id] = {};
        updatedMarks[student.id][`${selectedTerm}_${assessmentKey}`] = "";
      });
      setMarks(updatedMarks);
    }
  };

  const getAssessmentMetrics = (assessmentKey: string) => {
    const { maxMarkValue, passMarkValue } = getCellConfiguration(assessmentKey);
    let totals = 0;
    let counted = 0;
    let passes = 0;
    let high = -1;
    let low = maxMarkValue + 1;

    students.forEach(s => {
      const markStr = marks[s.id]?.[`${selectedTerm}_${assessmentKey}`];
      if (markStr !== undefined && markStr !== null && markStr !== "") {
        const val = Number(markStr);
        totals += val;
        counted++;
        if (val >= passMarkValue) passes++;
        if (val > high) high = val;
        if (val < low) low = val;
      }
    });
    return {
      avg: counted > 0 ? (totals / counted).toFixed(1) : "-",
      passRate: counted > 0 ? ((passes / counted) * 100).toFixed(0) : "-",
      highest: high !== -1 ? high : "-",
      lowest: low !== maxMarkValue + 1 ? low : "-",
      totalCounted: counted
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, assessmentKey: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = document.querySelector(
        `input[data-student-idx="${studentIndex + 1}"][data-assessment="${assessmentKey}"]`
      ) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleSaveMarks = async () => {
    if (validationError) {
      alert(" ⚠️  Cannot save marks sheet while configuration errors are present on screen.");
      return;
    }
    setLoading(true);
    try {
      await Promise.all(students.map(async (student) => {
        const studentMarkData = marks[student.id] || {};
        const docRef = doc(db, "students", student.id, "marks", selectedAlloc.subject);
        await setDoc(docRef, studentMarkData, { merge: true });
      }));
      alert(" ✅  MARKS PORTAL BACKEND SAVED SUCCESSFULLY!");
    } catch (err) {
      alert("Failed to secure marks matrix changes.");
    }
    setLoading(false);
  };

  if (authLoading) return <div className="text-center font-black p-10 text-blue-900 text-xs uppercase">Verifying Instructor Record...</div>;

  if (!teacherData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 text-xs font-black text-gray-700">
        <div className="bg-white p-6 rounded-2xl border-2 max-w-sm w-full space-y-4 shadow-sm">
          <div className="text-center uppercase text-blue-900 font-black tracking-wider border-b pb-2">NGS Teacher System Login</div>
          <div>
            <label className="block mb-1 text-[9px] text-gray-400 uppercase">Registered Work Email</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="mukarukundo@gmail.com"
              className="w-full border-2 p-3 rounded-xl font-bold lowercase"
            />
          </div>
          <button
            onClick={() => {
              if (userEmail) {
                localStorage.setItem("teacherEmail", userEmail.trim().toLowerCase());
                verifyTeacherPermission(userEmail.trim().toLowerCase());
              }
            }}
            className="w-full bg-blue-900 text-white py-3 rounded-xl uppercase tracking-wider text-[10px]"
          >
            Access My Marks Sheet
          </button>
        </div>
      </div>
    );
  }

  const assessmentsList = ["t1", "m1", "t2", "m2", "exam"];
  const assessmentLabels: Record<string, string> = { 
    t1: "TEST 1", 
    m1: "MID 1", 
    t2: "TEST 2", 
    m2: "MID 2", 
    exam: "FINAL EXAM" 
  };

  return (
    <div className="min-h-screen bg-gray-50 text-xs font-sans pb-32 text-gray-800">
      <div className="bg-blue-950 text-white p-4 font-black shadow">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            <span className="text-[9px] text-blue-300 uppercase block tracking-wider">ACTIVE INSTRUCTOR</span>
            <h1 className="text-sm uppercase tracking-wide">{teacherData.name}</h1>
          </div>
          <div className="flex gap-2">
            {teacherData.classTeacherOf && (
              <button
                onClick={() => router.push(`/reports?class=${teacherData.classTeacherOf}`)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg uppercase text-[9px] tracking-wider transition-all"
              >
                Observe My Class Reports  📋  (Stream {teacherData.classTeacherOf})
              </button>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("teacherEmail");
                window.location.reload();
              }}
              className="bg-red-900 text-white px-3 py-1.5 rounded-lg uppercase text-[9px]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-4 mt-4 space-y-6">
        <div className="bg-white border-2 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 font-black">
          <div>
            <label className="block text-[9px] text-gray-400 uppercase mb-1">Target Matrix Stream</label>
            <select
              value={selectedAlloc ? JSON.stringify(selectedAlloc) : ""}
              onChange={(e) => setSelectedAlloc(JSON.parse(e.target.value))}
              className="w-full p-2.5 bg-white border-2 rounded-xl font-black uppercase text-xs"
            >
              {teacherData.allocations?.map((a: any, index: number) => (
                <option key={index} value={JSON.stringify(a)}>Class Stream {a.class} — {a.subject}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] text-gray-400 uppercase mb-1">Assessment Target Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full p-2.5 bg-white border-2 rounded-xl font-black uppercase text-xs"
            >
              <option value="term1">Academic Term 1</option>
              <option value="term2">Academic Term 2</option>
              <option value="term3">Academic Term 3</option>
            </select>
          </div>
        </div>
        {selectedAlloc && (
          <div className="bg-white border-2 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2 gap-4 flex-wrap">
              <div>
                <h2 className="font-black text-blue-950 uppercase text-xs">MARKS GRADING DASHBOARD</h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Stream {selectedAlloc.class} Level • {selectedAlloc.subject}</p>
                <p className="text-[9px] text-green-600 font-bold uppercase"> 💡  Click top input, paste whole column from Excel, use Enter key to navigate!</p>
              </div>
              <button
                onClick={handleSaveMarks}
                disabled={loading || !!validationError}
                className={`font-black text-[10px] uppercase px-5 py-2.5 rounded-xl transition-all shadow text-white ${
                  validationError ? "bg-gray-400 cursor-not-allowed" : "bg-green-700 hover:bg-green-800"
                }`}
              >
                {loading ? "SAVING..." : "COMMIT & LOCK TERM MARKS  💾 "}
              </button>
            </div>
            {validationError && (
              <div className="bg-rose-50 border-2 border-rose-300 p-3.5 rounded-xl font-black text-rose-700 text-xs uppercase tracking-wide">
                {validationError}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse border-2 border-black font-black text-xs min-w-[700px]">
                <thead className="bg-gray-100 border-b-2 border-black uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3 text-left w-[25%] border-r border-black align-middle">STUDENT REGISTER ENTRY</th>
                    {assessmentsList.map((key) => {
                      const { maxMarkLabel: currentLabel } = getCellConfiguration(key);
                      return (
                        <th key={key} className="p-2 border-r border-black w-[15%]">
                          <div className="text-gray-900 text-[10px]">{assessmentLabels[key]} ({currentLabel})</div>
                          <div className="flex items-center justify-center gap-1 mt-1.5 font-bold text-[8px] tracking-tight">
                            <button
                              type="button"
                              onClick={() => handleColumnAction(key, "copy")}
                              className="bg-blue-50 border text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors"
                              title="Copy entire column array"
                            >
                              COPY
                            </button>
                            <button
                              type="button"
                              onClick={() => handleColumnAction(key, "cut")}
                              className="bg-amber-50 border text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-100 transition-colors"
                              title="Cut column array"
                            >
                              CUT
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if(confirm(`Wipe out all marks entries inside ${assessmentLabels[key]}?`)) {
                                  handleColumnAction(key, "clear");
                                }
                              }}
                              className="bg-rose-50 border text-rose-700 px-1 py-0.5 rounded hover:bg-rose-100 transition-colors"
                              title="Wipe entire data collection column"
                            >
                              CLEAR
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const studentRecord = marks[student.id] || {};
                    return (
                      <tr key={student.id} className="border-b border-black font-bold h-12 text-gray-900 hover:bg-gray-50/60">
                        <td className="p-3 text-left font-black uppercase text-blue-950 border-r border-black">{student.name}</td>
                        {assessmentsList.map((key) => {
                          const rawVal = studentRecord[`${selectedTerm}_${key}`];
                          const hasMark = rawVal !== undefined && rawVal !== null && rawVal !== "";
                          const currentVal = Number(rawVal ?? 0);
                          
                          const { maxMarkValue: dynamicMax, passMarkValue: dynamicPass } = getCellConfiguration(key);
                          
                          const isInvalid = hasMark && (currentVal > dynamicMax || currentVal < 0);
                          const isFailing = hasMark && !isInvalid && (currentVal < dynamicPass);
                          return (
                            <td key={key} className="p-2 border-r border-black">
                              <input
                                type="number"
                                min={0}
                                max={dynamicMax}
                                value={rawVal ?? ""}
                                data-student-idx={idx}
                                data-assessment={key}
                                onChange={(e) => handleMarkChange(student.id, key, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, key)}
                                onPaste={(e) => handleExcelPaste(e, idx, key)}
                                className={`w-16 border-2 p-1 text-center font-black rounded-lg transition-all ${
                                  isInvalid
                                    ? "bg-rose-100 border-rose-600 text-rose-700"
                                    : isFailing
                                    ? "bg-amber-50 border-amber-400 text-amber-700 font-extrabold shadow-inner"
                                    : "bg-white border-gray-300 text-gray-900"
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-50/50 text-[9px] font-black tracking-wide text-blue-950 border-t-2 border-black h-16">
                    <td className="p-3 text-left font-black uppercase bg-blue-900 text-white border-r border-black">
                      📊  COHORT LIVE INSIGHTS SUMMARY
                    </td>
                    {assessmentsList.map((key) => {
                      const stats = getAssessmentMetrics(key);
                      return (
                        <td key={key} className="p-2 border-r border-black text-center align-middle space-y-0.5 text-[8px] leading-tight font-extrabold">
                          {stats.totalCounted > 0 ? (
                            <>
                              <div className="text-blue-700">AVG: <span className="text-xs text-gray-900 font-black">{stats.avg}%</span></div>
                              <div className="text-emerald-700">PASS: <span className="text-gray-900">{stats.passRate}%</span></div>
                              <div className="text-gray-500">RANGE: <span className="text-gray-900">{stats.lowest} — {stats.highest}</span></div>
                            </>
                          ) : (
                            <span className="text-gray-400 uppercase italic">NO ENTRIES</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}