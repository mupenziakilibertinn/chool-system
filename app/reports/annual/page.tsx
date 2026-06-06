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

  const parseNumFallback = (val: any) => (val === undefined || val === null || val === "-") ? 0 : Number(val);
  const isValidMark = (val: any) => val !== undefined && val !== null && val !== "-";

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

        // Define calculation metrics pipelines for terms
        const computedMetrics = classFiltered.map((student) => {
          const studentMarks = marksMatrix[student.id] || {};
          
          // --- TABLE 1 CALCULATIONS ---
          let t1_t1Earned = 0, t1_t1Max = 0, t1_t1Valid = false;
          let t1_t2Earned = 0, t1_t2Max = 0, t1_t2Valid = false;
          let t1_t3Earned = 0, t1_t3Max = 0, t1_t3Valid = false;

          // --- TABLE 2 CALCULATIONS ---
          let t2_t1Earned = 0, t2_t1Max = 0, t2_t1Valid = false;
          let t2_t2Earned = 0, t2_t2Max = 0, t2_t2Valid = false;
          let t2_t3Earned = 0, t2_t3Max = 0, t2_t3Valid = false;

          subjectsList.forEach((sub) => {
            if (activeClass === "P6" && sub === "French") return;
            const isFrenchP1P5 = sub === "French" && activeClass !== "P6";
            const baseMax = isFrenchP1P5 ? 25 : 50;

            const mData = studentMarks[sub] || {};
            
            // Term 1 Raw Fields
            const t1v1 = mData.term1_t1; const t1v2 = mData.term1_m1;
            const t1v3 = mData.term1_t2; const t1v4 = mData.term1_m2;
            // Term 2 Raw Fields
            const t2v1 = mData.term2_t1; const t2v2 = mData.term2_m1;
            const t2v3 = mData.term2_t2; const t2v4 = mData.term2_m2;
            // Term 3 Raw Fields
            const t3v1 = mData.term3_t1; const t3v2 = mData.term3_m1;
            const t3v3 = mData.term3_t2; const t3v4 = mData.term3_m2;

            // Table 1: Mid 1 + Mid 2 accumulation per term
            if (isValidMark(t1v1) || isValidMark(t1v2)) {
              t1_t1Earned += parseNumFallback(t1v1) + parseNumFallback(t1v2);
              t1_t1Max += baseMax * 2; t1_t1Valid = true;
            }
            if (isValidMark(t2v1) || isValidMark(t2v2)) {
              t1_t2Earned += parseNumFallback(t2v1) + parseNumFallback(t2v2);
              t1_t2Max += baseMax * 2; t1_t2Valid = true;
            }
            if (isValidMark(t3v1) || isValidMark(t3v2)) {
              t1_t3Earned += parseNumFallback(t3v1) + parseNumFallback(t3v2);
              t1_t3Max += baseMax * 2; t1_t3Valid = true;
            }

            // Table 2: Complete subjects distribution (Mid + Exam)
            if (isValidMark(t1v1) || isValidMark(t1v2) || isValidMark(t1v3) || isValidMark(t1v4)) {
              t2_t1Earned += parseNumFallback(t1v1) + parseNumFallback(t1v2) + parseNumFallback(t1v3) + parseNumFallback(t1v4);
              t2_t1Max += baseMax * 4; t2_t1Valid = true;
            }
            if (isValidMark(t2v1) || isValidMark(t2v2) || isValidMark(t2v3) || isValidMark(t2v4)) {
              t2_t2Earned += parseNumFallback(t2v1) + parseNumFallback(t2v2) + parseNumFallback(t2v3) + parseNumFallback(t2v4);
              t2_t2Max += baseMax * 4; t2_t2Valid = true;
            }
            if (isValidMark(t3v1) || isValidMark(t3v2) || isValidMark(t3v3) || isValidMark(t3v4)) {
              t2_t3Earned += parseNumFallback(t3v1) + parseNumFallback(t3v2) + parseNumFallback(t3v3) + parseNumFallback(t3v4);
              t2_t3Max += baseMax * 4; t2_t3Valid = true;
            }
          });

          // Table 2: Add Co-curricular contributions to Table 2 Term totals
          coCurricularList.forEach((sub) => {
            const mData = studentMarks[sub] || {};
            const t1v1 = mData.term1_t1; const t1v2 = mData.term1_m1;
            const t2v1 = mData.term2_t1; const t2v2 = mData.term2_m1;
            const t3v1 = mData.term3_t1; const t3v2 = mData.term3_m1;

            if (isValidMark(t1v1) || isValidMark(t1v2)) {
              t2_t1Earned += parseNumFallback(t1v1) + parseNumFallback(t1v2);
              t2_t1Max += 10; t2_t1Valid = true;
            }
            if (isValidMark(t2v1) || isValidMark(t2v2)) {
              t2_t2Earned += parseNumFallback(t2v1) + parseNumFallback(t2v2);
              t2_t2Max += 10; t2_t2Valid = true;
            }
            if (isValidMark(t3v1) || isValidMark(t3v2)) {
              t2_t3Earned += parseNumFallback(t3v1) + parseNumFallback(t3v2);
              t2_t3Max += 10; t2_t3Valid = true;
            }
          });

          // Complete Annual calculations
          const t1_annMax = t1_t1Max + t1_t2Max + t1_t3Max;
          const t1_annEarned = t1_t1Earned + t1_t2Earned + t1_t3Earned;
          const t2_annMax = t2_t1Max + t2_t2Max + t2_t3Max;
          const t2_annEarned = t2_t1Earned + t2_t2Earned + t2_t3Earned;

          return {
            id: student.id,
            t1: {
              t1: { earned: t1_t1Earned, max: t1_t1Max, pct: t1_t1Max > 0 ? (t1_t1Earned / t1_t1Max) * 100 : 0, valid: t1_t1Valid },
              t2: { earned: t1_t2Earned, max: t1_t2Max, pct: t1_t2Max > 0 ? (t1_t2Earned / t1_t2Max) * 100 : 0, valid: t1_t2Valid },
              t3: { earned: t1_t3Earned, max: t1_t3Max, pct: t1_t3Max > 0 ? (t1_t3Earned / t1_t3Max) * 100 : 0, valid: t1_t3Valid },
              annual: { earned: t1_annEarned, max: t1_annMax, pct: t1_annMax > 0 ? (t1_annEarned / t1_annMax) * 100 : 0 }
            },
            t2: {
              t1: { earned: t2_t1Earned, max: t2_t1Max, pct: t2_t1Max > 0 ? (t2_t1Earned / t2_t1Max) * 100 : 0, valid: t2_t1Valid },
              t2: { earned: t2_t2Earned, max: t2_t2Max, pct: t2_t2Max > 0 ? (t2_t2Earned / t2_t2Max) * 100 : 0, valid: t2_t2Valid },
              t3: { earned: t2_t3Earned, max: t2_t3Max, pct: t2_t3Max > 0 ? (t2_t3Earned / t2_t3Max) * 100 : 0, valid: t2_t3Valid },
              annual: { earned: t2_annEarned, max: t2_annMax, pct: t2_annMax > 0 ? (t2_annEarned / t2_annMax) * 100 : 0 }
            }
          };
        });

        // Compute Multi-Term Ranking Indexes
        const alphabetSort = classFiltered.map(s => {
          const metrics = computedMetrics.find(m => m.id === s.id)!;

          const getRank = (tableKey: "t1" | "t2", termKey: "t1" | "t2" | "t3" | "annual") => {
            const list = [...computedMetrics].sort((a, b) => b[tableKey][termKey].pct - a[tableKey][termKey].pct);
            return list.findIndex(x => x.id === s.id) + 1;
          };

          return {
            ...s,
            metrics,
            ranks: {
              t1: { t1: getRank("t1", "t1"), t2: getRank("t1", "t2"), t3: getRank("t1", "t3"), annual: getRank("t1", "annual") },
              t2: { t1: getRank("t2", "t1"), t2: getRank("t2", "t2"), t3: getRank("t2", "t3"), annual: getRank("t2", "annual") }
            }
          };
        }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setStudents(alphabetSort);
      } catch (err) {
        console.error("Critical System Data Build Interrupted:", err);
      }
      setLoading(false);
    };

    fetchAnnualData();
  }, [activeClass]);

  if (loading) return <div className="p-12 text-center font-black tracking-widest text-blue-900 text-xs uppercase">Assembling Comprehensive Annual Matrix...</div>;

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
        <p className="text-gray-400 text-[10px] mb-3">Term totals, percentages, and metrics completely populated.</p>
        <button onClick={() => window.print()} className="bg-blue-900 text-white font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider">
          Print Whole Class Register 🖨️
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center text-gray-400 uppercase py-10">No registered students located inside class stream {activeClass}</div>
      ) : (
        students.map((student) => {
          const studentMarks = allMarks[student.id] || {};
          const m = student.metrics;

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
                    
                    {/* TABLE 1 TOTAL GENERAL ROW */}
                    <tr className="bg-blue-50/70 font-black border-t-2 border-black text-blue-950">
                      <td className="text-left pl-2 uppercase">TOTAL GENERAL</td>
                      <td colSpan={3} className="bg-gray-100 text-center">-</td>
                      <td colSpan={3} className="font-serif text-center">{m.t1.t1.valid ? `${m.t1.t1.earned} / ${m.t1.t1.max}` : "-"}</td>
                      <td colSpan={3} className="font-serif text-center">{m.t1.t2.valid ? `${m.t1.t2.earned} / ${m.t1.t2.max}` : "-"}</td>
                      <td colSpan={3} className="font-serif text-center">{m.t1.t3.valid ? `${m.t1.t3.earned} / ${m.t1.t3.max}` : "-"}</td>
                      <td className="bg-gray-100 font-serif">{m.t1.annual.max}</td>
                      <td className="text-blue-900 font-serif text-[12px]">{m.t1.annual.earned}</td>
                      <td className="text-green-800 font-serif text-[12px]">{m.t1.annual.pct.toFixed(1)}%</td>
                    </tr>

                    {/* TABLE 1 PERCENTAGE ROW */}
                    <tr className="bg-gray-50 font-black">
                      <td className="text-left pl-2 uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-green-800 font-serif text-center">{m.t1.t1.valid ? `${m.t1.t1.pct.toFixed(1)}%` : "..."}</td>
                      <td colSpan={3} className="text-green-800 font-serif text-center">{m.t1.t2.valid ? `${m.t1.t2.pct.toFixed(1)}%` : "..."}</td>
                      <td colSpan={3} className="text-green-800 font-serif text-center">{m.t1.t3.valid ? `${m.t1.t3.pct.toFixed(1)}%` : "..."}</td>
                      <td colSpan={3} className="text-green-800 font-serif text-center text-[12px]">{m.t1.annual.pct.toFixed(1)}%</td>
                    </tr>

                    {/* TABLE 1 RANK ROW */}
                    <tr className="font-black border-b-2 border-black">
                      <td className="text-left pl-2 uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center text-amber-900 font-serif">{m.t1.t1.valid ? `${student.ranks.t1.t1} SUR ${students.length}` : "..."}</td>
                      <td colSpan={3} className="text-center text-amber-900 font-serif">{m.t1.t2.valid ? `${student.ranks.t1.t2} SUR ${students.length}` : "..."}</td>
                      <td colSpan={3} className="text-center text-amber-900 font-serif">{m.t1.t3.valid ? `${student.ranks.t1.t3} SUR ${students.length}` : "..."}</td>
                      <td colSpan={3} className="bg-green-50 text-emerald-900 font-serif text-center text-[12px] uppercase">{student.ranks.t1.annual} SUR {students.length}</td>
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
                      const t2_tot = t2_mid !== "-" || t2_ex !== "-" ? parseNumFallback(t2_mid) + parseNumFallback(t2_ex) : "-";

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

                    {/* TABLE 2 TOTAL GENERAL ROW */}
                    <tr className="bg-blue-900 text-white font-black text-[11px] border-t-4 border-black">
                      <td className="text-left pl-2 uppercase">TOTAL GENERAL</td>
                      <td>-</td>
                      <td>-</td>
                      <td className="bg-blue-950">-</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center font-serif">{m.t2.t1.valid ? `${m.t2.t1.earned} / ${m.t2.t1.max}` : "-"}</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center font-serif">{m.t2.t2.valid ? `${m.t2.t2.earned} / ${m.t2.t2.max}` : "-"}</td>
                      <td colSpan={3} className="bg-blue-950/40 text-center font-serif">{m.t2.t3.valid ? `${m.t2.t3.earned} / ${m.t2.t3.max}` : "-"}</td>
                      <td className="bg-blue-950 font-serif">{m.t2.annual.max}</td>
                      <td className="text-white font-serif">{m.t2.annual.earned}</td>
                      <td className="text-white font-serif">{m.t2.annual.pct.toFixed(1)}%</td>
                    </tr>

                    {/* TABLE 2 PERCENTAGE ROW */}
                    <tr className="font-black bg-gray-50">
                      <td className="text-left pl-2 uppercase">POURCENTAGE</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center font-serif text-blue-900">{m.t2.t1.valid ? `${m.t2.t1.pct.toFixed(1)}%` : "....................%"}</td>
                      <td colSpan={3} className="text-center font-serif text-blue-900">{m.t2.t2.valid ? `${m.t2.t2.pct.toFixed(1)}%` : "....................%"}</td>
                      <td colSpan={3} className="text-center font-serif text-blue-900">{m.t2.t3.valid ? `${m.t2.t3.pct.toFixed(1)}%` : "....................%"}</td>
                      <td colSpan={3} className="text-blue-950 font-serif text-center text-[12px]">{m.t2.annual.pct.toFixed(1)}%</td>
                    </tr>

                    {/* TABLE 2 RANK ROW */}
                    <tr className="font-black bg-gray-50 border-b-4 border-black">
                      <td className="text-left pl-2 uppercase">PLACE / RANK</td>
                      <td colSpan={3} className="text-center">-</td>
                      <td colSpan={3} className="text-center text-gray-900 font-serif">{m.t2.t1.valid ? `${student.ranks.t2.t1} SUR ${students.length}` : "....................Sur"}</td>
                      <td colSpan={3} className="text-center text-gray-900 font-serif">{m.t2.t2.valid ? `${student.ranks.t2.t2} SUR ${students.length}` : "....................Sur"}</td>
                      <td colSpan={3} className="text-center text-gray-900 font-serif">{m.t2.t3.valid ? `${student.ranks.t2.t3} SUR ${students.length}` : "....................Sur"}</td>
                      <td colSpan={3} className="bg-green-100 text-green-900 font-serif text-center text-[12px] uppercase">{student.ranks.t2.annual} SUR {students.length}</td>
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