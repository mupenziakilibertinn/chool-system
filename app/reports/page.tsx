"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const schoolSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function ReportsPage() {
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState("P6");
  const [classTeacherName, setClassTeacherName] = useState("TR. MUPENZI");
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeReportType, setActiveReportType] = useState("mid1"); // "mid1", "mid2", "summation"

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const docSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", user.email.toLowerCase())));
        if (!docSnap.empty) {
          const profile = docSnap.docs[0].data();
          setTeacherProfile(profile);
          if (!profile.isAdmin) {
            setSelectedClass(profile.classTeacherOf || "P6");
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchClassAndMarks();
    }
  }, [selectedClass]);

  const fetchClassAndMarks = async () => {
    setLoading(true);
    try {
      // Find the specific Class Teacher assigned to this active class stream
      const tSnap = await getDocs(query(collection(db, "teachers"), where("classTeacherOf", "==", selectedClass)));
      if (!tSnap.empty) {
        setClassTeacherName(tSnap.docs[0].data().name.toUpperCase());
      } else {
        setClassTeacherName("TR. MUPENZI"); // Global fallback if unassigned
      }

      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const studentSnap = await getDocs(q);
      const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let marksData: any = {};
      await Promise.all(studentList.map(async (student) => {
        marksData[student.id] = {};
        const marksSnap = await getDocs(collection(db, "students", student.id, "marks"));
        marksSnap.forEach((docSnap) => {
          marksData[student.id][docSnap.id] = docSnap.data();
        });
      }));

      setAllMarks(marksData);
      setStudents(studentList);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const processCalculatedRoster = () => {
    const computed = students.map(student => {
      let earned = 0;
      let possible = 0;

      schoolSubjects.forEach(sub => {
        if (selectedClass === "P6" && sub === "French") return;
        const m = allMarks[student.id]?.[sub] || {};
        const subMax = sub === "French" ? 50 : 100;

        const t1 = Number(m.term1_t1 || 0); const m1 = Number(m.term1_m1 || 0);
        const t2 = Number(m.term2_t1 || 0); const m2 = Number(m.term2_m1 || 0);
        const t3 = Number(m.term3_t1 || 0); const m3 = Number(m.term3_m1 || 0);

        if (activeReportType === "mid1") {
          earned += (t1 + m1);
          possible += subMax;
        } else if (activeReportType === "mid2") {
          earned += (t2 + m2);
          possible += subMax;
        } else {
          earned += (t1 + m1 + t2 + m2 + t3 + m3);
          possible += (subMax * 3);
        }
      });

      const percentage = possible > 0 ? (earned / possible) * 100 : 0;
      return { ...student, totalEarned: earned, totalPossible: possible, percentage };
    });

    const sorted = [...computed].sort((a, b) => b.percentage - a.percentage);

    return computed.map(st => {
      const positionIndex = sorted.findIndex(s => s.percentage === st.percentage);
      return { ...st, rank: positionIndex + 1 };
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  if (loading) return <div className="text-center p-10 font-bold uppercase text-blue-900">Calculating Student Standings...</div>;
  if (!teacherProfile) return <div className="text-center p-10 text-red-500 font-bold uppercase">ACCESS DENIED.</div>;

  const activeRoster = processCalculatedRoster();

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 text-xs pb-20 text-gray-800">
      
      {/* Control Panel Header */}
      <div className="max-w-4xl mx-auto no-print bg-white p-5 rounded-2xl shadow-sm border mb-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h1 className="text-sm font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
            <p className="text-[9px] text-gray-400 uppercase font-black mt-0.5">Automated Multi-Term Report Ledger</p>
          </div>
          {teacherProfile.isAdmin ? (
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 text-xs">
              {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <span className="font-black border p-2 rounded bg-gray-100 text-blue-950 uppercase">STREAM: {selectedClass}</span>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase text-gray-400 font-black mb-2 tracking-wider">Select Active Assessment Period to Generate:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setActiveReportType("mid1")} className={`p-2.5 rounded-xl font-black uppercase text-[10px] tracking-wide transition-all border ${activeReportType === "mid1" ? "bg-blue-950 text-white shadow-md border-blue-950" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
              📑 Report Card 1 (Mid-Term 1)
            </button>
            <button onClick={() => setActiveReportType("mid2")} className={`p-2.5 rounded-xl font-black uppercase text-[10px] tracking-wide transition-all border ${activeReportType === "mid2" ? "bg-blue-950 text-white shadow-md border-blue-950" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
              📑 Report Card 2 (Mid-Term 2)
            </button>
            <button onClick={() => setActiveReportType("summation")} className={`p-2.5 rounded-xl font-black uppercase text-[10px] tracking-wide transition-all border ${activeReportType === "summation" ? "bg-green-700 text-white shadow-md border-green-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
              📊 Final Cumulative Summation
            </button>
          </div>
        </div>

        <button onClick={() => window.print()} className="w-full bg-blue-900 hover:bg-black text-white font-black py-3 rounded-xl uppercase tracking-wider text-[10px] shadow transition-all">
          Print Active Forms ({students.length} report cards)
        </button>
      </div>

      {/* Printable Cards Loop */}
      <div className="space-y-12">
        {activeRoster.map(student => {
          return (
            <div key={student.id} className="page-break p-8 bg-white max-w-[210mm] mx-auto min-h-[297mm] border-[6px] border-double border-blue-900 font-sans shadow-sm flex flex-col justify-between">
              
              <div>
                <h1 className="text-center text-xl font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
                <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5 mb-6 border-b pb-2">
                  {activeReportType === "mid1" && "Mid-Term Evaluation Record — Booklet 1"}
                  {activeReportType === "mid2" && "Mid-Term Evaluation Record — Booklet 2"}
                  {activeReportType === "summation" && "Comprehensive Annual Accumulation Ledger"}
                </p>
                
                <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-4 font-black uppercase text-[10px] text-gray-800 bg-gray-50 p-2 rounded-lg">
                  <div>Pupil Name: <span className="text-blue-900">{student.name}</span></div>
                  <div className="text-right">Class Stream: <span className="text-blue-900">{selectedClass}</span></div>
                </div>

                <table className="w-full border-collapse border-2 border-black text-[10px] font-bold text-center">
                  <thead className="bg-gray-100 font-black uppercase text-[8px]">
                    {activeReportType === "summation" ? (
                      <tr>
                        <th className="border-2 border-black p-2 text-left">Subject Discipline</th>
                        <th className="border-2 border-black p-2">Term 1 Total</th>
                        <th className="border-2 border-black p-2">Term 2 Total</th>
                        <th className="border-2 border-black p-2">Term 3 Total</th>
                        <th className="border-2 border-black p-2 bg-gray-200 text-blue-950">Combined Sum</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="border-2 border-black p-2 text-left">Subject Discipline</th>
                        <th className="border-2 border-black p-2">Continuous Assessment (Test)</th>
                        <th className="border-2 border-black p-2">Formal Examination (Mid)</th>
                        <th className="border-2 border-black p-2 bg-gray-200 text-blue-950">Accumulated Score</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {schoolSubjects.map(sub => {
                      if (selectedClass === "P6" && sub === "French") return null;

                      const m = allMarks[student.id]?.[sub] || {};
                      const maxWeight = sub === "French" ? 25 : 50;

                      const t1 = Number(m.term1_t1 || 0); const m1 = Number(m.term1_m1 || 0);
                      const t2 = Number(m.term2_t1 || 0); const m2 = Number(m.term2_m1 || 0);
                      const t3 = Number(m.term3_t1 || 0); const m3 = Number(m.term3_m1 || 0);

                      if (activeReportType === "mid1") {
                        return (
                          <tr key={sub} className="uppercase border-b border-black">
                            <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                            <td className="border border-black p-2">{t1} / {maxWeight}</td>
                            <td className="border border-black p-2">{m1} / {maxWeight}</td>
                            <td className="border-2 border-black p-2 bg-gray-50 font-black text-blue-950">{t1 + m1} / {maxWeight * 2}</td>
                          </tr>
                        );
                      } else if (activeReportType === "mid2") {
                        return (
                          <tr key={sub} className="uppercase border-b border-black">
                            <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                            <td className="border border-black p-2">{t2} / {maxWeight}</td>
                            <td className="border border-black p-2">{m2} / {maxWeight}</td>
                            <td className="border-2 border-black p-2 bg-gray-50 font-black text-blue-950">{t2 + m2} / {maxWeight * 2}</td>
                          </tr>
                        );
                      } else {
                        const sumT1 = t1 + m1; const sumT2 = t2 + m2; const sumT3 = t3 + m3;
                        return (
                          <tr key={sub} className="uppercase border-b border-black">
                            <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                            <td className="border border-black p-2">{sumT1} / {maxWeight * 2}</td>
                            <td className="border border-black p-2">{sumT2} / {maxWeight * 2}</td>
                            <td className="border border-black p-2">{sumT3} / {maxWeight * 2}</td>
                            <td className="border-2 border-black p-2 bg-gray-50 font-black text-blue-950">
                              {sumT1 + sumT2 + sumT3} / {(maxWeight * 2) * 3}
                            </td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>
              </div>

              {/* Position and Stats Footer */}
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-3 gap-2 border-2 border-black text-center font-black uppercase text-[10px]">
                  <div className="bg-gray-100 p-2 border-r-2 border-black">
                    <span className="text-[8px] text-gray-400 block font-bold mb-0.5">Marks Obtained</span>
                    <span className="text-blue-900 text-xs">{student.totalEarned} pts</span>
                  </div>
                  <div className="bg-gray-100 p-2 border-r-2 border-black">
                    <span className="text-[8px] text-gray-400 block font-bold mb-0.5">Average Performance</span>
                    <span className="text-gray-900 text-xs">{student.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="bg-blue-900 text-white p-2">
                    <span className="text-[8px] text-blue-200 block font-bold mb-0.5">Class Placement (Rank)</span>
                    <span className="text-sm tracking-wider font-black">
                      {student.rank} / {students.length}
                    </span>
                  </div>
                </div>

                <div className="p-3 border-2 border-dashed border-blue-950 rounded-xl bg-gray-50 flex justify-between items-center font-bold text-[10px]">
                  <div>
                    <span className="font-black text-blue-900 uppercase tracking-wider block mb-0.5">OFFICIAL WATERMARK: NEW GENERATION SCHOOL</span>
                    <span className="text-gray-500 uppercase">
                      {student.percentage >= 50 
                        ? "Satisfactory completion of assessment benchmarks." 
                        : "Requires continuous learning mentorship support indicators."}
                    </span>
                  </div>
                  <div className="text-right border-l-2 pl-4 border-gray-300 min-w-[140px]">
                    <span className="text-[8px] uppercase text-gray-400 block font-black mb-0.5">Prepared By:</span>
                    {/* FIXED: Using dynamic variable classTeacherName instead of hardcoded string */}
                    <span className="font-black uppercase text-blue-950 text-xs tracking-wide">{classTeacherName}</span>
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