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
  class: string; // Changed from className to class to match your DB perfectly
}

export default function ReportCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<{ [studentId: string]: { [subject: string]: MarkData } }>({});
  const [selectedClass, setSelectedClass] = useState<string>("P4");
  const [selectedTerm, setSelectedTerm] = useState<string>("term1");
  const [loading, setLoading] = useState<boolean>(true);

  // Updated to match your exact Firestore subject collection document IDs
  const coreSubjects = ["Mathematics", "English", "SET", "Social Studies", "Kinyarwanda"];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch Students matching the exact class field
        const studentSnap = await getDocs(collection(db, "students"));
        const studentList: Student[] = [];
        
        studentSnap.forEach((doc) => {
          const data = doc.data();
          // Read "class" field directly from your database
          const studentClass = (data.class || data.className || "").toUpperCase();
          if (studentClass === selectedClass.toUpperCase()) {
            studentList.push({ id: doc.id, name: data.name, class: studentClass });
          }
        });
        
        // Sort students alphabetically by name
        studentList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(studentList);

        // 2. Fetch Marks Matrix matching exact layout definitions
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
        console.error("Error loading marks matrix configuration:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedClass, selectedTerm]);

  if (loading) {
    return <div className="p-8 text-center font-bold text-blue-900 tracking-wider">Loading Report Cards...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen print:bg-white print:p-0 font-sans">
      
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
          @page {
            size: A4 portrait;
            margin: 15mm 10mm 15mm 10mm;
          }
        }
      `}</style>

      {/* Control Panel (Hidden during printing) */}
      <div className="mb-6 p-4 bg-white rounded-xl border-2 border-black shadow flex gap-4 items-center print:hidden text-xs font-black">
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Select Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value.toUpperCase())} className="border-2 border-black p-2 rounded-xl text-xs bg-gray-50 font-black uppercase">
            <option value="P1">Primary 1 (P1)</option>
            <option value="P2">Primary 2 (P2)</option>
            <option value="P3">Primary 3 (P3)</option>
            <option value="P4">Primary 4 (P4)</option>
            <option value="P5">Primary 5 (P5)</option>
            <option value="P6">Primary 6 (P6)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Active Term</label>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="border-2 border-black p-2 rounded-xl text-xs bg-gray-50 font-black">
            <option value="term1">Term 1</option>
            <option value="term2">Term 2</option>
            <option value="term3">Term 3</option>
          </select>
        </div>
        <button onClick={() => window.print()} className="ml-auto bg-blue-900 hover:bg-blue-950 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow border-2 border-black transition-colors">
          Print All Reports 📋
        </button>
      </div>

      {/* Report Cards Wrapper */}
      <div className="flex flex-col gap-8 items-center">
        {students.length === 0 ? (
          <div className="p-8 bg-white border-4 border-dashed border-red-500 rounded-xl text-center text-red-700 font-black uppercase text-xs w-full max-w-md">
            No students found enrolled in class {selectedClass}.
          </div>
        ) : (
          students.map((student) => {
            let midTotalAcquired = 0;
            let midMaxTotal = 0;
            let examTotalAcquired = 0;
            let examMaxTotal = 0;

            const hasFrench = student.class.toUpperCase() !== "P6";

            return (
              <div key={student.id} className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-lg border-4 border-black flex flex-col justify-between print:shadow-none print:border-none print:p-0 page-break">
                
                <div>
                  {/* Header Section */}
                  <div className="text-center border-b-4 border-blue-900 pb-3 mb-4">
                    <h1 className="text-2xl font-black text-blue-900 uppercase tracking-wide">New Generation School</h1>
                    <p className="text-xs uppercase font-black text-gray-400 tracking-widest mt-0.5">Official Student Progress Report Card</p>
                  </div>

                  {/* Student Info Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6 bg-blue-50/40 p-3 rounded-xl border-2 border-blue-200 text-xs font-black">
                    <div><span className="text-gray-400 uppercase text-[10px]">Student Name:</span> <br/><strong className="text-blue-950 uppercase text-sm">{student.name}</strong></div>
                    <div><span className="text-gray-400 uppercase text-[10px]">Classroom Level:</span> <br/><strong className="text-blue-950 uppercase text-sm">{student.class}</strong></div>
                    <div><span className="text-gray-400 uppercase text-[10px]">Academic Period:</span> <br/><strong className="text-blue-950 uppercase text-sm">{selectedTerm}</strong></div>
                    <div><span className="text-gray-400 uppercase text-[10px]">Evaluation Status:</span> <br/><strong className="text-green-700 uppercase text-sm">Completed</strong></div>
                  </div>

                  {/* ==================== PART 1: MID ASSESSMENT PERIOD ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b-2 border-blue-900">PART 1: MID-TERM ASSESSMENTS</h2>
                    <table className="w-full text-left border-collapse border-2 border-black text-xs font-black">
                      <thead>
                        <tr className="bg-gray-100 text-blue-950 uppercase border-b-2 border-black text-[10px] tracking-wide">
                          <th className="p-2 border border-black w-1/3">Subject</th>
                          <th className="p-2 border border-black text-center">Mid Assessment 1</th>
                          <th className="p-2 border border-black text-center">Mid Assessment 2</th>
                          <th className="p-2 border border-black text-center bg-gray-200">Mid-Term Total</th>
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
                            <tr key={subject} className="border-b border-gray-300 text-gray-800">
                              <td className="p-2 border border-black font-black text-blue-950 uppercase">{subject === "SET" ? "Science & Elem. Tech (SET)" : subject}</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-bold">{sMarks[`${selectedTerm}_m1`] !== undefined ? m1 : "-"} / 50</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-bold">{sMarks[`${selectedTerm}_t2`] !== undefined ? t2 : "-"} / 50</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-black bg-gray-50 text-blue-900">{subjectMidTotal} / 100</td>
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
                            <tr className="border-b border-black text-gray-800">
                              <td className="p-2 border border-black font-black text-blue-950 uppercase">French</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-bold">{sMarks[`${selectedTerm}_m1`] !== undefined ? m1 : "-"} / 25</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-bold">{sMarks[`${selectedTerm}_t2`] !== undefined ? t2 : "-"} / 25</td>
                              <td className="p-2 border border-black text-center font-serif text-[13px] font-black bg-gray-50 text-blue-900">{subjectMidTotal} / 50</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* ==================== PART 2: FINAL EXAMINATION PERIOD ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b-2 border-blue-900">PART 2: END OF TERM EXAMINATIONS</h2>
                    <table className="w-full text-left border-collapse border-2 border-black text-xs font-black">
                      <thead>
                        <tr className="bg-gray-100 text-blue-950 uppercase border-b-2 border-black text-[10px] tracking-wide">
                          <th className="p-2 border border-black w-1/3">Subject</th>
                          <th className="p-2 border border-black text-center">Exam Score</th>
                          <th className="p-2 border border-black text-center bg-gray-200">Maximum Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coreSubjects.map((subject) => {
                          const sMarks = marks[student.id]?.[subject] || {};
                          const exam = Number(sMarks[`${selectedTerm}_exam`]) || 0;

                          examTotalAcquired += exam;
                          examMaxTotal += 50;

                          return (
                            <tr key={subject} className="border-b border-gray-300 text-gray-800">
                              <td className="p-2 border border-black font-black text-blue-950 uppercase">{subject === "SET" ? "Science & Elem. Tech (SET)" : subject}</td>
                              <td className="p-2 border border-black text-center font-serif text-[14px] font-black text-blue-900">{sMarks[`${selectedTerm}_exam`] !== undefined ? exam : "-"}</td>
                              <td className="p-2 border border-black text-center text-gray-400">/ 50 Marks</td>
                            </tr>
                          );
                        })}

                        {hasFrench && (() => {
                          const sMarks = marks[student.id]?.["French"] || {};
                          const exam = Number(sMarks[`${selectedTerm}_exam`]) || 0;

                          examTotalAcquired += exam;
                          examMaxTotal += 25;

                          return (
                            <tr className="border-b border-black text-gray-800">
                              <td className="p-2 border border-black font-black text-blue-950 uppercase">French</td>
                              <td className="p-2 border border-black text-center font-serif text-[14px] font-black text-blue-900">{sMarks[`${selectedTerm}_exam`] !== undefined ? exam : "-"}</td>
                              <td className="p-2 border border-black text-center text-gray-400">/ 25 Marks</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* ==================== PART 3: SUMMATION AND CO-CURRICULAR ==================== */}
                  <div className="mb-6">
                    <h2 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-2 pb-1 border-b-2 border-blue-900">PART 3: ACADEMIC SUMMATION & TOTAL AGGREGATES</h2>
                    <div className="grid grid-cols-3 gap-4 border-4 border-black p-3 bg-blue-950 text-white rounded-xl mb-4 font-black">
                      <div className="text-center border-r-2 border-blue-800">
                        <p className="text-[9px] uppercase tracking-wider text-blue-300">Mid Summaries</p>
                        <p className="text-sm font-serif font-black mt-0.5">{midTotalAcquired} / {midMaxTotal}</p>
                      </div>
                      <div className="text-center border-r-2 border-blue-800">
                        <p className="text-[9px] uppercase tracking-wider text-blue-300">Exam Summaries</p>
                        <p className="text-sm font-serif font-black mt-0.5">{examTotalAcquired} / {examMaxTotal}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] uppercase tracking-wider text-yellow-300">Final Term Grade</p>
                        <p className="text-sm font-serif font-black text-yellow-400 mt-0.5">
                          {midTotalAcquired + examTotalAcquired} / {midMaxTotal + examMaxTotal}
                        </p>
                      </div>
                    </div>

                    {/* Co-Curricular Tracking block */}
                    <div className="bg-gray-50 p-3 rounded-xl border-2 border-black font-black">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-950 mb-2">⚡ Co-Curricular Activities Summary</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                        <div className="p-2 bg-white rounded-xl border border-gray-300 flex justify-between items-center">
                          <span className="text-gray-900 uppercase text-[10px]">Creative Arts & Expression</span>
                          <span className="font-serif font-black bg-purple-50 text-purple-900 px-2.5 py-0.5 border border-purple-300 rounded-lg">
                            {marks[student.id]?.["Creative Arts"]?.[`${selectedTerm}_exam`] !== undefined ? marks[student.id]?.["Creative Arts"]?.[`${selectedTerm}_exam`] : "-"} / 10
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-gray-300 flex justify-between items-center">
                          <span className="text-gray-900 uppercase text-[10px]">Physical Education & Sports</span>
                          <span className="font-serif font-black bg-orange-50 text-orange-900 px-2.5 py-0.5 border border-orange-300 rounded-lg">
                            {marks[student.id]?.["Physical Education"]?.[`${selectedTerm}_exam`] !== undefined ? marks[student.id]?.["Physical Education"]?.[`${selectedTerm}_exam`] : "-"} / 10
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Clean Signature System (No underlines at all underneath text strings) */}
                <div className="mt-6 pt-4 border-t-2 border-black grid grid-cols-2 gap-12 text-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <div>
                    <div className="h-8 flex items-end justify-center pb-1 text-xs uppercase text-blue-950 font-black" />
                    <div className="border-t border-gray-300 pt-1.5">
                      Class Teacher Signature
                    </div>
                  </div>
                  <div>
                    <div className="h-8 flex items-end justify-center pb-1 text-xs uppercase text-blue-950 font-black">
                      School Administration
                    </div>
                    <div className="border-t border-gray-300 pt-1.5">
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