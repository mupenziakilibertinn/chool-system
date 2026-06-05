"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, setDoc, getDoc } from "firebase/firestore";

export default function MarksPage() {
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ classes: [], classTeacherOf: "", name: "" });
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("ACADEMIC TERM 1");
  const [students, setStudents] = useState<any[]>([]);
  const [outOf, setOutOf] = useState(50);
  
  // States for live data tracking
  const [academicMarks, setAcademicMarks] = useState<Record<string, any>>({});
  const [entryMode, setEntryMode] = useState<"academic" | "cocurricular">("academic");
  const [coCurricularMarks, setCoCurricularMarks] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.email) {
        setUser(u);
        const snap = await getDoc(doc(db, "teachers", u.email.toLowerCase()));
        if (snap.exists()) {
          const d = snap.data(); 
          
          // CRITICAL FIX: Loop through root keys (0, 1, 2...) to find class/subject assignments
          const parsedAssignments: Array<{ class: string; subject: string }> = [];
          Object.keys(d).forEach((key) => {
            if (!isNaN(Number(key)) && d[key] && typeof d[key] === "object") {
              if (d[key].class && d[key].subject) {
                parsedAssignments.push({
                  class: d[key].class,
                  subject: d[key].subject
                });
              }
            }
          });

          // Fallback check if assignments are empty, try checking array fields
          if (parsedAssignments.length === 0 && Array.isArray(d.classes)) {
            d.classes.forEach((item: any) => {
              if (item && typeof item === "object" && item.class) {
                parsedAssignments.push({ class: item.class, subject: item.subject || "Kinyarwanda" });
              } else if (typeof item === "string") {
                parsedAssignments.push({ class: item, subject: "Kinyarwanda" });
              }
            });
          }

          // Build unique list of streams for the select dropdown menu
          const pureStreams = parsedAssignments.map(a => a.class);
          const uniqueStreams = [...new Set(pureStreams.filter(Boolean))];
          
          if (d.classTeacherOf && !uniqueStreams.includes(d.classTeacherOf)) {
            uniqueStreams.push(d.classTeacherOf);
          }

          setConfig({
            name: d.name || "BIZIMANA FELIX",
            classes: uniqueStreams,
            assignments: parsedAssignments,
            classTeacherOf: d.classTeacherOf || ""
          });
          
          // Set initial default selections
          const defaultClass = uniqueStreams[0] || d.classTeacherOf || "";
          setSelectedClass(defaultClass);

          const matchedAssignment = parsedAssignments.find(a => a.class === defaultClass);
          setSelectedSubject(matchedAssignment ? matchedAssignment.subject : "Kinyarwanda");
        }
      }
    });
    return () => unsub();
  }, []);

  // Auto-update the active subject text field whenever a user switches class stream items
  useEffect(() => {
    if (entryMode === "academic" && selectedClass && config.assignments) {
      const match = config.assignments.find((a: any) => a.class === selectedClass);
      if (match && match.subject) {
        setSelectedSubject(match.subject);
      }
    }
  }, [selectedClass, entryMode, config.assignments]);

  // Synchronize stream views cleanly when switching modes
  useEffect(() => {
    if (entryMode === "cocurricular" && config.classTeacherOf) {
      setSelectedClass(config.classTeacherOf);
    } else if (entryMode === "academic" && config.classes && config.classes.length > 0) {
      setSelectedClass(config.classes[0]);
    }
  }, [entryMode, config.classTeacherOf, config.classes]);

  // Core data lookup loop fetching both students and saved evaluation values
  useEffect(() => {
    if (!selectedClass) return;

    const loadData = async () => {
      try {
        const snap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        setStudents(list);

        if (entryMode === "academic") {
          if (!selectedSubject) return;
          const loadedAcademic: Record<string, any> = {};
          
          for (const s of list) {
            const mSnap = await getDoc(doc(db, "students", s.id, "marks", selectedSubject));
            if (mSnap.exists()) {
              const m = mSnap.data();
              const baseTarget = selectedClass === "P6" ? 100 : 50;
              
              const pullMark = (val: any) => {
                if (val === undefined || val === null || val === "") return "";
                return String(Math.round((Number(val) * outOf) / baseTarget));
              };

              loadedAcademic[s.id] = {
                t1: pullMark(m.t1),
                m1: pullMark(m.m1),
                t2: pullMark(m.t2),
                m2: pullMark(m.m2),
                exam: pullMark(m.exam)
              };
            } else {
              loadedAcademic[s.id] = { t1: "", m1: "", t2: "", m2: "", exam: "" };
            }
          }
          setAcademicMarks(loadedAcademic);
        } else {
          const loadedCoCurricular: Record<string, any> = {};
          for (const s of list) {
            loadedCoCurricular[s.id] = {
              sport_p1: "", sport_p2: "", sport_total: 0,
              art_p1: "", art_p2: "", art_total: 0
            };

            const sportSnap = await getDoc(doc(db, "students", s.id, "co_curricular", "sport"));
            if (sportSnap.exists()) {
              const data = sportSnap.data();
              loadedCoCurricular[s.id].sport_p1 = data.p1 !== undefined ? String(data.p1) : "";
              loadedCoCurricular[s.id].sport_p2 = data.p2 !== undefined ? String(data.p2) : "";
              loadedCoCurricular[s.id].sport_total = Number(data.p1 || 0) + Number(data.p2 || 0);
            }

            const artSnap = await getDoc(doc(db, "students", s.id, "co_curricular", "creative_art"));
            if (artSnap.exists()) {
              const data = artSnap.data();
              loadedCoCurricular[s.id].art_p1 = data.p1 !== undefined ? String(data.p1) : "";
              loadedCoCurricular[s.id].art_p2 = data.p2 !== undefined ? String(data.p2) : "";
              loadedCoCurricular[s.id].art_total = Number(data.p1 || 0) + Number(data.p2 || 0);
            }
          }
          setCoCurricularMarks(loadedCoCurricular);
        }
      } catch (err) {
        console.error("Database initialization failed: ", err);
      }
    };
    loadData();
  }, [selectedClass, selectedSubject, entryMode, outOf]);

  const changeAcademicValue = (studentId: string, field: string, val: string) => {
    setAcademicMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { t1: "", m1: "", t2: "", m2: "", exam: "" }),
        [field]: val
      }
    }));
  };

  const saveAcademic = async (sid: string, field: string, val: string) => {
    if (!val && val !== "0") return;
    const baseTarget = selectedClass === "P6" ? 100 : 50;
    const finalCalculatedMark = Math.round((Number(val) / outOf) * baseTarget);
    await setDoc(doc(db, "students", sid, "marks", selectedSubject), { [field]: finalCalculatedMark }, { merge: true });
  };

  const saveCoCurricularField = async (studentId: string, activityType: "sport" | "creative_art", fieldPart: "p1" | "p2", rawValue: string) => {
    const numVal = rawValue === "" ? "" : Number(rawValue);
    
    if (rawValue !== "" && (Number(rawValue) > 5 || Number(rawValue) < 0)) {
      alert("⚠️ Invalid Input! Marks must be between 0 and 5.");
      return;
    }

    setCoCurricularMarks(prev => {
      const currentStudentData = prev[studentId] || { sport_p1: "", sport_p2: "", sport_total: 0, art_p1: "", art_p2: "", art_total: 0 };
      const updated = { ...currentStudentData };
      
      if (activityType === "sport") {
        if (fieldPart === "p1") updated.sport_p1 = rawValue;
        if (fieldPart === "p2") updated.sport_p2 = rawValue;
        updated.sport_total = Number(updated.sport_p1 || 0) + Number(updated.sport_p2 || 0);
      } else {
        if (fieldPart === "p1") updated.art_p1 = rawValue;
        if (fieldPart === "p2") updated.art_p2 = rawValue;
        updated.art_total = Number(updated.art_p1 || 0) + Number(updated.art_p2 || 0);
      }

      return { ...prev, [studentId]: updated };
    });

    const dbPayload = fieldPart === "p1" ? { p1: numVal } : { p2: numVal };
    await setDoc(doc(db, "students", studentId, "co_curricular", activityType), dbPayload, { merge: true });
  };

  if (!user) return <div className="p-10 font-black uppercase text-xs tracking-widest text-center text-blue-900">Checking credentials...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-xs pb-12">
      
      {/* AUTH & PROFILE HEADER BAR */}
      <div className="bg-[#11224D] text-white px-8 py-4 flex justify-between items-center shadow-md">
        <div>
          <div className="text-[10px] uppercase font-black text-blue-400 tracking-wider">ACTIVE INSTRUCTOR</div>
          <div className="text-lg font-black tracking-wide uppercase">{config.name}</div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setEntryMode(entryMode === "academic" ? "cocurricular" : "academic")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-md shadow border border-emerald-500 transition-all"
          >
            {entryMode === "academic" ? "🏆 Go to Co-Curricular" : "📖 Go to Academic Marks"}
          </button>

          {config.classTeacherOf && (
            <button className="bg-[#D4A373] hover:bg-[#c59262] text-slate-900 font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-md shadow transition-all">
              OBSERVE MY CLASS REPORTS 📋 (STREAM {config.classTeacherOf})
            </button>
          )}
          <button className="bg-[#8B1E1E] hover:bg-red-800 text-white font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-md shadow transition-all">
            SIGN OUT
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 mt-6">
        
        {/* DROPDOWN FILTER CARD CONTAINER */}
        <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-sm mb-6 flex gap-6">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">TARGET MATRIX STREAM</label>
            {entryMode === "academic" ? (
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-white text-slate-900 font-black uppercase text-sm px-4 py-3 rounded-xl border-2 border-slate-900 outline-none cursor-pointer"
              >
                {config.classes.map((c: string) => {
                  const match = config.assignments?.find((a: any) => a.class === c);
                  const subjDisplay = match ? match.subject : "Kinyarwanda";
                  return (
                    <option key={c} value={c}>CLASS STREAM {c} — {subjDisplay.toUpperCase()}</option>
                  );
                })}
              </select>
            ) : (
              <div className="w-full bg-slate-100 text-slate-800 font-black uppercase text-sm px-4 py-3 rounded-xl border-2 border-dashed border-slate-400">
                CO-CURRICULAR FIELD MATRIX — STREAM {config.classTeacherOf} ONLY
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">ASSESSMENT TARGET TERM</label>
            <select 
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full bg-white text-slate-900 font-black uppercase text-sm px-4 py-3 rounded-xl border-2 border-slate-900 outline-none cursor-pointer"
            >
              <option value="ACADEMIC TERM 1">ACADEMIC TERM 1</option>
              <option value="ACADEMIC TERM 2">ACADEMIC TERM 2</option>
              <option value="ACADEMIC TERM 3">ACADEMIC TERM 3</option>
            </select>
          </div>
        </div>

        {/* MAIN ROSTER DASHBOARD COMPONENT */}
        <div className="bg-white rounded-2xl border border-slate-900 p-6 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-[#11224D] text-md font-black uppercase tracking-wide">
                {entryMode === "academic" ? "MARKS GRADING DASHBOARD" : "CO-CURRICULAR SKILLS EVALUATION"}
              </h2>
              <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">
                {entryMode === "academic" 
                  ? `STREAM ${selectedClass} LEVEL • ${selectedSubject.toUpperCase()}` 
                  : `STREAM ${config.classTeacherOf} SPECIALIZED CO-CURRICULAR TRACK`}
              </p>
              <p className="text-emerald-600 text-[10px] font-bold uppercase mt-1">
                💡 CLICK TOP INPUT, PASTE WHOLE COLUMN FROM EXCEL, USE ENTER KEY TO NAVIGATE!
              </p>
            </div>

            {entryMode === "academic" ? (
              <div className="flex items-center gap-3">
                <span className="font-black text-[10px] uppercase text-slate-500">PAPER MAX:</span>
                <input 
                  type="number" 
                  value={outOf} 
                  onChange={(e) => setOutOf(Number(e.target.value))} 
                  className="w-16 text-slate-900 font-black p-2 text-center rounded-xl border-2 border-slate-900 outline-none text-xs" 
                />
                <button className="bg-[#00875A] hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-md shadow transition-all">
                  COMMIT & LOCK TERM MARKS 💾
                </button>
              </div>
            ) : (
              <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 font-black text-[10px] tracking-wider px-4 py-2.5 rounded-xl uppercase">
                ★ SCALE RANGE MAPPED: 5 + 5 = 10 MAX MARKS PER COLUMN
              </span>
            )}
          </div>

          {/* EVALUATION MATRIX DATA GRID */}
          <div className="border-2 border-slate-900 overflow-hidden">
            {entryMode === "academic" ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 uppercase text-[10px] font-black text-slate-800 border-b-2 border-slate-900">
                  <tr>
                    <th className="p-4 border-r border-slate-300 w-2/5">STUDENT REGISTER ENTRY</th>
                    {["TEST 1 (/50)", "MID 1 (/50)", "TEST 2 (/50)", "MID 2 (/50)", "FINAL EXAM (/50)"].map(h => (
                      <th key={h} className="border-r border-slate-300 p-2 text-center align-top">
                        <div className="mb-2">{h}</div>
                        <div className="flex items-center justify-center gap-1 font-sans text-[8px]">
                          <span className="px-1 py-0.5 border border-blue-400 text-blue-600 rounded bg-white cursor-pointer hover:bg-blue-50">COPY</span>
                          <span className="px-1 py-0.5 border border-amber-400 text-amber-600 rounded bg-white cursor-pointer hover:bg-amber-50">CUT</span>
                          <span className="px-1 py-0.5 border border-red-400 text-red-500 rounded bg-white cursor-pointer hover:bg-red-50">CLEAR</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {students.map((s, idx) => {
                    const studentMarks = academicMarks[s.id] || { t1: "", m1: "", t2: "", m2: "", exam: "" };
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-black uppercase border-r border-slate-300 text-[#11224D] text-sm tracking-wide">{s.name}</td>
                        {["t1", "m1", "t2", "m2", "exam"].map(f => (
                          <td key={f} className="p-2 border-r border-slate-300">
                            <input 
                              id={`${f}-${s.id}`} 
                              type="text" 
                              value={studentMarks[f] || ""}
                              onChange={(e) => changeAcademicValue(s.id, f, e.target.value)}
                              onBlur={(e) => saveAcademic(s.id, f, e.target.value)} 
                              onKeyDown={(e) => {if(e.key==="Enter") document.getElementById(`${f}-${students[idx+1]?.id}`)?.focus();}} 
                              className="w-[100px] mx-auto block p-2 text-center font-black rounded-lg border border-slate-400 outline-none focus:border-slate-900 text-sm shadow-sm" 
                              placeholder="" 
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-emerald-50/60 uppercase text-[10px] font-black text-slate-800 border-b-2 border-slate-900">
                  <tr>
                    <th rowSpan={2} className="p-4 border-r border-slate-300 w-2/5 align-middle">STUDENT REGISTER ENTRY</th>
                    <th colSpan={3} className="border-r border-slate-300 p-3 text-center bg-green-50 tracking-wider font-black text-green-950">SPORT ACTIVITIES</th>
                    <th colSpan={3} className="p-3 text-center bg-teal-50 tracking-wider font-black text-teal-950">CREATIVE ARTS</th>
                  </tr>
                  <tr className="bg-slate-100 text-[9px] border-b-2 border-slate-900 text-slate-600">
                    <th className="border-r border-slate-300 p-2 text-center w-[10%]">Part 1 (/5)</th>
                    <th className="border-r border-slate-300 p-2 text-center w-[10%]">Part 2 (/5)</th>
                    <th className="border-r border-slate-300 p-2 text-center bg-green-100/60 font-black text-green-900 w-[10%]">Total (/10)</th>
                    <th className="border-r border-slate-300 p-2 text-center w-[10%]">Part 1 (/5)</th>
                    <th className="border-r border-slate-300 p-2 text-center w-[10%]">Part 2 (/5)</th>
                    <th className="p-2 text-center bg-teal-100/60 font-black text-teal-900 w-[10%]">Total (/10)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {students.map((s) => {
                    const currentMarks = coCurricularMarks[s.id] || { sport_p1: "", sport_p2: "", sport_total: 0, art_p1: "", art_p2: "", art_total: 0 };
                    return (
                      <tr key={s.id} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="p-4 font-black uppercase border-r border-slate-300 text-slate-900 text-sm tracking-wide">{s.name}</td>
                        
                        {/* SPORT SKILLS FIELD */}
                        <td className="p-2 border-r border-slate-300">
                          <input 
                            type="text" 
                            value={currentMarks.sport_p1}
                            onChange={(e) => saveCoCurricularField(s.id, "sport", "p1", e.target.value)}
                            className="w-[80px] mx-auto block p-2 text-center font-black rounded-lg border border-slate-400 outline-none focus:border-emerald-600 text-sm shadow-sm" 
                            placeholder="/5" 
                          />
                        </td>
                        <td className="p-2 border-r border-slate-300">
                          <input 
                            type="text" 
                            value={currentMarks.sport_p2}
                            onChange={(e) => saveCoCurricularField(s.id, "sport", "p2", e.target.value)}
                            className="w-[80px] mx-auto block p-2 text-center font-black rounded-lg border border-slate-400 outline-none focus:border-emerald-600 text-sm shadow-sm" 
                            placeholder="/5" 
                          />
                        </td>
                        <td className="p-4 text-center font-black bg-green-50 text-green-700 text-md border-r border-slate-300">
                          {currentMarks.sport_total}
                        </td>

                        {/* CREATIVE ART SKILLS FIELD */}
                        <td className="p-2 border-r border-slate-300">
                          <input 
                            type="text" 
                            value={currentMarks.art_p1}
                            onChange={(e) => saveCoCurricularField(s.id, "creative_art", "p1", e.target.value)}
                            className="w-[80px] mx-auto block p-2 text-center font-black rounded-lg border border-slate-400 outline-none focus:border-teal-600 text-sm shadow-sm" 
                            placeholder="/5" 
                          />
                        </td>
                        <td className="p-2 border-r border-slate-300">
                          <input 
                            type="text" 
                            value={currentMarks.art_p2}
                            onChange={(e) => saveCoCurricularField(s.id, "creative_art", "p2", e.target.value)}
                            className="w-[80px] mx-auto block p-2 text-center font-black rounded-lg border border-slate-400 outline-none focus:border-teal-600 text-sm shadow-sm" 
                            placeholder="/5" 
                          />
                        </td>
                        <td className="p-4 text-center font-black bg-teal-50 text-teal-700 text-md">
                          {currentMarks.art_total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}