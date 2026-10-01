/** Skills and keywords adverts screen for: engineering first, then lab science, then general. */
export const KEYWORDS = [
  // Engineering software and methods
  "SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Inventor", "Fusion 360", "ANSYS", "Abaqus", "COMSOL", "FEA", "CFD",
  "MATLAB", "Simulink", "Python", "C++", "LabVIEW", "Arduino", "Excel", "GD&T", "Tolerance analysis", "DFMEA", "PFMEA", "FMEA",
  "Lean", "Six Sigma", "Kaizen", "5S", "OEE", "Root cause", "CNC", "Machining", "Prototyping", "Testing", "Data analysis",
  "CAD", "Additive manufacturing", "3D printing", "Composites", "PLC", "ROS", "Robotics", "Electronics", "PCB", "Manufacturing",
  "Continuous improvement", "Project management", "Health and safety", "Report writing", "Technical drawings",
  // Lab and life science (biomedical, biochemistry)
  "Cell culture", "PCR", "qPCR", "ELISA", "Western blot", "HPLC", "Mass spectrometry", "Flow cytometry", "Microscopy",
  "Aseptic technique", "GLP", "GMP", "ISO 13485", "Medical devices", "Biocompatibility", "Clinical", "Laboratory", "Statistics",
  "SPSS", "RStudio",
  // General (show these in bullets rather than listing them as skills)
  "Problem solving", "Teamwork", "Communication", "Leadership",
];

/** Tools that go on the "Software" line of the template; the rest go under "Technical". */
export const SOFTWARE = new Set([
  "SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Inventor", "Fusion 360", "ANSYS", "Abaqus", "COMSOL", "MATLAB",
  "Simulink", "Python", "C++", "LabVIEW", "Arduino", "Excel", "SPSS", "RStudio", "ROS",
]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, keyword: string) =>
  new RegExp(`(^|[^a-z0-9+])${escape(keyword.toLowerCase())}($|[^a-z0-9+])`).test(text);

export const keywordsIn = (text: string) => {
  const lower = (text ?? "").toLowerCase();
  return KEYWORDS.filter((k) => has(lower, k));
};
