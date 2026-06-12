"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Student {
  id: string;
  names: string;
}

interface AssessmentConfig {
  academicYear: string;
  term: string;
  midTermWeight: number;
  examWeight: number;
  classTeacherOf?: string;
  streamTeacherOf?: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user?.uid) return;
      try {
        // 1. Fetch Teacher Document
        const teacherDoc = await getDoc(doc(db, "teachers", user.uid));
        if (teacherDoc.exists()) {
          const tData = teacherDoc.data();
          setTeacherData(tData);
          if (tData.classes && tData.classes.length > 0) {
            setClasses(tData.classes);
            setSelectedClass(tData.classes[0]);
          }
        }

        // 2. Fetch Active Assessment Configuration
        const configDoc = await getDoc(doc(db, "settings", "assessment"));
        if (configDoc.exists()) {
          setConfig(configDoc.data() as AssessmentConfig);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.uid]);

  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClass) {
        setStudents([]);
        return;
      }
      try {
        const q = query(
          collection(db, "students"),
          where("classAndStream", "==", selectedClass),
          where("status", "==", "ACTIVE")
        );
        const querySnapshot = await getDocs(q);
        const list: Student[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, names: data.names });
        });
        // Sort alphabetically by student names
        list.sort((a, b) => a.names.localeCompare(b.names));
        setStudents(list);
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    }
    fetchStudents();
  }, [selectedClass]);

  if (loading) return <LoadingSpinner />;

  // Validation Check: Is this teacher the official class teacher for the selected stream?
  const isClassTeacher = config?.classTeacherOf === selectedClass;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Teacher Dashboard
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Welcome back, {teacherData?.names || "Teacher"}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-sm border border-white/10">
          <span className="font-semibold text-blue-200">Active Term:</span>{" "}
          {config?.academicYear} — {config?.term}
        </div>
      </div>

      {/* Main Configuration Controls Panel */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            Select Class & Stream:
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons Container */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Marks Entry Actions */}
          <Link
            href={`/marks-entry/midterm?classStream=${encodeURIComponent(selectedClass)}`}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            ENTER MID MARKS
          </Link>
          <Link
            href={`/marks-entry/examination?classStream=${encodeURIComponent(selectedClass)}`}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            ENTER EXAM MARKS
          </Link>

          {/* Co-Curricular & Behaviour Entries */}
          <Link
            href={`/marks-entry/co-curricular?classStream=${encodeURIComponent(selectedClass)}`}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            BEHAVIOUR & CO-CURRICULAR
          </Link>

          {/* Class Teacher Restricted Actions */}
          {isClassTeacher && (
            <>
              <Link
                href={`/reports/midterm?classStream=${encodeURIComponent(selectedClass)}`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                VIEW MID REPORT CARDS
              </Link>
              
              {/* NEW ANNUAL MASTER PAGE BUTTON */}
              <Link
                href={`/reports/annual?class=${encodeURIComponent(selectedClass)}`}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                VIEW ANNUAL MASTER
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Class Roster Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column: Student Roster Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-md font-bold text-slate-800">Class Roster</h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full">
              {students.length} Students Registered
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">No.</th>
                  <th className="p-4">Student Name</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400 font-medium">
                      No active students found in this class stream.
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 text-center font-semibold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {student.names}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/students/${student.id}`}
                            className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Mini Guidelines Context Card */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase text-slate-400">
              Teacher Assignment Info
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Assigned Classes</span>
                <span className="font-bold text-slate-800">{classes.join(", ") || "None"}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Class Teacher Stream</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {config?.classTeacherOf || "None Assigned"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}