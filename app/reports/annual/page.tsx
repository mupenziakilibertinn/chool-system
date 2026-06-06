"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const subjectsList = ["Mathematics", "SET", "SRE", "Kinyarwanda", "French", "English"];
const coCurricularList = ["Sport", "Creative Art"];

function AnnualMasterEngine() {
  const searchParams = useSearchParams();
  const urlClass = searchParams.get("class");
  const activeClass = urlClass ? urlClass.toUpperCase() : "P6";
  
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnualData = async () => {
      setLoading(true);
      try {
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

        // Compute rankings for Table 1 (Tests/Interrogations Layout)
        const t1Calculated = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          let earned = 0;
          let maxPossible = 0;

          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            ["term1", "term2", "term3"].forEach((tKey) => {
              const mData = studentMarks[sub] || {};
              const v1 = mData[`${tKey}_t1`];
              const v2 = mData[`${tKey}_m1`];
              const v3 = mData[`${tKey}_t2`];
              const v4 = mData[`${tKey}_m2`];

              if (v1 !== undefined && v1 !== "-") earned += Number(v1);
              if (v2 !== undefined && v2 !== "-") earned += Number(v2);
              if (v3 !== undefined && v3 !== "-") earned += Number(v3);
              if (v4 !== undefined && v4 !== "-") earned += Number(v4);
              maxPossible += (baseMax * 4);
            });
          });
          return { ...student, earned, maxPossible, pct: maxPossible > 0 ? (earned / maxPossible) * 100 : 0 };
        });

        // Compute rankings for Table 2 (Comprehensive Matrix With Co-Curriculars)
        const t2Calculated = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          let earned = 0;
          let maxPossible = 0;

          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            ["term1", "term2", "term3"].forEach((tKey) => {
              const mData = studentMarks[sub] || {};
              const v1 = mData[`${tKey}_t1`];
              const v2 = mData[`${tKey}_m1`];
              const v3 = mData[`${tKey}_t2`];
              const v4 = mData[`${tKey}_m2`];

              if (v1 !== undefined && v1 !== "-") earned += Number(v1);
              if (v2 !== undefined && v2 !== "-") earned += Number(v2);
              if (v3 !== undefined && v3 !== "-") earned += Number(v3);
              if (v4 !== undefined && v4 !== "-") earned += Number(v4);
              maxPossible += (baseMax * 4);
            });
          });

          coCurricularList.forEach((sub) => {
            ["term1", "term2", "term3"].forEach((tKey) => {
              const mData = studentMarks[sub] || {};
              const v1 = mData[`${tKey}_t1`];
              const v2 = mData[`${tKey}_m1`];
              if (v1 !== undefined && v1 !== "-") earned += Number(v1);
              if (v2 !== undefined && v2 !== "-") earned += Number(v2);
              maxPossible += 10; 
            });
          });

          return { ...student, earned, maxPossible, pct: maxPossible > 0 ? (earned / maxPossible) * 100 : 0 };
        });

        // Map objects to avoid breakdown errors on empty fields
        const alphabeticalList = classFiltered.map(s => {
          const r1 = [...t1Calculated].sort((a,b) => b.pct - a.pct);
          const r2 = [...t2Calculated].sort((a,b) => b.pct - a.pct);
          
          return {
            ...s,
            t1Rank: r1.findIndex(x => x.id === s.id) + 1,
            t2Rank: r2.findIndex(x => x.id === s.id) + 1,
            t1Totals: t1Calculated.find(x => x.id === s.id) || { earned: 0, maxPossible: 0, pct: 0 },
            t2Totals: t2Calculated.find(x => x.id === s.id) || { earned: 0, maxPossible: 0, pct: 0 }
          };
        }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setStudents(alphabeticalList);
      } catch (err) {
        console.error("Critical System Data Build Interrupted:", err);
      }
      setLoading(false);
    };

    fetchAnnualData();
  }, [activeClass]);

  const parseNumFallback = (val: any) => (val === undefined || val === null || val === "-") ? 0 : Number(val);

  if (loading) return <div className="p-12 text-center font-black tracking-widest text-blue-900 text-xs uppercase">Assembling System Annual Matrix...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen text-[11px] font-black font-sans space-y-12">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-after: always !important; }
          body { background: white !important; }
        }
        table th, table td { border: 2px solid black !important; padding: 4px 3px !important; }
      `}} />

      <div className="no-print bg-white p-4 border-2 border-black rounded-xl max-w-md mx-auto text-center shadow-sm">
        <h2 className="text-xs font-black text-blue-900 mb-1 uppercase">Annual Dual-Table Dashboard</h2>
        <p className="text-gray-400 text-[10px] mb-3">Both structures rendered completely together.</p>
        <button onClick={() => window.print()} className="bg-blue-900 text-white font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider">
          Print Whole Class Register 🖨️
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center text-gray-400 uppercase py-10">No registered students located inside class stream {activeClass}</div>
      ) : (
        students.map((student) => {
          const studentMarks = allMarks[student.id] || {};

          return (
            <div key={student.id} className="bg-white p-6 border-4 border-black max-w-5xl mx-auto space-y-12 page-break shadow-sm">
              
              <div className="flex justify-between items-center border-b-4 border-black pb-2 text-[11px]">
                <div>NOM DU LÉGIONNAIRE / NAME: <span className="text-blue-900 text-sm font-black uppercase ml-1">{student.name}</span></div>
                <div className="flex gap-6">
                  <div>CLASS: <span className="text-blue-950 uppercase">{activeClass} Stream</span></div>
                  <div>ROLL SIZE: <span className="text-blue-950">{students.length}</span></div>
                </div>
              </div>

              {/* =======================================================
                  TABLE 1: TESTS / INTERROGATIONS VIEW
                 ======================================================= */}
              <div className="space-y-1.5">
                <div className="text-left font-black tracking-wide text-xs uppercase text-blue-900">I. TESTS / INTERROGATIONS LAYOUT</div>
                <table className="w-full text-center border-collapse border-2 border-black">
                  <thead>
                    <tr className="bg-gray-100 text-[10px]">
                      <th className="text-left pl-2 w-[22%]">MATIÈRES / SUBJECTS</th>
                      <th colSpan={3} className="bg-gray-200/60">MAX / TRIMESTRE</th>
                      <th colSpan={3}>1st TRIMESTRE</th>
                      <th colSpan={3}>2nd TRIMESTRE</th>
                      <th colSpan={3}>3rd TRIMESTRE</th>
                      <th colSpan={3} className="text-blue-900 bg-blue-50/50">TOTAL ANNUEL</th>
                    </tr>
                    <tr className="bg-gray-50 text-[9px] uppercase">
                      <th className="text-left pl-2">Course Pathways</th>
                      <th>Mid 1</th>
                      <th>Mid 2</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Mid 1</th>
                      <th>Mid 2</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Mid 1</th>
                      <th>Mid 2</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Mid 1</th>
                      <th>Mid 2</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Max</th>
                      <th>Earned</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsList.map((sub) => {
                      if (activeClass === "P6" && sub === "French") return null;
                      const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
                      const maxCol = isFrenchP1P5 ? 25 : 50;

                      const mData = studentMarks[sub] || {};
                      
                      const t1_1 = mData.term1_t1 ?? "-"; const t1_2 = mData.term1_m1 ?? "-";
                      const t1_tot = (t1_1 !== "-" || t1_2 !== "-") ? parseNumFallback(t1_1) + parseNumFallback(t1_2) : "-";

                      const t2_1 = mData.term2_t1 ?? "-"; const t2_2 = mData.term2_m1 ?? "-";
                      const t2_tot = (t2_1 !== "-" || t2_2 !== "-") ? parseNumFallback(t2_1) + parseNumFallback(t2_2) : "-";

                      const t3_1 = mData.term3_t1 ?? "-"; const t3_2 = mData.term3_m1 ?? "-";
                      const t3_tot = (t3_1 !== "-" || t3_2 !== "-") ? parseNumFallback(t3_1) + parseNumFallback(t3_2) : "-";

                      const rowEarned = (t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0);
                      const rowMax = maxCol * 4 * 3;

                      return (
                        <tr key={sub} className="text-gray-900 font-black">
                          <td className="text-left pl-2 uppercase bg-gray-50/40 border-r-2">{sub}</td>
                          <td>{maxCol}</td>
                          <td>{maxCol}</td>
                          <td className="bg-gray-100 font-bold">{maxCol * 2}</td>
                          <td>{t1_1}</td><td>{t1_2}</td><td className="bg-gray-100 font-bold">{t1_tot}</td>
                          <td>{t2_1}</td><td>{t2_2}</td><td className="bg-gray-100 font-bold">{t2_tot}</td>
                          <td>{t3_1}</td><td>{t3_2}</td><td className="bg-gray-100 font-bold">{t3_tot}</td>
                          <td className="bg-gray-50">{rowMax}</td>
                          <td className="text-blue-900 font-black">{rowEarned}</td>
                          <td className="text-green-800 font-serif">{(rowEarned / rowMax * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-blue-50/70 font-black border-t-2 border-black text-blue-950">
                      <td className="text-left pl-2 uppercase">TOTAL GENERAL</td>
                      <td colSpan={3} className="bg-gray-100 text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td className="bg-gray-100 font-serif">{student.t1Totals?.maxPossible}</td>
                      <td className="text-blue-900 font-serif text-[12px]">{student.t1Totals?.earned}</td>
                      <td className="text-green-800 font-serif text-[12px]">{student.t1Totals?.pct.toFixed(1)}%</td>
                    </tr>
                    <tr className="bg-gray-50 font-black">
                      <td className="text-left pl-2 uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-green-800 font-serif text-center text-[12px]">{student.t1Totals?.pct.toFixed(1)}%</td>
                    </tr>
                    <tr className="font-black border-b-2 border-black">
                      <td className="text-left pl-2 uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center text-gray-400">SUR {students.length}</td>
                      <td colSpan={3} className="text-center text-gray-400">SUR {students.length}</td>
                      <td colSpan={3} className="text-center text-gray-400">SUR {students.length}</td>
                      <td colSpan={3} className="bg-green-50 text-emerald-900 font-serif text-center text-[12px] uppercase">{student.t1Rank} SUR {students.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* =======================================================
                  TABLE 2: COMPREHENSIVE ANNUAL TOTAL MATRIX WITH CO-CURRICULARS
                 ======================================================= */}
              <div className="space-y-1.5">
                <div className="text-left font-black tracking-wide text-xs uppercase text-blue-900">II. COMPREHENSIVE METRIC MATRIX LAYOUT</div>
                <table className="w-full text-center border-collapse border-2 border-black">
                  <thead>
                    <tr className="bg-gray-100 text-[10px]">
                      <th className="text-left pl-2 w-[22%]">MATIÈRES / SUBJECTS</th>
                      <th colSpan={3} className="bg-gray-200/60">MAX SPLIT BASELINE</th>
                      <th colSpan={3}>1st TRIMESTRE</th>
                      <th colSpan={3}>2nd TRIMESTRE</th>
                      <th colSpan={3}>3rd TRIMESTRE</th>
                      <th colSpan={3} className="text-blue-900 bg-blue-50/50">ANNUAL PERFORMANCE</th>
                    </tr>
                    <tr className="bg-gray-50 text-[9px] uppercase">
                      <th className="text-left pl-2">MATIÈRES</th>
                      <th>Max Int</th>
                      <th>Max Ex</th>
                      <th className="bg-gray-100">Max Tot</th>
                      <th>Mid</th>
                      <th>Exam</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Mid</th>
                      <th>Exam</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Mid</th>
                      <th>Exam</th>
                      <th className="bg-gray-100">Total</th>
                      <th>Total Max</th>
                      <th>Total</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsList.map((sub) => {
                      if (activeClass === "P6" && sub === "French") return null;
                      const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
                      const baseMax = isFrenchP1P5 ? 25 : 50;

                      const mData = studentMarks[sub] || {};
                      const t1_mid = (mData.term1_t1 ?? mData.term1_m1) ? parseNumFallback(mData.term1_t1) + parseNumFallback(mData.term1_m1) : "-";
                      const t1_ex = (mData.term1_t2 ?? mData.term1_m2) ? parseNumFallback(mData.term1_t2) + parseNumFallback(mData.term1_m2) : "-";
                      const t1_tot = t1_mid !== "-" || t1_ex !== "-" ? parseNumFallback(t1_mid) + parseNumFallback(t1_ex) : "-";

                      const t2_mid = (mData.term2_t1 ?? mData.term2_m1) ? parseNumFallback(mData.term2_t1) + parseNumFallback(mData.term2_m1) : "-";
                      const t2_ex = (mData.term2_t2 ?? mData.term2_m2) ? parseNumFallback(mData.term2_t2) + parseNumFallback(mData.term2_m2) : "-";
                      const t2_tot = t2_mid !== "-" || t2_ex !== "-" ? parseNumFallback(t2_mid) + parseNumFallback(t2_ex) : "-";

                      const t3_mid = (mData.term3_t1 ?? mData.term3_m1) ? parseNumFallback(mData.term3_t1) + parseNumFallback(mData.term3_m1) : "-";
                      const t3_ex = (mData.term3_t2 ?? mData.term3_m2) ? parseNumFallback(mData.term3_t2) + parseNumFallback(mData.term3_m2) : "-";
                      const t3_tot = t3_mid !== "-" || t3_ex !== "-" ? parseNumFallback(t3_mid) + parseNumFallback(t3_ex) : "-";

                      const rowEarned = (t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0);
                      const rowMax = baseMax * 4 * 3;

                      return (
                        <tr key={sub} className="text-gray-900 font-black">
                          <td className="text-left pl-2 uppercase bg-gray-50/40 border-r-2">{sub}</td>
                          <td>{baseMax}</td>
                          <td>{baseMax}</td>
                          <td className="bg-gray-100 font-bold">{baseMax * 2}</td>
                          <td>{t1_mid}</td><td>{t1_ex}</td><td className="bg-gray-100 font-bold">{t1_tot}</td>
                          <td>{t2_mid}</td><td>{t2_ex}</td><td className="bg-gray-100 font-bold">{t2_tot}</td>
                          <td>{t3_mid}</td><td>{t3_ex}</td><td className="bg-gray-100 font-bold">{t3_tot}</td>
                          <td className="bg-gray-50">{rowMax}</td>
                          <td className="text-blue-950 font-black">{rowEarned}</td>
                          <td className="text-green-800 font-serif">{(rowEarned / rowMax * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}

                    <tr className="bg-gray-100 font-black tracking-wider border-t-2 border-black text-[9px] uppercase">
                      <td colSpan={16} className="text-center p-0.5">CO-CURRICULAR ACTIVITIES / ÉVALUATION COMPLÉMENTAIRE</td>
                    </tr>

                    {coCurricularList.map((sub) => {
                      const mData = studentMarks[sub] || {};
                      const t1_mid = mData.term1_t1 ?? "-"; const t1_ex = mData.term1_m1 ?? "-";
                      const t1_tot = t1_mid !== "-" || t1_ex !== "-" ? parseNumFallback(t1_mid) + parseNumFallback(t1_ex) : "-";

                      const t2_mid = mData.term2_t1 ?? "-"; const t2_ex = mData.term2_m1 ?? "-";
                      const t2_tot = mData.term2_mid !== "-" || t2_ex !== "-" ? parseNumFallback(t2_mid) + parseNumFallback(t2_ex) : "-";

                      const t3_mid = mData.term3_t1 ?? "-"; const t3_ex = mData.term3_m1 ?? "-";
                      const t3_tot = t3_mid !== "-" || t3_ex !== "-" ? parseNumFallback(t3_mid) + parseNumFallback(t3_ex) : "-";

                      const rowEarned = (t1_tot !== "-" ? t1_tot : 0) + (t2_tot !== "-" ? t2_tot : 0) + (t3_tot !== "-" ? t3_tot : 0);
                      const rowMax = 30;

                      return (
                        <tr key={sub} className="text-gray-900 font-black">
                          <td className="text-left pl-2 uppercase bg-gray-50/40 border-r-2">{sub}</td>
                          <td>5</td>
                          <td>5</td>
                          <td className="bg-gray-100 font-bold">10</td>
                          <td>{t1_mid}</td><td>{t1_ex}</td><td className="bg-gray-100 font-bold">{t1_tot}</td>
                          <td>{t2_mid}</td><td>{t2_ex}</td><td className="bg-gray-100 font-bold">{t2_tot}</td>
                          <td>{t3_mid}</td><td>{t3_ex}</td><td className="bg-gray-100 font-bold">{t3_tot}</td>
                          <td className="bg-gray-50">{rowMax}</td>
                          <td className="text-blue-900 font-black">{rowEarned}</td>
                          <td className="text-green-800 font-serif">{(rowEarned / rowMax * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}

                    <tr className="bg-blue-900 text-white font-black text-[12px] border-t-4 border-black">
                      <td className="text-left pl-2 uppercase">TOTAL GENERAL</td>
                      <td>285</td>
                      <td>285</td>
                      <td className="bg-blue-950">570</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center">-</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center">-</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center">-</td>
                      <td className="bg-blue-950 font-serif">{student.t2Totals?.maxPossible}</td>
                      <td className="text-white font-serif">{student.t2Totals?.earned}</td>
                      <td className="text-white font-serif">{student.t2Totals?.pct.toFixed(1)}%</td>
                    </tr>
                    <tr className="font-black bg-gray-50">
                      <td className="text-left pl-2 uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center">....................%</td>
                      <td colSpan={3} className="text-center">....................%</td>
                      <td colSpan={3} className="text-center">....................%</td>
                      <td colSpan={3} className="text-blue-950 font-serif text-center text-[12px]">{student.t2Totals?.pct.toFixed(1)}%</td>
                    </tr>
                    <tr className="font-black bg-gray-50 border-b-4 border-black">
                      <td className="text-left pl-2 uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center text-gray-400">....................Sur {students.length}</td>
                      <td colSpan={3} className="text-center text-gray-400">....................Sur {students.length}</td>
                      <td colSpan={3} className="text-center text-gray-400">....................Sur {students.length}</td>
                      <td colSpan={3} className="bg-green-100 text-green-900 font-serif text-center text-[12px] uppercase">{student.t2Rank} SUR {students.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          );
        })
      )}
    </div>
  );
}

export default function AnnualMasterPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black uppercase text-xs tracking-widest text-blue-900">Loading Pipeline Stream Setup...</div>}>
      <AnnualMasterEngine />
    </Suspense>
  );
}