/**
 * Onboarding and profile option lists, ported from the design handoff's nimbus-data.js.
 * Defence, Nuclear and Fusion are left out: Nimbus never shows nuclear or weapons/defence
 * roles (the radar filters them), so offering them as choices would promise nothing.
 */

export type FieldOption = { label: string; soon: boolean; d: string };

export const FIELDS: FieldOption[] = [
  { label: "Engineering", soon: false, d: "Mechanical, civil, electrical, aerospace, biomedical and more" },
  { label: "Science", soon: false, d: "Biomedical science, biochemistry, marine biology and more" },
  { label: "Medical and health", soon: false, d: "Medicine, pharmacy, nursing, allied health" },
  { label: "Computing", soon: false, d: "Computer science, software, AI and machine learning, data, cyber" },
  { label: "Business", soon: true, d: "" },
];

export const DEGREES_BY_FIELD: Record<string, string[]> = {
  Engineering: [
    "Mechanical Engineering", "Biomedical Engineering", "Chemical Engineering", "Electrical Engineering",
    "Electronic Engineering", "Aerospace Engineering", "Civil Engineering", "Mechatronics and Robotics",
    "Automotive Engineering", "Manufacturing Engineering", "Materials Engineering", "General Engineering",
  ],
  Science: [
    "Biomedical Science", "Biochemistry", "Marine Biology", "Biology", "Chemistry", "Physics", "Microbiology",
    "Genetics", "Neuroscience", "Pharmacology", "Biotechnology", "Zoology", "Ecology and Conservation",
    "Environmental Science", "Oceanography", "Geology and Earth Sciences", "Forensic Science",
    "Food Science and Nutrition", "Materials Science", "Mathematics", "Sport and Exercise Science", "Psychology",
  ],
  Computing: [
    "Computer Science", "Software Engineering", "Artificial Intelligence and Machine Learning", "Data Science",
    "Cyber Security", "Computer Engineering", "Information Technology", "Games Development",
  ],
  "Medical and health": [
    "Medicine", "Pharmacy", "Nursing", "Midwifery", "Dentistry", "Physiotherapy", "Paramedic Science", "Radiography",
    "Occupational Therapy", "Optometry", "Nutrition and Dietetics", "Speech and Language Therapy",
    "Healthcare Science", "Operating Department Practice", "Veterinary Medicine", "Biomedical Science (IBMS accredited)",
  ],
};

export const DEGREE_NOTES: Record<string, string> = {
  "Mechanical Engineering": "Includes robotics, mechatronics, aerospace, automotive and manufacturing",
  "Biomedical Engineering": "Medical devices, prosthetics, biomaterials and clinical engineering",
  "Chemical Engineering": "Process, pharma, energy, food and materials",
  "Electrical Engineering": "Electronics, power systems, control and embedded systems",
  "Electronic Engineering": "Circuits, embedded systems, semiconductors and RF",
  "Aerospace Engineering": "Aircraft, propulsion, space and aerostructures",
  "Civil Engineering": "Structures, infrastructure, geotechnics and water",
  "Mechatronics and Robotics": "Robots, automation, control and embedded software",
  "Automotive Engineering": "Vehicles, powertrains, EVs and motorsport",
  "Manufacturing Engineering": "Production, lean, quality and automation",
  "Materials Engineering": "Metals, polymers, composites and testing",
  "General Engineering": "Roles across every engineering discipline",
  "Biomedical Science": "Lab medicine, diagnostics, pathology and research",
  "Computer Science": "Software, AI, data, systems: the lot",
  "Software Engineering": "Building and shipping software: web, backend, mobile, cloud",
  "Artificial Intelligence and Machine Learning": "ML engineering, research, LLMs, computer vision",
  "Data Science": "Data analysis, data engineering, statistics and ML",
  "Cyber Security": "Security analysis, pen testing, security engineering",
  "Computer Engineering": "Hardware and software together: embedded, chips, systems",
  "Information Technology": "IT, support, networks, cloud and tech consultancy",
  "Games Development": "Game programming, engines, tools and design",
  Biochemistry: "Molecular biology, pharma R&D and biotech",
  "Marine Biology": "Oceans, fisheries, aquaculture and conservation",
  Medicine: "Clinical attachments, research and summer schools",
  Pharmacy: "Community, hospital and industry pharmacy",
};

