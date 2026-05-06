"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { schoolSubjects, calculateAverages, getStudentComment } from "../../lib/marksLogic";

export default function ReportsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("P5");
  const [allMarks, setAllMarks] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const snap = await getDocs(q);
      const studentList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const marksData: any = {};
      for (const student of studentList) {
        const studentMarks: any = {};
        for (const sub of schoolSubjects) {
          const mSnap = await getDoc(doc(db, "students", student.id, "marks", sub.name));
          if (mSnap.exists()) studentMarks[sub.name] = mSnap.data();
        }
        marksData[student.id] = studentMarks;
      }
      setStudents(studentList);
      setAllMarks(marksData);
      setLoading(false);
    };
    loadData();
  }, [selectedClass]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0">
      <div className="max-w-4xl mx-auto mb-6 no-print bg-white p-6 rounded-xl shadow-lg flex gap-4 items-center">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-3 border-2 border-blue-900 rounded-lg font-bold outline-none">
          {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => window.print()} className="bg-blue-900 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest hover:bg-green-700 transition">Print All Reports</button>
      </div>

      {students.map((student) => {
        let grandTotal = 0;
        let subCount = 0;

        return (
          <div key={student.id} className="bg-white w-[210mm] mx-auto p-12 border-[10px] border-double border-blue-900 shadow-2xl mb-20 page-break relative">
            <div className="text-center border-b-4 border-green-600 pb-4 mb-6">
              <h1 className="text-4xl font-black text-blue-900 uppercase">New Generation School</h1>
              <p className="text-green-700 font-bold italic text-sm">Preparation, Praying, Politeness and Performance</p>
              <div className="mt-4 bg-blue-900 text-white py-1 font-black uppercase text-sm tracking-widest">Student Progress Report</div>
            </div>

            <div className="flex justify-between font-black text-blue-900 mb-8 uppercase text-xs">
              <p>Name: <span className="border-b border-black">{student.name}</span></p>
              <p>Class: {student.class}</p>
              <p>Term: Annual / 2026</p>
            </div>

            <table className="w-full border-collapse border-2 border-black">
              <thead>
                <tr className="bg-gray-100 font-black text-[10px] uppercase">
                  <th className="border border-black p-2 text-left">Subject</th>
                  <th className="border border-black p-2">T1 (/50)</th>
                  <th className="border border-black p-2">M1 (/50)</th>
                  <th className="border border-black p-2">T2 (/50)</th>
                  <th className="border border-black p-2">M2 (/50)</th>
                  <th className="border border-black p-2">Avg (/100)</th>
                </tr>
              </thead>
              <tbody className="font-bold text-xs uppercase">
                {schoolSubjects.map((sub) => {
                  const m = allMarks[student.id]?.[sub.name] || { t1: 0, m1: 0, t2: 0, m2: 0 };
                  const avgs = calculateAverages(m.t1, m.m1, m.t2, m.m2);
                  grandTotal += avgs.annualAvg;
                  subCount++;
                  return (
                    <tr key={sub.id}>
                      <td className="border border-black p-2 bg-gray-50">{sub.name}</td>
                      <td className="border border-black p-2 text-center">{m.t1}</td>
                      <td className="border border-black p-2 text-center">{m.m1}</td>
                      <td className="border border-black p-2 text-center">{m.t2}</td>
                      <td className="border border-black p-2 text-center">{m.m2}</td>
                      <td className="border border-black p-2 text-center bg-blue-50">{(avgs.annualAvg).toFixed(1)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-900 text-white font-black">
                  <td colSpan={5} className="border border-black p-2 text-right">PERCENTAGE AVERAGE</td>
                  <td className="border border-black p-2 text-center">{(grandTotal / subCount).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-8 p-4 border-2 border-blue-50 rounded-xl italic text-blue-900 text-sm">
              <span className="font-black not-italic uppercase">Remarks:</span> {getStudentComment(grandTotal / subCount)}
            </div>

            <div className="mt-20 flex justify-between items-end">
              <div className="text-center"><div className="border-b border-black w-40 mb-1"></div><p className="text-[10px] font-black">CLASS TEACHER</p></div>
              <div className="w-24 h-24 rounded-full border-4 border-blue-50 flex items-center justify-center text-[8px] text-blue-200 font-black uppercase text-center rotate-12">School Stamp</div>
              <div className="text-center"><div className="border-b border-black w-40 mb-1"></div><p className="text-[10px] font-black">HEADTEACHER</p></div>
            </div>
          </div>
        );
      })}

      <style jsx global>{`
        @media print { .no-print { display: none; } .page-break { page-break-after: always; } }
      `}</style>
    </div>
  );
}