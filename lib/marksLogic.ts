export const schoolSubjects = [
  { id: "math", name: "Mathematics" },
  { id: "kiny", name: "Kinyarwanda" },
  { id: "eng", name: "English" },
  { id: "set", name: "Science & Elem. Tech (SET)" },
  { id: "sre", name: "SRE / Religion" },
  { id: "social", name: "Social Studies" },
  { id: "french", name: "French" }
];

export const calculateAverages = (t1: number, m1: number, t2: number, m2: number, exam: number) => {
  const tAvg = (t1 + m1 + t2 + m2) / 4;
  const annualAvg = (tAvg + exam) / 2;
  return { tAvg, annualAvg };
};

export const getStudentComment = (avg: number) => {
  if (avg >= 80) return "Excellent Performance. Keep it up!";
  if (avg >= 60) return "Good Work. Aim higher next term.";
  if (avg >= 50) return "Satisfactory. More effort needed.";
  return "Below average. Intensive revision required.";
};