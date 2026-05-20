"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

const schoolSubjects = ["Mathematics", "Kinyarwanda", "English", "SET", "SRE", "Social Studies", "French"];

export default function ReportsPage() {
  const [selectedClass, setSelectedClass] = useState("P5");
  const [students, setStudents] = useState<any[]>([]);
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClassData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "students"), where("class", "==", selectedClass));
        const studentSnap = await getDocs(q);
        const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
        setStudents(studentList);

        // Fast parallel fetch setup for student subcollections
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
        console.error("Error collecting terminal records:", err);
      }
      setLoading(false);
    };
    fetchClassData();
  }, [selectedClass]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 text-xs pb-20">
      <div className="max-w-5xl mx-auto no-print">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-blue-900 uppercase tracking-wider italic">NEW GENERATION SCHOOL</h1>
            <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">Bulk Progress Report Ledger</p>
          </div>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-2 border-2 border-blue-900 bg-white rounded-xl font-black text-blue-900 outline-none">
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-10 font-black text-blue-900 uppercase tracking-widest animate-pulse">Compiling class analytics...</div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => window.print()} className="w-full bg-blue-900 text-white font-black py-4 rounded-xl uppercase tracking-wider shadow-md hover:bg-black transition-all">
              Print Entire Class Ledger ({students.length} Cards)
            </button>

            {students.map(student => (
              <div key={student.id} className="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
                <div>
                  <span className="font-black text-sm text-blue-900 uppercase block">{student.name}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Level Track: {selectedClass}</span>
                </div>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById(`card-${student.id}`)?.innerHTML;
                    if (printContent) {
                      const originalHTML = document.body.innerHTML;
                      document.body.innerHTML = printContent;
                      window.print();
                      document.body.innerHTML = originalHTML;
                      window.location.reload();
                    }
                  }} 
                  className="bg-gray-100 hover:bg-blue-900 hover:text-white text-blue-900 px-4 py-2 rounded-lg font-black uppercase transition-all tracking-wide text-[10px]"
                >
                  Print Card
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printing Container layout engine */}
      <div className="report-only">
        {students.map(student => {
          let aggregateScoreSum = 0;
          let evaluatedCoursesCount = 0;

          return (
            <div key={student.id} id={`card-${student.id}`} className="page-break p-12 bg-white max-w-[210mm] mx-auto min-h-[297mm] border-[8px] border-double border-blue-900 font-sans mb-10">
              <h1 className="text-center text-3xl font-black text-blue-900 uppercase tracking-wide border-b-4 border-green-600 pb-2">New Generation School</h1>
              <p className="text-center text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-1 mb-6">Student Terminal Progress Record</p>
              
              <div className="flex justify-between border-b-2 pb-2 mb-6 font-black uppercase text-[11px] text-gray-800">
                <span>Pupil: {student.name}</span>
                <span>Level: {selectedClass}</span>
              </div>

              <table className="w-full border-collapse border-2 border-black text-xs font-bold">
                <thead className="bg-gray-100 font-black uppercase text-[10px] tracking-wider text-center">
                  <tr>
                    <th className="border-2 border-black p-3 text-left w-1/2">Academic Courses</th>
                    <th className="border-2 border-black p-3 w-1/2">Term Evaluation Score</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolSubjects.map(sub => {
                    const m = allMarks[student.id]?.[sub] || { t1: 0, m1: 0, t2: 0, m2: 0, exam: 0 };
                    const finalAvg = (Number(m.t1 || 0) + Number(m.m1 || 0) + Number(m.t2 || 0) + Number(m.m2 || 0) + (Number(m.exam || 0) * 2)) / 6;
                    
                    if (finalAvg > 0) {
                      aggregateScoreSum += finalAvg;
                      evaluatedCoursesCount++;
                    }

                    return (
                      <tr key={sub} className="uppercase">
                        <td className="border-2 border-black p-3 text-left tracking-wide font-black text-blue-900">{sub}</td>
                        <td className="border-2 border-black p-3 text-center text-sm font-black">
                          {finalAvg > 0 ? finalAvg.toFixed(1) : "---"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-950 text-white font-black text-sm uppercase">
                    <td className="border-2 border-black p-3 text-right">Aggregate System Average</td>
                    <td className="border-2 border-black p-3 text-center text-base">
                      {evaluatedCoursesCount > 0 ? (aggregateScoreSum / evaluatedCoursesCount).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-12 p-4 border-2 border-dashed border-blue-900 rounded-xl bg-gray-50 text-xs italic text-gray-700">
                <span className="font-black not-italic underline text-blue-900 uppercase tracking-wider block mb-1">Prepared By Tr. MUPENZI - Watermark: NEW GENERATION SCHOOL</span>
                {evaluatedCoursesCount > 0 && (aggregateScoreSum / evaluatedCoursesCount) >= 50 
                  ? "Satisfactory progression tracking. Keep maintaining focal determination metrics." 
                  : "Requires intentional instructional interventions and focused academic reinforcement."}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}