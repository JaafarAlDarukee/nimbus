/** Skills and keywords adverts screen for: engineering first, then lab science and health, then general. */
export const KEYWORDS = [
  // CAD, simulation and engineering software
  "SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Inventor", "Fusion 360", "Solid Edge", "Onshape", "Revit",
  "Civil 3D", "BIM", "ANSYS", "Abaqus", "COMSOL", "HyperMesh", "LS-DYNA", "STAR-CCM+", "OpenFOAM", "FEA", "CFD", "CAD", "CAM",
  "MATLAB", "Simulink", "LabVIEW", "Minitab", "Altium", "KiCad", "SPICE",
  // Programming and data
  "Python", "C++", "C#", "C programming", "Embedded C", "Java", "JavaScript", "SQL", "VBA", "Git", "Linux", "Verilog", "VHDL",
  "FPGA", "Arduino", "Raspberry Pi", "Excel", "Power BI", "Tableau", "SAP", "Data analysis", "Machine learning", "Statistics",
  // Design and analysis methods
  "GD&T", "Tolerance analysis", "Technical drawings", "DFM", "DFMEA", "PFMEA", "FMEA", "DOE", "Stress analysis",
  "Thermodynamics", "Heat transfer", "Fluid mechanics", "Vibration", "Control systems", "Signal processing",
  "Power electronics", "Instrumentation", "Sensors", "Data acquisition", "Hydraulics", "Pneumatics", "HVAC",
  "Structural analysis", "Eurocodes", "Surveying", "Geotechnical", "Prototyping", "Testing", "Validation", "Reliability",
  "Failure analysis", "Root cause", "Risk assessment",
  // Manufacturing and quality
  "Lean", "Six Sigma", "Kaizen", "5S", "OEE", "SPC", "APQP", "PPAP", "8D", "Value stream mapping", "Kanban", "TPM",
  "Continuous improvement", "CNC", "Machining", "Welding", "Sheet metal", "Injection moulding", "Casting", "Metrology", "CMM",
  "Calibration", "Additive manufacturing", "3D printing", "Composites", "Manufacturing", "ISO 9001", "ISO 14001",
  // Electrical, automation and robotics
  "PLC", "SCADA", "ROS", "Robotics", "Automation", "Electronics", "PCB", "Embedded systems", "Power systems", "High voltage",
  // Projects and safety
  "Project management", "Agile", "Health and safety", "COSHH", "CDM", "Report writing", "Sustainability",
  "Life cycle assessment", "GIS",
  // Lab and life science (biomedical, biochemistry, biology)
  "Cell culture", "PCR", "qPCR", "ELISA", "Western blot", "Gel electrophoresis", "Cloning", "CRISPR", "Sequencing",
  "Bioinformatics", "HPLC", "Mass spectrometry", "Chromatography", "Spectroscopy", "NMR", "Flow cytometry", "Microscopy",
  "Histology", "Immunohistochemistry", "ImageJ", "GraphPad Prism", "SPSS", "RStudio", "Aseptic technique", "GLP", "GMP",
  "ISO 13485", "Medical devices", "Biocompatibility", "Laboratory",
  // Clinical and health
  "Clinical", "Clinical trials", "GCP", "Pharmacovigilance", "Regulatory affairs", "Patient care", "Phlebotomy",
  "Clinical audit", "Safeguarding", "First aid", "NHS",
  // General (show these in bullets rather than listing them as skills)
  "Problem solving", "Teamwork", "Communication", "Leadership", "Presentation", "Time management", "Attention to detail",
  "Stakeholder management", "Customer service",
];

/** Tools that go on the "Software" line of the template; the rest go under "Technical". */
export const SOFTWARE = new Set([
  "SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Inventor", "Fusion 360", "Solid Edge", "Onshape", "Revit", "Civil 3D",
  "ANSYS", "Abaqus", "COMSOL", "HyperMesh", "LS-DYNA", "STAR-CCM+", "OpenFOAM", "MATLAB", "Simulink", "LabVIEW", "Minitab",
  "Altium", "KiCad", "SPICE", "Python", "C++", "C#", "C programming", "Embedded C", "Java", "JavaScript", "SQL", "VBA", "Git",
  "Linux", "Verilog", "VHDL", "Arduino", "Raspberry Pi", "Excel", "Power BI", "Tableau", "SAP", "SPSS", "RStudio", "ROS",
  "ImageJ", "GraphPad Prism", "GIS",
]);

/** Soft skills: show them in bullets, don't list them under Technical Skills. */
export const SOFT = new Set([
  "Problem solving", "Teamwork", "Communication", "Leadership", "Presentation", "Time management", "Attention to detail",
  "Stakeholder management", "Customer service",
]);

/**
 * Other words that show the same skill. Screening software looks for the advert's exact word, so
 * when a CV only has these, the checker says "you did this: use the advert's word".
 */
