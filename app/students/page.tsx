"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

export default function StudentsListPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("P5");
  const [loading, setLoading] = useState(true);

  // 1. Fetch the list of students
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "students"), where("class", "==", selectedClass));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(list);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  // 2. Delete a student (in case of mistake)
  const deleteStudent = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}?`)) {
      await deleteDoc(doc(db, "students", id));
      fetchStudents(); // Refresh the list
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border-b-8 border-blue-900">
        
        {/* Header */}
        <div className="p-8 bg-blue-900 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Student Directory</h1>
            <p className="text-blue-200 text-xs font-bold uppercase">New Generation School Management</p>
          </div>
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-white text-blue-900 p-2 rounded-lg font-black outline-none border-none"
          >
            {["P1", "P2", "P3", "P4", "P5", "P6"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Student List */}
        <div className="p-6">
          {loading ? (
            <p className="text-center py-10 font-bold text-gray-400 animate-pulse">LOADING STUDENT DATA...</p>
          ) : students.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="font-bold uppercase text-lg">No students found in {selectedClass}</p>
              <p className="text-sm">Go to Admin page to register new students.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Total Students: {students.length}</p>
              {students.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="bg-blue-100 text-blue-900 w-8 h-8 flex items-center justify-center rounded-full font-black text-xs">
                      {index + 1}
                    </span>
                    <span className="font-black text-blue-900 uppercase tracking-tight">
                      {student.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => deleteStudent(student.id, student.name)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t text-center">
            <a href="/admin" className="text-blue-900 font-black text-xs uppercase hover:underline">+ Register More Students</a>
        </div>
      </div>
    </div>
  );
}