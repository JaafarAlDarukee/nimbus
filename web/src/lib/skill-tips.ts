/**
 * How to prove a skill on a CV: a skill only listed under Technical Skills is weak; one shown in a
 * bullet with a result is what recruiters and screening software both reward.
 */
import { SOFTWARE } from "@/lib/keywords";

const TIPS: Record<string, string> = {
  SolidWorks: "Say what you modelled and what it achieved: “Modelled a gearbox housing in SolidWorks, cutting its mass by 12%”.",
  CATIA: "Name the part or assembly and the result: “Designed the front wing endplates in CATIA for the Formula Student car”.",
  "Fusion 360": "Show a design you made and built: “Designed and 3D printed a camera mount in Fusion 360, used on 3 drone flights”.",
  AutoCAD: "Say what the drawings were for: “Produced 15 AutoCAD drawings for a site layout used by the build team”.",
  ANSYS: "Say what you simulated and what changed because of it: “Ran FEA in ANSYS on a bracket and raised its safety factor from 1.4 to 2.1”.",
  FEA: "Give the load case and the outcome: “Used FEA to find a stress hotspot and added a fillet that halved the peak stress”.",
  CFD: "Say what flow you modelled and the result: “Ran CFD on a duct design, cutting the pressure drop by 18%”.",
  MATLAB: "Show it solving a real problem: “Wrote a MATLAB model of suspension travel that matched rig tests within 5%”.",
  Simulink: "Name the system: “Built a Simulink model of a motor controller and tuned the PID gains to settle in under 0.5 s”.",
  Python: "Say what your code did and the time it saved: “Wrote a Python script to clean test data, saving 2 hours a week”.",
  Excel: "Go beyond “used Excel”: “Built an Excel cost model (lookups, pivot tables) that cut the build budget by 20%”.",
  Arduino: "Say what you built and how well it worked: “Programmed an Arduino servo release that fired 20 of 20 test launches”.",
  CNC: "Name the machine, material and accuracy: “Programmed and ran a 3-axis CNC mill to make aluminium parts to ±0.05 mm”.",
  Machining: "Name the machines and tolerance: “Machined 6 steel parts on manual lathes and mills to ±0.05 mm”.",
  "3D printing": "Say what you printed and why: “3D printed 4 prototype brackets to test fit before machining, saving a week”.",
  "GD&T": "Show it on real drawings: “Applied GD&T to 10 production drawings, cutting supplier queries”.",
  Lean: "Show a waste you removed and the result: “Mapped a packing line with Lean tools and cut walking distance by 30%”.",
  "Six Sigma": "Name the project and the measured change: “Used DMAIC on a scrap problem, cutting scrap from 4% to 1.5%”.",
  "5S": "Say where and what improved: “Led a 5S event on a CNC cell, cutting tool search time by 10 minutes a shift”.",
  Kaizen: "Give the before and after: “Ran a Kaizen event that cut changeover from 45 to 30 minutes”.",
  "Root cause": "Say what failed, why, and the fix: “Traced a leaking seal to a tolerance stack-up and changed the drawing”.",
  PLC: "Name the system and what it controlled: “Programmed a Siemens PLC to sequence a conveyor with 3 sensors”.",
  "Data analysis": "Say what the data showed and what happened next: “Analysed 6 months of downtime data and found the top 3 causes”.",
  "Project management": "Give scope, team and outcome: “Planned a 6-person build over 10 weeks and delivered on time and under budget”.",
  "Health and safety": "Show you applied it: “Wrote risk assessments for 4 workshop tasks, approved by the lab manager”.",
  "Cell culture": "Name the cell type and what it was for: “Maintained HEK293 cultures for a 6-week transfection study”.",
  PCR: "Say what you amplified or tested and the outcome: “Ran qPCR on 48 samples to measure gene expression, with clean controls”.",
  ELISA: "Give the target and sample count: “Ran ELISAs on 96 serum samples to measure IL-6 levels”.",
  "Western blot": "Say what protein and the result: “Confirmed protein knockdown by western blot across 3 repeats”.",
  Microscopy: "Name the technique: “Imaged fixed tissue with confocal microscopy and quantified it in ImageJ”.",
  Statistics: "Name the test and the finding: “Used a two-way ANOVA in R to show a significant effect (p < 0.01)”.",
  "Aseptic technique": "Show where it mattered: “Kept cultures contamination-free over a 10-week project using aseptic technique”.",
  Clinical: "Say the setting and what you did: “Shadowed a ward pharmacist for 2 weeks, checking 40+ prescriptions a day”.",
  "Patient care": "Be specific: “Supported 8 patients a shift with meals and mobility as a healthcare assistant”.",
};

/** A tip for proving one skill in a bullet. */
export function tipFor(skill: string): string {
  if (TIPS[skill]) return TIPS[skill];
  if (SOFTWARE.has(skill)) return `Say what you made or worked out with ${skill}, and the result: a number if you can.`;
  return `Show ${skill} in a bullet: where you used it, what you did, and what changed (a number if you can).`;
}