export const EVIDENCE: Record<string, RegExp> = {
  Machining: /\b(machin(ed|ing)|lathes?|milling( machine)?s?|turned on)\b/i,
  CNC: /\b(cnc|g-?code|numerically controlled)\b/i,
  CAD: /\b(solidworks|fusion 360|inventor|catia|creo|autocad|siemens nx|onshape|solid edge|3d model(led|ling)?)\b/i,
  FEA: /\b(finite element|ansys|abaqus|stress simulation)\b/i,
  CFD: /\b(computational fluid|star-ccm|openfoam|fluent)\b/i,
  "Technical drawings": /\b(engineering drawings?|technical drawings?|drawings?)\b/i,
  Prototyping: /\b(prototyp(e|es|ed)|built (a|the) (rig|model|prototype))\b/i,
  Testing: /\b(test(ed|s|ing)?|trials?|experiment(s|ed)?)\b/i,
  "Data analysis": /\b(analys(ed|ing) (the |our |test )?(data|results|measurements|readings)|data (analysis|logging|sets?)|plotted|trend(s|ed)|dashboards?)\b/i,
  "Root cause": /\b(diagnos(ed|is)|troubleshoot(ing|ed)?|fault[- ]find(ing)?|why it failed|traced (the|a) (fault|problem|failure))\b/i,
  "Problem solving": /\b(solved|fixed|diagnos(ed|is)|troubleshoot|resolved|figured out)\b/i,
  Teamwork: /\b(team|together|collaborat(ed|ing|ion))\b/i,
  Communication: /\b(present(ed|ation)|explained|translat(ed|ion)|liaised|report(ed)?|wrote)\b/i,
  Leadership: /\b(led|lead|captain(ed)?|managed|organis(ed|ing)|organiz(ed|ing)|mentored|coordinated|president|chair)\b/i,
  Presentation: /\b(present(ed|ation)s?|pitch(ed)?|talks?)\b/i,
  "Project management": /\b(managed (the )?project|deadlines?|gantt|planned|scheduled|budget)\b/i,
  "Health and safety": /\b(health (and|&) safety|risk assessments?|ppe|coshh|safe working|safety (training|induction|checks?|procedures?|rules|briefings?))\b/i,
  "Risk assessment": /\b(risk assessments?|hazards?)\b/i,
  "Report writing": /\b(report|wrote|write-?up|documented)\b/i,
  "3D printing": /\b(3d print(ed|ing)?|additive|fdm|sla printing)\b/i,
  "Additive manufacturing": /\b(3d print(ed|ing)?|additive)\b/i,
  Manufacturing: /\b(manufactur(e|ed|ing)|production|fabricat(ed|ion)|built)\b/i,
  Electronics: /\b(circuits?|electronic|soldered|pcb|arduino|breadboard)\b/i,
  Arduino: /\barduino\b/i,
  "Continuous improvement": /\b(improv(ed|ement)s?|kaizen|lean|5s|streamlin(ed|ing))\b/i,
  Sustainability: /\b(sustainab\w+|carbon|net zero|recycl\w+|energy saving)\b/i,
  Laboratory: /\b(lab(oratory)?|experiments?|samples?|assays?)\b/i,
  Statistics: /\b(statistic(s|al)|regression|t-test|anova|significan(t|ce))\b/i,
  "Customer service": /\b(customers?|clients?|members of the public|front of house)\b/i,
  "Stakeholder management": /\b(stakeholders?|clients?|liaised|suppliers?)\b/i,
  "Time management": /\b(deadlines?|alongside (my )?studies|while studying|balanced)\b/i,
  "Attention to detail": /\b(accura(te|cy)|precise|precision|tolerances?|inspect(ed|ion))\b/i,
};

// Acronyms that are also everyday words ("spice", "cam", "sap", "doe"): only count them in capitals
const CASED = new Set(["SPICE", "CAM", "SAP", "DOE", "GIS", "ROS", "NMR", "PCR", "GCP", "CDM", "TPM", "SPC", "DFM", "OEE", "NHS", "BIM", "CMM", "PLC", "FEA", "CFD", "CAD", "GLP", "GMP"]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, keyword: string) =>
  new RegExp(`(^|[^a-z0-9+#])${escape(keyword.toLowerCase())}($|[^a-z0-9+#])`).test(text);
const hasCased = (text: string, keyword: string) => new RegExp(`(^|[^A-Za-z0-9+#])${escape(keyword)}($|[^A-Za-z0-9+#])`).test(text);

export const keywordsIn = (text: string) => {
  const lower = (text ?? "").toLowerCase();
  return KEYWORDS.filter((k) => (CASED.has(k) ? hasCased(text ?? "", k) : has(lower, k)));
};

/** The first line of the CV that shows a skill in other words, if any. */
export function evidenceFor(keyword: string, lines: string[]): string | null {
  const pattern = EVIDENCE[keyword];
  return pattern ? (lines.find((l) => pattern.test(l)) ?? null) : null;
}
