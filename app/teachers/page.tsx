"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, setDoc, getDoc } from "firebase/firestore";

export default function TeacherPage() {
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ classes: [], subjects: [], classTeacherOf: "" });
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [outOf, setOutOf] = useState(50);
  
  // New State for Mode switching: "academic" or "cocurricular"
  const [entryMode, setEntryMode] = useState<"academic" | "cocurricular">("academic");
  // State to hold co-curricular marks from database
  const [coCurricularMarks, setCoCurricularMarks] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.email) {
        setUser(u);
        const snap = await getDoc(doc(db, "teachers", u.email.toLowerCase()));
        if (snap.exists()) {
          const d = snap.data(); 
          
          // Combined array ensuring classTeacherOf room is available to the drop menus
          const combinedClasses = [...(d.classes || [])];
          if (d.classTeacherOf && !combinedClasses.includes(d.classTeacherOf)) {
            combinedClasses.push(d.classTeacherOf);
          }

          setConfig({
            ...d,
            classes: combinedClasses
          });

          setSelectedClass(d.classes[0] || d.classTeacherOf || ""); 
          setSelectedSubject(d.subjects[0] || "");
        }
      }
    });
    return () => unsub();
  }, []);

  // Sync class selection rules when moving between modes
  useEffect(() => {
    if (entryMode === "cocurricular" && config.classTeacherOf) {
      setSelectedClass(config.classTeacherOf);
    } else if (entryMode === "academic" && config.classes.length > 0) {
      setSelectedClass(config.classes[0]);
    }
  }, [entryMode, config.classTeacherOf]);

  useEffect(() => {
    if (!selectedClass) return;
    if (entryMode === "academic" && !selectedSubject) return;

    const load = async () => {
      // Fetch students for the target class stream
      const snap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(list);

      if (entryMode === "academic") {
        // Load Academic Marks
        for (const s of list) {
          const mSnap = await getDoc(doc(db, "students", s.id, "marks", selectedSubject));
          if (mSnap.exists()) {
            const m = mSnap.data();
            ["t1", "m1", "t2", "m2", "exam"].forEach(f => {
              const el = document.getElementById(`${f}-${s.id}`) as HTMLInputElement;
              if (el) el.value = m[f] !== undefined ? m[f] : "";
            });
          } else {
            ["t1", "m1", "t2", "m2", "exam"].forEach(f => {
              const el = document.getElementById(`${f}-${s.id}`) as HTMLInputElement;
              if (el) el.value = "";
            });
          }
        }
      } else {
        // Load Co-Curricular Marks (Sport and Creative Arts)
        const loadedCoCurricular: Record<string, any> = {};
        for (const s of list) {
          loadedCoCurricular[s.id] = {
            sport_p1: "", sport_p2: "", sport_total: 0,
            art_p1: "", art_p2: "", art_total: 0
          };

          // Fetch Sport
          const sportSnap = await getDoc(doc(db, "students", s.id, "co_curricular", "sport"));
          if (sportSnap.exists()) {
            const data = sportSnap.data();
            loadedCoCurricular[s.id].sport_p1 = data.p1 !== undefined ? data.p1 : "";
            loadedCoCurricular[s.id].sport_p2 = data.p2 !== undefined ? data.p2 : "";
            loadedCoCurricular[s.id].sport_total = Number(data.p1 || 0) + Number(data.p2 || 0);
          }

          // Fetch Creative Art
          const artSnap = await getDoc(doc(db, "students", s.id, "co_curricular", "creative_art"));
          if (artSnap.exists()) {
            const data = artSnap.data();
            loadedCoCurricular[s.id].art_p1 = data.p1 !== undefined ? data.p1 : "";
            loadedCoCurricular[s.id].art_p2 = data.p2 !== undefined ? data.p2 : "";
            loadedCoCurricular[s.id].art_total = Number(data.p1 || 0) + Number(data.p2 || 0);
          }
        }
        setCoCurricularMarks(loadedCoCurricular);
      }
    };
    load();
  }, [selectedClass, selectedSubject, entryMode]);

  // Save regular academic marks
  const saveAcademic = async (sid: string, field: string, val: string) => {
    if (!val) return;
    const target = selectedClass === "P6" ? 100 : 50;
    const final = Math.round((Number(val) / outOf) * target);
    await setDoc(doc(db, "students", sid, "marks", selectedSubject), { [field]: final }, { merge: true });
  };

  // Save co-curricular activity marks (/5 per section)
  const saveCoCurricularField = async (studentId: string, activityType: "sport" | "creative_art", fieldPart: "p1" | "p2", rawValue: string) => {
    let numVal = rawValue === "" ? "" : Number(rawValue);
    
    // Safety check: Don't allow higher than 5 marks
    if (typeof numVal === "number" && (numVal > 5 || numVal < 0)) {
      alert("⚠️ Invalid Input! Marks must be between 0 and 5.");
      return;
    }

    // Update local state state matrix view
    setCoCurricularMarks(prev => {
      const currentStudentData = prev[studentId] || { sport_p1: "", sport_p2: "", art_p1: "", art_p2: "" };
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

    // Determine firestore payload keys dynamically
    const dbPayload = fieldPart === "p1" ? { p1: numVal } : { p2: numVal };
    await setDoc(doc(db, "students", studentId, "co_curricular", activityType), dbPayload, { merge: true });
  };

  if (!user) return <div className="p-10 font-black uppercase text-xs tracking-widest text-center text-blue-900">Checking credentials...</div>;

  return (
    <div className="min-h-screen bg-white font-sans text-xs">
      
      {/* Upper Mode Selection Control Strip */}
      <div className="bg-gray-800 text-white px-4 py-2 flex gap-4 items-center border-b border-gray-700">
        <button 
          onClick={() => setEntryMode("academic")} 
          className={`px-3 py-1 font-bold uppercase text-[10px] rounded transition-all ${entryMode === "academic" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
        >
          📖 Academic Subjects
        </button>
        {config.classTeacherOf ? (
          <button 
            onClick={() => setEntryMode("cocurricular")} 
            className={`px-3 py-1 font-bold uppercase text-[10px] rounded transition-all ${entryMode === "cocurricular" ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            🏆 Co-Curricular Activities (Stream {config.classTeacherOf} Only)
          </button>
        ) : (
          <span className="text-[10px] text-gray-500 uppercase italic">🔒 Co-Curricular Locked (Not Class Teacher)</span>
        )}
      </div>

      {/* Main Filter Management Headbar */}
      <div className="bg-blue-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex gap-2 items-center">
          {entryMode === "academic" ? (
            <>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="text-black text-[11px] p-1 font-bold rounded">
                {config.classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="text-black text-[11px] p-1 font-bold rounded">
                {config.subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          ) : (
            <div className="bg-emerald-800 px-3 py-1 rounded font-black text-[11px] uppercase tracking-wide">
              STREAM {config.classTeacherOf} MANAGEMENT ACTIVE
            </div>
          )}
        </div>
        
        {entryMode === "academic" && (
          <div className="font-black text-[10px] uppercase tracking-wide">
            Paper Max Score: <input type="number" value={outOf} onChange={(e) => setOutOf(Number(e.target.value))} className="w-10 text-black font-bold p-1 text-center rounded ml-1" />
          </div>
        )}
        {entryMode === "cocurricular" && (
          <div className="font-black text-[10px] uppercase tracking-wide text-emerald-300">
            ★ SYSTEM SETTINGS MAX: 5 + 5 = 10 MARKS EACH
          </div>
        )}
      </div>

      {/* Roster Interface Grid Matrix Area */}
      {entryMode === "academic" ? (
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100 uppercase text-[10px] font-black tracking-wider text-blue-900 border-b">
            <tr>
              <th className="p-3 border-r w-1/3">Student Name</th>
              {["t1", "m1", "t2", "m2", "exam"].map(h => <th key={h} className="border-r p-2 text-center">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => (
              <tr key={s.id} className="border-b hover:bg-blue-50">
                <td className="p-3 font-bold uppercase border-r text-blue-900">{s.name}</td>
                {["t1", "m1", "t2", "m2", "exam"].map(f => (
                  <td key={f} className="p-0 border-r">
                    <input 
                      id={`${f}-${s.id}`} 
                      type="number" 
                      onBlur={(e) => saveAcademic(s.id, f, e.target.value)} 
                      onKeyDown={(e) => {if(e.key==="Enter") document.getElementById(`${f}-${students[idx+1]?.id}`)?.focus();}} 
                      className="w-full p-3 text-center font-bold outline-none focus:bg-white" 
                      placeholder={`/${outOf}`} 
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-left border-collapse border border-gray-300">
          <thead className="bg-emerald-50 uppercase text-[10px] font-black tracking-wider text-emerald-900 border-b border-gray-300">
            <tr>
              <th rowSpan={2} className="p-4 border-r border-b border-gray-300 w-1/3 align-middle">Student Name</th>
              <th colSpan={3} className="border-r border-b border-gray-300 p-2 text-center bg-green-100/50">SPORT MARKS</th>
              <th colSpan={3} className="border-b border-gray-300 p-2 text-center bg-teal-100/50">CREATIVE ART MARKS</th>
            </tr>
            <tr className="bg-gray-50 text-[9px] border-b border-gray-300">
              <th className="border-r p-1 text-center w-[10%]">Part 1 (/5)</th>
              <th className="border-r p-1 text-center w-[10%]">Part 2 (/5)</th>
              <th className="border-r p-1 text-center bg-green-50 w-[10%]">Total (/10)</th>
              <th className="border-r p-1 text-center w-[10%]">Part 1 (/5)</th>
              <th className="border-r p-1 text-center w-[10%]">Part 2 (/5)</th>
              <th className="p-1 text-center bg-teal-50 w-[10%]">Total (/10)</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const currentMarks = coCurricularMarks[s.id] || { sport_p1: "", sport_p2: "", sport_total: 0, art_p1: "", art_p2: "", art_total: 0 };
              return (
                <tr key={s.id} className="border-b border-gray-200 hover:bg-emerald-50/40">
                  <td className="p-3 font-bold uppercase border-r border-gray-300 text-gray-900">{s.name}</td>
                  
                  {/* SPORT SECTIONS */}
                  <td className="p-0 border-r border-gray-300">
                    <input 
                      type="number" 
                      min={0} max={5}
                      value={currentMarks.sport_p1}
                      onChange={(e) => saveCoCurricularField(s.id, "sport", "p1", e.target.value)}
                      className="w-full p-3 text-center font-bold text-gray-800 outline-none" 
                      placeholder="/5" 
                    />
                  </td>
                  <td className="p-0 border-r border-gray-300">
                    <input 
                      type="number" 
                      min={0} max={5}
                      value={currentMarks.sport_p2}
                      onChange={(e) => saveCoCurricularField(s.id, "sport", "p2", e.target.value)}
                      className="w-full p-3 text-center font-bold text-gray-800 outline-none" 
                      placeholder="/5" 
                    />
                  </td>
                  <td className="p-3 text-center font-black bg-green-50 border-r border-gray-300 text-green-900 text-sm">
                    {currentMarks.sport_total}
                  </td>

                  {/* CREATIVE ART SECTIONS */}
                  <td className="p-0 border-r border-gray-300">
                    <input 
                      type="number" 
                      min={0} max={5}
                      value={currentMarks.art_p1}
                      onChange={(e) => saveCoCurricularField(s.id, "creative_art", "p1", e.target.value)}
                      className="w-full p-3 text-center font-bold text-gray-800 outline-none" 
                      placeholder="/5" 
                    />
                  </td>
                  <td className="p-0 border-r border-gray-300">
                    <input 
                      type="number" 
                      min={0} max={5}
                      value={currentMarks.art_p2}
                      onChange={(e) => saveCoCurricularField(s.id, "creative_art", "p2", e.target.value)}
                      className="w-full p-3 text-center font-bold text-gray-800 outline-none" 
                      placeholder="/5" 
                    />
                  </td>
                  <td className="p-3 text-center font-black bg-teal-50 text-teal-900 text-sm">
                    {currentMarks.art_total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}