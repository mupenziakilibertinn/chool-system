"use client";
import { useState } from "react";
import { calculateStandardMark } from "../../lib/marksLogic";

export default function MarksPage() {
  const [subject, setSubject] = useState("Maths");
  const [studentClass, setStudentClass] = useState("P1");

  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-green-700 border-b-4 border-blue-600 mb-6">
        Teacher Dashboard: Insert Marks
      </h1>
      
      <div className="flex gap-4 mb-6">
        <select onChange={(e) => setSubject(e.target.value)} className="border p-2 rounded">
          <option>Maths</option>
          <option>Kinyarwanda</option>
          <option>English</option>
          <option>SET</option>
          <option>SRE</option>
          <option>French</option>
        </select>
        <p className="text-gray-600 self-center">Recording for: <strong>{subject}</strong></p>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead className="bg-blue-50 text-black">
          <tr>
            <th className="border p-3 text-left">Student Name</th>
            <th className="border p-3">Raw Mark</th>
            <th className="border p-3">Done Out Of (/?)</th>
            <th className="border p-3 text-blue-700">Converted Mark</th>
          </tr>
        </thead>
        <tbody>
          {/* This part will eventually pull names from your Firebase */}
          <tr className="hover:bg-gray-50">
            <td className="border p-3">Example Student Name</td>
            <td className="border p-3 text-center">
              <input type="number" className="border w-20 p-1 rounded" placeholder="10" />
            </td>
            <td className="border p-3 text-center">
              <input type="number" className="border w-20 p-1 rounded" placeholder="12" />
            </td>
            <td className="border p-3 text-center font-bold text-green-600">---</td>
          </tr>
        </tbody>
      </table>
      
      <button className="mt-6 bg-green-700 text-white px-6 py-2 rounded font-bold hover:bg-green-800">
        SAVE MARKS
      </button>
    </div>
  );
}