export const YEARS = [
  "Foundation year", "1st year", "2nd year", "3rd year", "Final year", "Integrated Masters", "MSc", "PhD",
  "Recent graduate",
];

export const SECTOR_GROUPS: { g: string; items: string[] }[] = [
  { g: "Transport and mobility", items: ["Motorsport", "Automotive", "EV and batteries", "Autonomous vehicles", "Rail", "Civil aerospace", "Marine and shipbuilding", "Micromobility", "Motorcycles"] },
  { g: "Space and security", items: ["Space and satellites", "Security tech"] },
  { g: "Energy", items: ["Wind and solar", "Hydrogen", "Oil and gas", "Power grid and utilities", "Energy storage", "Carbon capture"] },
  { g: "Making things", items: ["Consumer products", "Product design", "Industrial design", "Food and drink manufacturing", "Packaging", "Additive manufacturing", "Composites and materials", "Industrial automation", "Robotics", "Semiconductors", "Electronics and hardware", "Machinery and tooling", "Steel and metals"] },
  { g: "Health and life sciences", items: ["Medtech and devices", "Surgical robotics", "Prosthetics and orthotics", "Pharmaceuticals", "Biotech", "Diagnostics", "NHS and clinical engineering"] },
  { g: "Built environment", items: ["Construction", "Infrastructure", "Structural consultancy", "Building services", "Water and wastewater", "Geotechnical", "Smart cities", "Transport planning"] },
  { g: "Clinical and healthcare", items: ["NHS hospitals", "Private healthcare", "Clinical research", "Public health", "Community pharmacy", "Mental health services", "Dental practices", "Veterinary", "Medical communications", "Health tech"] },
  { g: "Science and research", items: ["Research institutes", "Genomics", "Neuroscience research", "Analytical labs", "Forensics", "Food science", "Cosmetics and personal care", "Chemicals", "Science communication", "Museums and botanic gardens"] },
  { g: "Marine and environment", items: ["Marine conservation", "Aquaculture and fisheries", "Oceanography", "Ecology and wildlife", "Environmental consultancy", "Zoos and aquariums", "Offshore survey"] },
  { g: "Computing and tech", items: ["Big tech", "Software and SaaS", "AI and machine learning", "Data and analytics", "Cyber security", "Fintech", "Cloud and infrastructure", "Gaming", "Telecoms", "Tech consultancy"] },
  { g: "Other paths", items: ["Engineering consultancy", "R&D labs", "Climate tech", "Agritech", "Sports equipment", "Audio and music tech", "Gaming hardware", "Startups", "Public sector", "Academia and research", "Patents and IP", "Technical sales", "Quant and finance"] },
];

