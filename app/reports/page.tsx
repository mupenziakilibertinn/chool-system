"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import html2pdf from "html2pdf.js";

const schoolSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function ReportsPage() {
  const [selectedClass, setSelectedClass] = useState("P6");
  const [classTeacherName, setClassTeacherName] = useState("TR. MUPENZI");
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  const [selectedTerm, setSelectedTerm] = useState("term1"); 
  const [activeReportType, setActiveReportType] = useState("mid1"); 

  useEffect(() => {
    fetchClassAndMarks();
  }, [selectedClass]);

  const fetchClassAndMarks = async () => {
    setLoading(true);
    try {
      const tSnap = await getDocs(query(collection(db, "teachers"), where("classTeacherOf", "==", selectedClass)));
      setClassTeacherName(!tSnap.empty ? tSnap.docs[0].data().name.toUpperCase() : "TR. MUPENZI");

      const studentSnap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
      const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let marksData: any = {};
      await Promise.all(studentList.map(async (student) => {
        marksData[student.id] = {};
        const marksSnap = await getDocs(collection(db, "students", student.id, "marks"));
        marksSnap.forEach((docSnap) => { marksData[student.id][docSnap.id] = docSnap.data(); });
      }));

      setAllMarks(marksData);
      setStudents(studentList);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const processCalculatedRoster = () => {
    const computed = students.map(student => {
      let earned = 0; let possible = 0;
      let worstSubjects: string[] = [];

      schoolSubjects.forEach(sub => {
        if (selectedClass === "P6" && sub === "French") return;
        const m = allMarks[student.id]?.[sub] || {};
        const maxWeight = (selectedClass !== "P6" && sub === "French") ? 25 : 50;

        const t1 = Number(m[`${selectedTerm}_t1`] || 0);
        const m1 = Number(m[`${selectedTerm}_m1`] || 0);
        const t2 = Number(m[`${selectedTerm}_t2`] || 0);
        const m2 = Number(m[`${selectedTerm}_m2`] || 0);

        let subEarned = 0; let subPossible = 0;

        if (activeReportType === "mid1") {
          subEarned = t1 + m1; subPossible = maxWeight * 2;
        } else if (activeReportType === "mid2") {
          subEarned = t2 + m2; subPossible = maxWeight * 2;
        } else {
          subEarned = t1 + m1 + t2 + m2; subPossible = maxWeight * 4;
        }

        earned += subEarned; possible += subPossible;
        if (subPossible > 0 && (subEarned / subPossible) < 0.5) {
          worstSubjects.push(sub.toUpperCase());
        }
      });

      const percentage = possible > 0 ? (earned / possible) * 100 : 0;
      return { ...student, totalEarned: earned, totalPossible: possible, percentage, worstSubjects };
    });

    const sorted = [...computed].sort((a, b) => b.percentage - a.percentage);
    return computed.map(st => {
      const posIndex = sorted.findIndex(s => s.percentage === st.percentage);
      return { ...st, rank: posIndex + 1 };
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  const printSingleCard = (cardId: string) => {
    const printContent = document.getElementById(cardId)?.innerHTML;
    if (printContent) {
      const originalBody = document.body.innerHTML;
      document.body.innerHTML = printContent;
      window.print();
      window.location.reload();
    }
  };

  const downloadPDF = (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    const opt = {
      margin: 0, 
      filename: `${filename}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    html2pdf().set(opt).from(element).save();
  };

  if (loading) return <div className="text-center font-bold p-10 text-blue-900 uppercase">Processing Term Standings...</div>;

  const activeRoster = processCalculatedRoster();

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-2 text-xs text-gray-800 pb-24">
      
      <div className="max-w-4xl mx-auto no-print bg-white p-5 rounded-2xl border shadow-sm mb-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="font-black text-blue-900 text-sm">NGS TERMINAL RECORD HUB</h2>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 font-black text-xs bg-white rounded-xl text-blue-900">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-black text-gray-400 uppercase text-[9px] tracking-wider w-24">Select Term:</span>
          <div className="grid grid-cols-3 gap-2 flex-1">
            {["term1", "term2", "term3"].map((t) => (
              <button key={t} onClick={() => setSelectedTerm(t)} className={`p-2 rounded-xl font-black uppercase text-[9px] border ${selectedTerm === t ? "bg-green-700 text-white shadow-sm border-green-700" : "bg-gray-50"}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-black text-gray-400 uppercase text-[9px] tracking-wider w-24">Booklet View:</span>
          <div className="grid grid-cols-3 gap-2 flex-1">
            <button onClick={() => setActiveReportType("mid1")} className={`p-2 rounded-xl font-black uppercase text-[9px] border ${activeReportType === "mid1" ? "bg-blue-950 text-white shadow" : "bg-gray-50"}`}>
              📑 Mid-Term 1 (Test 1 + Mid 1)
            </button>
            <button onClick={() => setActiveReportType("mid2")} className={`p-2 rounded-xl font-black uppercase text-[9px] border ${activeReportType === "mid2" ? "bg-blue-950 text-white shadow" : "bg-gray-50"}`}>
              📑 Mid-Term 2 (Test 2 + Mid 2)
            </button>
            <button onClick={() => setActiveReportType("summation")} className={`p-2 rounded-xl font-black uppercase text-[9px] border ${activeReportType === "summation" ? "bg-blue-900 text-white shadow" : "bg-gray-50"}`}>
              📊 Terminal Combined Summation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <button onClick={() => window.print()} className="bg-blue-900 text-white p-3 rounded-xl font-black uppercase text-[10px] tracking-wider shadow">Print Full Class Roster</button>
          <button onClick={() => downloadPDF("all-report-cards-print-pack", `${selectedClass}_${selectedTerm}_Report_Cards`)} className="bg-green-700 text-white p-3 rounded-xl font-black uppercase text-[10px] tracking-wider shadow">Download Full Class as PDF</button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { 
            page-break-before: always !important; 
            page-break-inside: avoid !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            border: none !important;
          }
        }
      `}</style>

      <div id="all-report-cards-print-pack" className="space-y-12">
        {activeRoster.map(student => {
          return (
            <div key={student.id} id={`card_${student.id}`} className="page-break relative p-8 bg-white max-w-[210mm] mx-auto min-h-[294mm] border-[6px] border-double border-blue-900 flex flex-col justify-between overflow-hidden shadow">
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] z-0 rotate-45">
                <h1 className="text-[72px] font-black text-black tracking-widest text-center whitespace-nowrap">NEW GENERATION SCHOOL</h1>
              </div>

              <div className="relative z-10 flex flex-col justify-between h-full flex-1">
                <div>
                  <div className="no-print flex justify-end gap-2 mb-4 border-b pb-2">
                    <button onClick={() => printSingleCard(`card_${student.id}`)} className="bg-blue-900 text-white text-[9px] px-2 py-1 rounded font-black hover:bg-black uppercase">Print Single Card</button>
                    <button onClick={() => downloadPDF(`card_${student.id}`, `${student.name}_${selectedTerm}_Report`)} className="bg-gray-100 border text-[9px] px-2 py-1 rounded font-black hover:bg-gray-200 uppercase">Download Single PDF</button>
                  </div>

                  <h1 className="text-center text-xl font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
                  <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5 mb-6 border-b pb-2">
                    {selectedTerm.toUpperCase()} &mdash; {activeReportType === "mid1" && "MID-TERM 1 PROGRESS BOOKLET (TEST 1 + MID 1)"}
                    {activeReportType === "mid2" && "MID-TERM 2 PROGRESS BOOKLET (TEST 2 + MID 2)"}
                    {activeReportType === "summation" && "FINAL TERMINAL COMBINED LEGER BOOK"}
                  </p>

                  <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-4 font-black uppercase text-[10px] text-gray-800 bg-gray-50 p-2 rounded-lg">
                    <div>Student Name: <span className="text-blue-900">{student.name}</span></div>
                    <div className="text-right">Class Level: <span className="text-blue-900">{selectedClass}</span></div>
                  </div>

                  <table className="w-full border-collapse border-2 border-black text-[10px] font-bold text-center bg-white/90">
                    <thead className="bg-gray-100 font-black uppercase text-[8px]">
                      {activeReportType === "summation" ? (
                        <tr>
                          <th className="border-2 border-black p-2 text-left">Subject Discipline</th>
                          <th className="border-2 border-black p-2">Mid-Term 1 Total Score</th>
                          <th className="border-2 border-black p-2">Mid-Term 2 Total Score</th>
                          <th className="border-2 border-black p-2 bg-gray-200">Total Term Aggregate</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="border-2 border-black p-2 text-left">Subject Discipline</th>
                          <th className="border-2 border-black p-2">Continuous Assessment (Test)</th>
                          <th className="border-2 border-black p-2">Formal Examination (Mid)</th>
                          <th className="border-2 border-black p-2 bg-gray-200">Accumulated Score</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {schoolSubjects.map(sub => {
                        if (selectedClass === "P6" && sub === "French") return null;
                        const m = allMarks[student.id]?.[sub] || {};
                        const maxWeight = (selectedClass !== "P6" && sub === "French") ? 25 : 50;

                        const t1 = Number(m[`${selectedTerm}_t1`] || 0);
                        const m1 = Number(m[`${selectedTerm}_m1`] || 0);
                        const t2 = Number(m[`${selectedTerm}_t2`] || 0);
                        const m2 = Number(m[`${selectedTerm}_m2`] || 0);

                        if (activeReportType === "mid1") {
                          const total = t1 + m1; const isRed = total < (maxWeight);
                          return (
                            <tr key={sub} className={`uppercase border-b border-black ${isRed ? "text-red-600 font-black bg-red-50/30" : ""}`}>
                              <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                              <td className="border border-black p-2">{t1} / {maxWeight}</td>
                              <td className="border border-black p-2">{m1} / {maxWeight}</td>
                              <td className="border-2 border-black p-2 font-black bg-gray-50">{total} / {maxWeight * 2}</td>
                            </tr>
                          );
                        } else if (activeReportType === "mid2") {
                          const total = t2 + m2; const isRed = total < (maxWeight);
                          return (
                            <tr key={sub} className={`uppercase border-b border-black ${isRed ? "text-red-600 font-black bg-red-50/30" : ""}`}>
                              <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                              <td className="border border-black p-2">{t2} / {maxWeight}</td>
                              <td className="border border-black p-2">{m2} / {maxWeight}</td>
                              <td className="border-2 border-black p-2 font-black bg-gray-50">{total} / {maxWeight * 2}</td>
                            </tr>
                          );
                        } else {
                          const sum1 = t1 + m1; const sum2 = t2 + m2;
                          const total = sum1 + sum2; const maxTot = (maxWeight * 4);
                          const isRed = total < (maxTot / 2);
                          return (
                            <tr key={sub} className={`uppercase border-b border-black ${isRed ? "text-red-600 font-black bg-red-50/30" : ""}`}>
                              <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                              <td className="border border-black p-2">{sum1} / {maxWeight * 2}</td>
                              <td className="border border-black p-2">{sum2} / {maxWeight * 2}</td>
                              <td className="border-2 border-black p-2 font-black bg-gray-50">{total} / {maxTot}</td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-2 border-2 border-black text-center font-black uppercase text-[10px]">
                    <div className="bg-gray-100 p-2 border-r-2 border-black">
                      <span className="text-[8px] text-gray-400 block font-bold mb-0.5">Marks Obtained</span>
                      <span className="text-blue-900 text-xs">{student.totalEarned} pts</span>
                    </div>
                    <div className="bg-gray-100 p-2 border-r-2 border-black">
                      <span className="text-[8px] text-gray-400 block font-bold mb-0.5">Terminal Percentage</span>
                      <span className="text-gray-900 text-xs">{student.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="bg-blue-900 text-white p-2">
                      <span className="text-[8px] text-blue-200 block font-bold mb-0.5">Position (Rank)</span>
                      <span className="text-sm font-black">{student.rank} / {students.length}</span>
                    </div>
                  </div>

                  <div className="p-4 border-2 border-black rounded-xl bg-gray-50/90 font-bold text-[10px] flex justify-between items-center">
                    <div className="space-y-1 max-w-[70%]">
                      <span className="font-black text-[#1E3A8A] uppercase tracking-wider block">CLASS MASTER REMARKS:</span>
                      <p className="uppercase leading-relaxed text-gray-700 font-black italic">
                        {student.percentage >= 80 ? (
                          "EXCELLENT WORK. KEEP IT UP. BACKWARD NEVER, FORWARD EVER."
                        ) : (
                          student.worstSubjects.length > 0 ? (
                            `MINDED DEFICIT PERFORMANCE TRACKED. CONCENTRATE AND IMPROVE ON THESE SPECIFIC AREAS: [ ${student.worstSubjects.join(" , ")} ].`
                          ) : (
                            "STEADY PROGRESS NOTED. MORE EFFORT IS REQUIRED TO SURPASS HIGHER ACADEMIC STANDARDS NEXT TERM."
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-right border-l-2 pl-4 border-gray-400 min-w-[140px]">
                      <span className="text-[8px] uppercase text-gray-400 block font-black mb-0.5">EVALUATION SIGNATURE:</span>
                      <span className="font-black uppercase text-blue-950 tracking-wide text-xs block">{classTeacherName}</span>
                    </div>
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