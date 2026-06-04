"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase"; 
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

interface MarkData {
  [key: string]: any;
}

interface Student {
  id: string;
  name: string;
  className: string;
}

export default function ReportCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<{ [studentId: string]: { [subject: string]: MarkData } }>({});
  const [selectedClass, setSelectedClass] = useState<string>("P4");
  const [selectedTerm, setSelectedTerm] = useState<string>("term1");
  const [loading, setLoading] = useState<boolean>(true);

  const coreSubjects = ["Mathematics", "English", "Science", "Social Studies", "Kinyarwanda"];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const studentSnap = await getDocs(collection(db, "students"));
        const studentList: Student[] = [];
        studentSnap.forEach((doc) => {
          const data = doc.data();
          if (data.className === selectedClass) {
            studentList.push({ id: doc.id, name: data.name, className: data.className });
          }
        });
        setStudents(studentList);

        const marksMatrix: { [studentId: string]: { [subject: string]: MarkData } } = {};
        for (const student of studentList) {
          marksMatrix[student.id] = {};
          const allSubjects = [...coreSubjects, "French", "Creative Arts", "Physical Education"];
          
          for (const subject of allSubjects) {
            const markDocRef = doc(db, "students", student.id, "marks", subject);
            const markDocSnap = await getDoc(markDocRef);
            marksMatrix[student.id][subject] = markDocSnap.exists() ? markDocSnap.data() : {};
          }
        }
        setMarks(marksMatrix);
      } catch (error) {
        console.error("Error loading marks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedClass, selectedTerm]);

  if (loading) {
    return <div className="p-8 text-center font-bold text-blue-900">Loading Report Cards...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen print:bg-white print:p-0">
      
      {/* GLOBAL CSS INJECTION FOR CLEAN PRINTING */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            clear: both !important;
          }
          /* Hide global browser headers/footers URL text */
          @page {
            size: A4 portrait;
            margin: 15mm 10mm 15mm 10mm;
          }
        }
      `}</style>

      {/* Control Panel (Hidden during printing) */}
      <div className="mb-6 p-4 bg-white rounded shadow flex gap-4 items-center print:hidden">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Select Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="border p-2 rounded text-sm bg-gray-50 font-medium">
            <option value="P1">Primary 1 (P1)</option>
            <option value="P2">Primary 2 (P2)</option>
            <option value="P3">Primary 3 (P3)</option>
            <option value="P4">Primary 4 (P4)</option>
            <option value="P5">Primary 5 (P5)</option>
            <option value="P6">Primary 6 (P6)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Active Term</label>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="border p-2 rounded text-sm bg-gray-50 font-medium">
            <option value="term1">Term 1</option>
            <option value="term2">Term 2</option>
            <option value="term3">Term 3</option>
          </select>
        </div>
        <button onClick={() => window.print()} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition-colors">
          Print All Reports
        </button>
      </div>

      {/* Report Cards Wrapper */}
      <div className="flex flex-col gap-8 items-center">
        {students.length === 0 ? (
          <div className="p-8 bg-white rounded shadow text-center text-gray-500 font-medium w-full max-w-md">
            No students found enrolled in class {selectedClass}.
          </div>
        ) : (
          students.map((student) => {
            let midTotalAcquired = 0;
            let midMaxTotal = 0;
            let examTotalAcquired = 0;
            let examMaxTotal = 0;

            const hasFrench = student.className !== "P6";

            return (
              <div key={student.id} className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-lg border border-gray-300 flex flex-col justify-between print:shadow-none print:border-none print:p-0 page-break">
                
                <div>
                  {/* Header Section */}
                  <div className="text-center border-b-2 border-blue-900 pb-3 mb-4">
                    <h1 className="text-2xl font-black text-blue-900 uppercase tracking-wide">New Generation School</h1>
                    <p className="text-xs uppercase font-bold text-gray-500 tracking-widest mt-0.5">Official Student Progress Report Card</p>
                  </div>

                  {/* Student Info Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6 bg-blue-50/50 p-3 rounded border border-blue-100 text-xs">
                    <div><span className="text-gray-500 font-medium">Student Name:</span> <strong className="text-blue-950 uppercase font-black">{student.name}</strong></div>
                    <div><span className="text-gray-500 font-medium">Class:</span> <strong className="text-blue-950">{student.className}</strong></div>
                    <div><span className="text-gray-500 font-medium">Academic Period:</span> <strong className="text-blue-950 uppercase">{selectedTerm}</strong></div>
                    <div><span className="text-gray-500 font-medium">Status:</span> <strong className="text-green-700 uppercase font-bold">Completed Evaluation</strong></div>
                  </div>

                  {/* ==================== PART 1: MID ASSESSMENT PERIOD ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b border-blue-200">PART 1: MID-TERM ASSESSMENTS</h2>
                    <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-blue-950 uppercase font-bold text-[11px]">
                          <th className="p-2 border border-gray-300 w-1/3">Subject</th>
                          <th className="p-2 border border-gray-300 text-center">Mid Assessment 1</th>
                          <th className="p-2 border border-gray-300 text-center">Mid Assessment 2</th>
                          <th className="p-2 border border-gray-300 text-center bg-gray-200">Mid-Term Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coreSubjects.map((subject) => {
                          const sMarks = marks[student.id]?.[subject] || {};
                          const m1 = Number(sMarks[`${selectedTerm}_m1`]) || 0;
                          const t2 = Number(sMarks[`${selectedTerm}_t2`]) || 0;
                          const subjectMidTotal = m1 + t2;

                          midTotalAcquired += subjectMidTotal;
                          midMaxTotal += 100;

                          return (
                            <tr key={subject} className="font-medium text-gray-800">
                              <td className="p-2 border border-gray-300 font-bold text-gray-900 uppercase">{subject}</td>
                              <td className="p-2 border border-gray-300 text-center font-mono">{m1 || "-"} / 50</td>
                              <td className="p-2 border border-gray-300 text-center font-mono">{t2 || "-"} / 50</td>
                              <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50 text-blue-900 font-mono">{subjectMidTotal} / 100</td>
                            </tr>
                          );
                        })}

                        {hasFrench && (() => {
                          const sMarks = marks[student.id]?.["French"] || {};
                          const m1 = Number(sMarks[`${selectedTerm}_m1`]) || 0;
                          const t2 = Number(sMarks[`${selectedTerm}_t2`]) || 0;
                          const subjectMidTotal = m1 + t2;

                          midTotalAcquired += subjectMidTotal;
                          midMaxTotal += 50;

                          return (
                            <tr className="font-medium text-gray-800">
                              <td className="p-2 border border-gray-300 font-bold text-gray-900 uppercase">French</td>
                              <td className="p-2 border border-gray-300 text-center font-mono">{m1 || "-"} / 25</td>
                              <td className="p-2 border border-gray-300 text-center font-mono">{t2 || "-"} / 25</td>
                              <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50 text-blue-900 font-mono">{subjectMidTotal} / 50</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* ==================== PART 2: FINAL EXAMINATION PERIOD ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b border-blue-200">PART 2: END OF TERM EXAMINATIONS</h2>
                    <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-blue-950 uppercase font-bold text-[11px]">
                          <th className="p-2 border border-gray-300 w-1/3">Subject</th>
                          <th className="p-2 border border-gray-300 text-center">Exam Score</th>
                          <th className="p-2 border border-gray-300 text-center bg-gray-200">Maximum Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coreSubjects.map((subject) => {
                          const sMarks = marks[student.id]?.[subject] || {};
                          const exam = Number(sMarks[`${selectedTerm}_exam`]) || 0;

                          examTotalAcquired += exam;
                          examMaxTotal += 50;

                          return (
                            <tr key={subject} className="font-medium text-gray-800">
                              <td className="p-2 border border-gray-300 font-bold text-gray-900 uppercase">{subject}</td>
                              <td className="p-2 border border-gray-300 text-center font-bold text-blue-900 font-mono">{exam || "-"}</td>
                              <td className="p-2 border border-gray-300 text-center font-mono text-gray-500">/ 50 Marks</td>
                            </tr>
                          );
                        })}

                        {hasFrench && (() => {
                          const sMarks = marks[student.id]?.["French"] || {};
                          const exam = Number(sMarks[`${selectedTerm}_exam`]) || 0;

                          examTotalAcquired += exam;
                          examMaxTotal += 25;

                          return (
                            <tr className="font-medium text-gray-800">
                              <td className="p-2 border border-gray-300 font-bold text-gray-900 uppercase">French</td>
                              <td className="p-2 border border-gray-300 text-center font-bold text-blue-900 font-mono">{exam || "-"}</td>
                              <td className="p-2 border border-gray-300 text-center font-mono text-gray-500">/ 25 Marks</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* ==================== PART 3: SUMMATION AND CO-CURRICULAR ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b border-blue-200">PART 3: ACADEMIC SUMMATION & TOTAL AGGREGATES</h2>
                    <div className="grid grid-cols-3 gap-4 border border-gray-300 p-3 bg-blue-950 text-white rounded mb-4">
                      <div className="text-center border-r border-blue-800/60">
                        <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Mid Summaries</p>
                        <p className="text-base font-black font-mono mt-0.5">{midTotalAcquired} / {midMaxTotal}</p>
                      </div>
                      <div className="text-center border-r border-blue-800/60">
                        <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Exam Summaries</p>
                        <p className="text-base font-black font-mono mt-0.5">{examTotalAcquired} / {examMaxTotal}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-wider text-yellow-300 font-bold">Final Term Grade</p>
                        <p className="text-base font-black font-mono text-yellow-400 mt-0.5">
                          {midTotalAcquired + examTotalAcquired} / {midMaxTotal + examMaxTotal}
                        </p>
                      </div>
                    </div>

                    {/* Co-Curricular Tracking block */}
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-950 mb-2">⚡ Co-Curricular Activities</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs font-medium text-gray-700">
                        <div className="p-2 bg-white rounded border border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900 uppercase text-[11px]">Creative Arts & Expression</span>
                          <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-blue-900">
                            {marks[student.id]?.["Creative Arts"]?.[`${selectedTerm}_exam`] || "-"} / 50
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900 uppercase text-[11px]">Physical Education & Sports</span>
                          <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-blue-900">
                            {marks[student.id]?.["Physical Education"]?.[`${selectedTerm}_exam`] || "-"} / 50
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Clean Signature System (No underlines anywhere) */}
                <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-2 gap-12 text-center text-xs">
                  <div>
                    <div className="h-8 flex items-end justify-center pb-1 text-sm uppercase text-blue-950 font-black tracking-wide" />
                    <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-500 uppercase tracking-widest text-[9px]">
                      Class Teacher Signature
                    </div>
                  </div>
                  <div>
                    <div className="h-8 flex items-end justify-center pb-1 text-sm uppercase text-blue-950 font-black tracking-wide">
                      School Administration
                    </div>
                    <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-500 uppercase tracking-widest text-[9px]">
                      Head Teacher Stamp & Sign
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}