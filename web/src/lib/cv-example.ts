/**
 * A good example CV in the Nimbus template (r/EngineeringResumes style), for students to copy the
 * shape of. The person and companies are made up; the numbers show the kind of result to aim for.
 */
import type { BuiltCv } from "@/lib/cv";

export const EXAMPLE_CV: BuiltCv = {
  name: "Sam Taylor",
  email: "sam.taylor@student.ac.uk",
  phone: "07700 900123",
  linkedin: "linkedin.com/in/sam-taylor",
  address: "Sheffield",
  uni: "University of Sheffield",
  degree: "BEng Mechanical Engineering",
  dates: "Sep 2024 – Jun 2028",
  grade: "On track for a First (72% in Year 1)",
  modules: "Solid Mechanics, Thermofluids, Design and Manufacture, MATLAB Programming",
  skills: ["SolidWorks", "CATIA", "ANSYS", "MATLAB", "Python", "Excel", "FEA", "GD&T", "Machining", "3D printing", "Lean", "5S"],
  exp: [
    {
      kind: "work",
      role: "Engineering Intern",
      org: "Precision Components Ltd",
      place: "Rotherham",
      dates: "Jun 2025 – Sep 2025",
      on: true,
      bullets: [
        "Redesigned a machined bracket in SolidWorks and checked it with FEA, cutting its mass by 22% while keeping a safety factor above 2",
        "Wrote a Python script to log CMM inspection results, saving the quality team about 3 hours a week",
        "Ran a 5S and Kaizen event on a CNC cell with 4 operators, cutting changeover time from 45 to 30 minutes",
      ].join("\n"),
    },
    {
      kind: "work",
      role: "Warehouse Assistant",
      org: "Northern Retail Logistics",
      place: "Sheffield",
      dates: "Jul 2024 – Sep 2024",
      on: true,
      bullets: "Picked and packed 300+ orders a shift at 99.8% accuracy, and trained 2 new starters on the scanners",
    },
    {
      kind: "project",
      role: "Formula Student Suspension",
      org: "Sheffield Formula Racing",
      dates: "Oct 2024 – Present",
      on: true,
      bullets: [
        "Designed the front uprights in CATIA and ran FEA in ANSYS, making them 15% lighter than last year's car",
        "Machined 6 prototype parts on manual lathes and mills to ±0.05 mm, then tested them on a load rig",
      ].join("\n"),
    },
    {
      kind: "project",
      role: "Line Launcher",
      org: "IMechE Design Challenge",
      dates: "Jan 2025 – Apr 2025",
      on: true,
      bullets: "Built a spring-powered launcher that hit targets at 2, 4 and 6 m within a £50 budget, placing 3rd of 24 teams",
    },
  ],
};

/** Notes pinned to lines of the example (matched by the start of the line's text). */
export const EXAMPLE_NOTES: { starts: string; note: string }[] = [
  { starts: "07700", note: "Phone, email, LinkedIn, town. No address, photo or date of birth" },
  { starts: "University of Sheffield", note: "Dates on the right, the same way everywhere" },
  { starts: "BEng", note: "Grade if it's a 2:1 or better" },
  { starts: "• Redesigned", note: "Verb + what you did + a number" },
  { starts: "• Wrote a Python", note: "Advert keywords inside real results" },
  { starts: "• Picked and packed", note: "Non-engineering jobs still show results" },
  { starts: "Projects", note: "Projects count as much as jobs" },
  { starts: "Software:", note: "Skills grouped; no soft skills listed" },
];

/** The rules behind the example (the r/EngineeringResumes wiki, shortened). */
export const EXAMPLE_RULES = [
  "One page, one column, plain font. Screening software reads it top to bottom.",
  "Education first while you're a student: university, degree, dates, grade, a few relevant modules.",
  "Experience and Projects: newest first. Projects (Formula Student, coursework, things you built) count as much as jobs.",
  "Every bullet: a past-tense verb, what you did, how, and a result with a number (%, time, money, quantity, tolerance).",
  "Use the advert's exact words for skills you really have, in a bullet and in Technical Skills.",
  "No summary, no photo, no “references available on request”. Use the space for one more project.",
  "Save as PDF named like Sam_Taylor_CV.pdf, unless the employer asks for Word.",
];