export const SUGGEST: Record<string, string[]> = {
  "Computer Science": ["Big tech", "Software and SaaS", "AI and machine learning", "Fintech", "Cloud and infrastructure", "Gaming", "Tech consultancy"],
  "Software Engineering": ["Software and SaaS", "Big tech", "Fintech", "Cloud and infrastructure", "Gaming", "Tech consultancy"],
  "Artificial Intelligence and Machine Learning": ["AI and machine learning", "Big tech", "Data and analytics", "Health tech", "Autonomous vehicles", "Robotics"],
  "Data Science": ["Data and analytics", "AI and machine learning", "Fintech", "Quant and finance", "Big tech", "Health tech"],
  "Cyber Security": ["Cyber security", "Telecoms", "Tech consultancy", "Big tech", "Fintech"],
  "Computer Engineering": ["Semiconductors", "Electronics and hardware", "Cloud and infrastructure", "Big tech", "Robotics"],
  "Information Technology": ["Tech consultancy", "Telecoms", "Cloud and infrastructure", "Software and SaaS", "Public sector"],
  "Games Development": ["Gaming", "Software and SaaS", "Big tech"],
  "Mechanical Engineering": ["Motorsport", "Automotive", "Civil aerospace", "Robotics", "Consumer products", "Industrial automation", "Wind and solar", "Rail", "Engineering consultancy"],
  "Biomedical Engineering": ["Medtech and devices", "Surgical robotics", "Prosthetics and orthotics", "Pharmaceuticals", "Biotech", "Diagnostics", "NHS and clinical engineering"],
  "Chemical Engineering": ["Pharmaceuticals", "Oil and gas", "Hydrogen", "Food and drink manufacturing", "Carbon capture", "Water and wastewater", "Consumer products"],
  "Electronic Engineering": ["Electronics and hardware", "Semiconductors", "Space and satellites", "Robotics", "Audio and music tech"],
  "Aerospace Engineering": ["Civil aerospace", "Space and satellites", "Motorsport", "Composites and materials", "Engineering consultancy"],
  "Civil Engineering": ["Construction", "Infrastructure", "Structural consultancy", "Water and wastewater", "Rail", "Geotechnical", "Transport planning"],
  "Mechatronics and Robotics": ["Robotics", "Industrial automation", "Autonomous vehicles", "Surgical robotics", "Electronics and hardware"],
  "Automotive Engineering": ["Automotive", "Motorsport", "EV and batteries", "Autonomous vehicles", "Motorcycles"],
  "Manufacturing Engineering": ["Industrial automation", "Additive manufacturing", "Food and drink manufacturing", "Consumer products", "Machinery and tooling", "Steel and metals"],
  "Materials Engineering": ["Composites and materials", "Steel and metals", "Additive manufacturing", "Semiconductors", "Civil aerospace"],
  "General Engineering": ["Engineering consultancy", "Automotive", "Civil aerospace", "Infrastructure", "Wind and solar", "Consumer products"],
  "Electrical Engineering": ["Power grid and utilities", "Electronics and hardware", "Semiconductors", "EV and batteries", "Rail", "Wind and solar", "Robotics", "Space and satellites"],
  "Biomedical Science": ["NHS hospitals", "Diagnostics", "Analytical labs", "Clinical research", "Biotech", "Research institutes"],
  Biochemistry: ["Pharmaceuticals", "Biotech", "Research institutes", "Genomics", "Analytical labs", "Food science"],
  "Marine Biology": ["Marine conservation", "Aquaculture and fisheries", "Oceanography", "Ecology and wildlife", "Zoos and aquariums", "Environmental consultancy"],
  Biology: ["Research institutes", "Biotech", "Ecology and wildlife", "Science communication", "Pharmaceuticals"],
  Chemistry: ["Chemicals", "Pharmaceuticals", "Analytical labs", "Cosmetics and personal care", "Energy storage", "Forensics"],
  Physics: ["Research institutes", "Semiconductors", "Space and satellites", "Quant and finance"],
  Microbiology: ["Analytical labs", "Food science", "Pharmaceuticals", "Public health", "Biotech"],
  Genetics: ["Genomics", "Research institutes", "Biotech", "Clinical research"],
  Neuroscience: ["Neuroscience research", "Pharmaceuticals", "Clinical research", "Health tech"],
  Pharmacology: ["Pharmaceuticals", "Clinical research", "Biotech", "Medical communications"],
  Biotechnology: ["Biotech", "Pharmaceuticals", "Genomics", "Agritech", "Food science"],
  Zoology: ["Zoos and aquariums", "Ecology and wildlife", "Research institutes", "Veterinary"],
  "Ecology and Conservation": ["Ecology and wildlife", "Environmental consultancy", "Marine conservation", "Museums and botanic gardens"],
  "Environmental Science": ["Environmental consultancy", "Water and wastewater", "Climate tech", "Public sector"],
  Oceanography: ["Oceanography", "Offshore survey", "Marine conservation", "Wind and solar"],
  "Forensic Science": ["Forensics", "Analytical labs", "Public sector"],
  "Food Science and Nutrition": ["Food science", "Food and drink manufacturing", "Public health", "Analytical labs"],
  Medicine: ["NHS hospitals", "Clinical research", "Research institutes", "Public health", "Health tech"],
  Pharmacy: ["Community pharmacy", "NHS hospitals", "Pharmaceuticals", "Clinical research"],
  Nursing: ["NHS hospitals", "Private healthcare", "Mental health services", "Public health"],
  Dentistry: ["Dental practices", "NHS hospitals", "Private healthcare"],
  Physiotherapy: ["NHS hospitals", "Private healthcare", "Sports equipment", "Health tech"],
  "Veterinary Medicine": ["Veterinary", "Zoos and aquariums", "Research institutes"],
};

