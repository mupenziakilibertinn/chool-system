"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const schoolSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "French"];

export default function ReportsPage() {
  const [teacherProfile, setTeacherProfile] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState("P6");
  const [classTeacherName, setClassTeacherName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>([]);
  const [loading, setLoading] = useState(true);

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
      // Find Class Master Instructor name row entry
      const tSnap = await getDocs(query(collection(db, "teachers"), where("classTeacherOf", "==", selectedClass)));
      setClassTeacherName(!tSnap.empty ? tSnap.docs[0].data().name : "TR. MUPENZI");

      // Pull students assigned to selected stream
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const studentSnap = await getDocs(q);
      const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(studentList);

      // Collect complete nested mark schemas across all evaluation sub-collections
      let marksData: any = {};
      await Promise.all(studentList.map(async (student) => {
        marksData[student.id] = {};
        const marksSnap = await getDocs(collection(db, "students", student.id, "marks"));
        marksSnap.forEach((docSnap) => {
          marksData[student.id][docSnap.id] = docSnap.data();
        });
      }));
      setAllMarks(marksData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center p-10 font-bold uppercase text-blue-900">Compiling Micro-ledger reports profile...</div>;
  if (!teacherProfile) return <div className="text-center p-10 text-red-500 font-bold uppercase">ACCESS DENIED.</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 text-xs pb-20">
      <div className="max-w-4xl mx-auto no-print bg-white p-6 rounded-2xl shadow-sm border mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-base font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
          <p className="text-[9px] text-gray-400 uppercase font-black mt-0.5">Report Booklet Hub Dashboard</p>
        </div>
        {teacherProfile.isAdmin ? (
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 text-xs">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span className="font-black border p-2 rounded bg-gray-100 text-blue-950 uppercase">Class: {selectedClass}</span>
        )}
      </div>

      <div className="max-w-4xl mx-auto no-print mb-6">
        <button onClick={() => window.print()} className="w-full bg-blue-900 text-white font-black py-4 rounded-xl uppercase tracking-wider shadow-md hover:bg-black transition-colors text-xs">
          Print All Active Class Report Cards ({students.length} Books)
        </button>
      </div>

      {/* Printable Cards Loop */}
      <div className="space-y-12">
        {students.map(student => {
          let grandTotalEarned = 0;
          let grandTotalPossible = 0;

          return (
            <div key={student.id} className="page-break p-8 bg-white max-w-[210mm] mx-auto min-h-[297mm] border-[6px] border-double border-blue-900 font-sans shadow-sm">
              <h1 className="text-center text-2xl font-black text-blue-900 uppercase tracking-wide">NEW GENERATION SCHOOL</h1>
              <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5 mb-6">Student Academic Progress Report Book</p>
              
              <div className="flex justify-between border-b-2 pb-2 mb-4 font-black uppercase text-[10px] text-gray-800">
                <span>Pupil Name: {student.name}</span>
                <span>Class Level: {selectedClass}</span>
              </div>

              <table className="w-full border-collapse border-2 border-black text-[10px] font-bold text-center">
                <thead className="bg-gray-50 font-black uppercase text-[8px]">
                  <tr>
                    <th className="border-2 border-black p-2 text-left" rowSpan={2}>Subject Discipline</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 1</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 2</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 3</th>
                    <th className="border-2 border-black p-2 bg-gray-100" rowSpan={2}>ANNUAL SUM</th>
                  </tr>
                  <tr>
                    <th className="border border-black p-1">Test</th>
                    <th className="border border-black p-1">Mid</th>
                    <th className="border border-black p-1">Test</th>
                    <th className="border border-black p-1">Mid</th>
                    <th className="border border-black p-1">Test</th>
                    <th className="border border-black p-1">Mid</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolSubjects.map(sub => {
                    if (selectedClass === "P6" && sub === "French") return null;

                    const m = allMarks[student.id]?.[sub] || {};
                    const maxWeight = sub === "French" ? 50 : 100;

                    const t1_t = Number(m.term1_t1 || 0); const t1_m = Number(m.term1_m1 || 0);
                    const t2_t = Number(m.term2_t1 || 0); const t2_m = Number(m.term2_m1 || 0);
                    const t3_t = Number(m.term3_t1 || 0); const t3_m = Number(m.term3_m1 || 0);

                    const sumT1 = t1_t + t1_m;
                    const sumT2 = t2_t + t2_m;
                    const sumT3 = t3_t + t3_m;
                    const subjectAnnualSum = sumT1 + sumT2 + sumT3;
                    const subjectAnnualMax = maxWeight * 3;

                    grandTotalEarned += subjectAnnualSum;
                    grandTotalPossible += subjectAnnualMax;

                    return (
                      <tr key={sub} className="uppercase border-b border-black">
                        <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                        <td className="border border-black p-1">{t1_t}</td>
                        <td className="border border-black p-1 border-r-2">{t1_m}</td>
                        <td className="border border-black p-1">{t2_t}</td>
                        <td className="border border-black p-1 border-r-2">{t2_m}</td>
                        <td className="border border-black p-1">{t3_t}</td>
                        <td className="border border-black p-1 border-r-2">{t3_m}</td>
                        <td className="border-2 border-black p-2 bg-gray-50 font-black text-blue-950">
                          {subjectAnnualSum} / {subjectAnnualMax}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-900 text-white font-black uppercase">
                    <td colSpan={7} className="border-2 border-black p-2.5 text-right text-[10px]">Cumulative Annual Average</td>
                    <td className="border-2 border-black p-2.5 text-center bg-green-700 text-xs">
                      {grandTotalPossible > 0 ? ((grandTotalEarned / grandTotalPossible) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-8 p-4 border-2 border-dashed border-blue-900 rounded-xl bg-gray-50 flex justify-between items-center font-bold">
                <div>
                  <span className="font-black underline text-blue-900 uppercase tracking-wider block mb-1">Watermark: NEW GENERATION SCHOOL</span>
                  {grandTotalPossible > 0 && ((grandTotalEarned / grandTotalPossible) * 100) >= 50 
                    ? "Passed evaluation parameters. Promoted successfully to subsequent academic level." 
                    : "Requires targeted learning reinforcement and close structural review."}
                </div>
                <div className="text-right border-l-2 pl-4 border-gray-300">
                  <span className="text-[8px] uppercase text-gray-400 block font-black mb-1">Prepared By:</span>
                  <span className="font-black uppercase text-blue-950 text-xs tracking-wide">Tr. MUPENZI</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}