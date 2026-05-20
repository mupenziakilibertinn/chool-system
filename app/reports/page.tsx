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
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const docSnap = await getDocs(query(collection(db, "teachers"), where("email", "==", user.email.toLowerCase())));
        if (!docSnap.empty) {
          const profile = docSnap.docs[0].data();
          setTeacherProfile(profile);
          if (!profile.isAdmin) {
            setSelectedClass(profile.classTeacherOf || "None");
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedClass !== "None") {
      fetchClassAndTeacherData();
    }
  }, [selectedClass]);

  const fetchClassAndTeacherData = async () => {
    setLoading(true);
    try {
      const tSnap = await getDocs(query(collection(db, "teachers"), where("classTeacherOf", "==", selectedClass)));
      setClassTeacherName(!tSnap.empty ? tSnap.docs[0].data().name : "UNASSIGNED");

      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const studentSnap = await getDocs(q);
      const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(studentList);

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

  if (loading) return <div className="text-center p-10 font-bold uppercase">Processing Cloud Analytics Ledger...</div>;
  if (!teacherProfile || (!teacherProfile.isAdmin && selectedClass === "None")) {
    return <div className="text-center p-10 text-red-500 font-bold uppercase">ACCESS RESTRICTED.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 text-xs pb-20">
      <div className="max-w-5xl mx-auto no-print">
        <div className="bg-white p-6 rounded-2xl shadow-sm border mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-blue-900 uppercase tracking-wider italic">NEW GENERATION SCHOOL</h1>
            <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">Comprehensive Annual Ledger Hub</p>
          </div>
          {teacherProfile.isAdmin ? (
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 outline-none">
              {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <span className="font-black border p-2 rounded bg-gray-100 text-blue-950">Class: {selectedClass}</span>
          )}
        </div>

        <button onClick={() => window.print()} className="w-full bg-blue-900 text-white font-black py-4 rounded-xl uppercase tracking-wider shadow-md mb-6">
          Print Complete Class Cards ({students.length} Books)
        </button>

        <div className="space-y-4">
          {students.map(student => (
            <div key={student.id} className="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
              <span className="font-black text-sm text-blue-900 uppercase block">{student.name}</span>
              <button onClick={() => {
                const printContent = document.getElementById(`card-${student.id}`)?.innerHTML;
                if (printContent) {
                  const orig = document.body.innerHTML;
                  document.body.innerHTML = printContent;
                  window.print();
                  document.body.innerHTML = orig;
                  window.location.reload();
                }
              }} className="bg-gray-100 text-blue-900 px-4 py-2 rounded-lg font-black uppercase text-[10px]">
                Print Book Card
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="report-only">
        {students.map(student => {
          let grandTotalEarned = 0;
          let grandTotalPossible = 0;

          return (
            <div key={student.id} id={`card-${student.id}`} className="page-break p-10 bg-white max-w-[210mm] mx-auto min-h-[297mm] border-[8px] border-double border-blue-900 font-sans mb-10">
              <h1 className="text-center text-3xl font-black text-blue-900 uppercase tracking-wide">New Generation School</h1>
              <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5 mb-6">Student Academic Progress Booklet</p>
              
              <div className="flex justify-between border-b-2 pb-2 mb-6 font-black uppercase text-[11px] text-gray-800">
                <span>Pupil: {student.name}</span>
                <span>Level: {selectedClass}</span>
              </div>

              <table className="w-full border-collapse border-2 border-black text-[11px] font-bold">
                <thead className="bg-gray-100 font-black uppercase text-[9px] text-center">
                  <tr>
                    <th className="border-2 border-black p-2 text-left" rowSpan={2}>Subject</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 1</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 2</th>
                    <th className="border-2 border-black p-2" colSpan={2}>TERM 3</th>
                    <th className="border-2 border-black p-2 bg-gray-200" rowSpan={2}>ANNUAL TOTAL</th>
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

                    // Fetch scores for all terms cleanly
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
                      <tr key={sub} className="uppercase text-center">
                        <td className="border-2 border-black p-2 text-left font-black text-blue-900">{sub}</td>
                        <td className="border p-1">{t1_t}</td><td className="border p-1 border-r-2 border-black">{t1_m}</td>
                        <td className="border p-1">{t2_t}</td><td className="border p-1 border-r-2 border-black">{t2_m}</td>
                        <td className="border p-1">{t3_t}</td><td className="border p-1 border-r-2 border-black">{t3_m}</td>
                        <td className="border-2 border-black p-2 bg-gray-50 font-black text-blue-950">
                          {subjectAnnualSum} /{subjectAnnualMax}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-950 text-white font-black uppercase text-xs">
                    <td colSpan={7} className="border-2 border-black p-3 text-right">Cumulative Annual Average</td>
                    <td className="border-2 border-black p-3 text-center text-sm bg-green-700">
                      {grandTotalPossible > 0 ? ((grandTotalEarned / grandTotalPossible) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-12 p-4 border-2 border-dashed border-blue-900 rounded-xl bg-gray-50 text-xs font-bold text-gray-700 flex justify-between items-center">
                <div>
                  <span className="font-black underline text-blue-900 uppercase tracking-wider block mb-1">Watermark: NEW GENERATION SCHOOL</span>
                  {grandTotalPossible > 0 && ((grandTotalEarned / grandTotalPossible) * 100) >= 50 
                    ? "Passed evaluation parameters. Promoted successfully to subsequent academic stream." 
                    : "Requires intentional instructional interventions and focused academic reinforcement."}
                </div>
                <div className="text-right border-l-2 pl-4 border-gray-300">
                  <span className="text-[9px] uppercase text-gray-400 block font-bold">Class Instructor Signature</span>
                  <span className="font-black uppercase text-blue-950 text-xs tracking-wide">{classTeacherName}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}