export const TYPES: { t: string; d: string }[] = [
  { t: "Placement", d: "Year in industry, 9 to 13 months" },
  { t: "Summer internship", d: "8 to 12 weeks, usually paid" },
  { t: "Spring week", d: "Short insight programmes, mostly first years" },
  { t: "Insight day", d: "One day on site or online" },
  { t: "Graduate scheme", d: "Starts after you finish" },
  { t: "Degree apprenticeship", d: "Earn a degree while you work" },
  { t: "Apprenticeship", d: "Technician and higher apprenticeships" },
  { t: "Work experience week", d: "A week shadowing a team" },
  { t: "Virtual work experience", d: "Online programmes you do from home" },
  { t: "Research internship", d: "University labs and UROP schemes" },
  { t: "Hackathon", d: "Build something in a weekend" },
  { t: "Competition", d: "Design challenges and prizes" },
  { t: "Conference", d: "Student tickets and bursaries" },
  { t: "Expo or careers fair", d: "Engineering shows, lab expos and science festivals" },
  { t: "Networking event", d: "Meet engineers and recruiters" },
  { t: "Summer school", d: "Short courses, UK and abroad" },
  { t: "Scholarship or bursary", d: "Funding from employers and institutions" },
  { t: "Mentoring programme", d: "Paired with a working engineer" },
  { t: "Part-time job", d: "Term-time technical work" },
  { t: "Seasonal job", d: "Summer and Christmas roles" },
  { t: "Freelance project", d: "Paid CAD, testing or build work" },
  { t: "Lab placement", d: "Research or industry lab, often summer" },
  { t: "Clinical shadowing", d: "Shadow doctors, pharmacists or therapists" },
  { t: "Healthcare assistant", d: "Bank and part-time HCA shifts" },
  { t: "Fieldwork", d: "Surveys, sampling and expeditions" },
  { t: "Funded PhD or Masters", d: "Studentships and research funding" },
];

export const DEFAULT_TYPES = ["Placement", "Summer internship", "Spring week", "Hackathon", "Competition", "Conference", "Expo or careers fair"];

export const UK_LOCATIONS = [
  "Anywhere in the UK", "London", "South East", "South West", "East of England", "East Midlands", "West Midlands",
  "North West", "North East", "Yorkshire and the Humber", "Scotland", "Wales", "Northern Ireland", "Remote in the UK",
];

export const ABROAD_LOCATIONS = [
  "Anywhere in Europe", "Worldwide", "Ireland", "Germany", "Netherlands", "Belgium", "Luxembourg", "France",
  "Switzerland", "Austria", "Italy", "Spain", "Portugal", "Denmark", "Sweden", "Norway", "Finland", "Poland", "Czechia",
  "Turkey", "USA", "Canada", "Mexico", "Brazil", "UAE", "Qatar", "Saudi Arabia", "Kuwait", "Oman", "Bahrain", "Egypt",
  "South Africa", "India", "China", "Hong Kong", "Taiwan", "South Korea", "Japan", "Singapore", "Malaysia",
  "Australia", "New Zealand",
];

/** Industries every degree in a field sees, on top of the degree's own suggestions. */
export const FIELD_EXTRAS: Record<string, string[]> = {
  Engineering: ["Engineering consultancy", "R&D labs"],
  Science: ["Research institutes", "Analytical labs"],
  "Medical and health": ["NHS hospitals", "Clinical research"],
  Computing: ["Startups", "Quant and finance"],
};
