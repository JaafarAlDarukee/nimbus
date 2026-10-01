// Sample data taken from the design files, for the development-only previews.
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { CompaniesView } from "@/components/companies-view";
import { CvStudio } from "@/components/cv-studio";
import { OpportunityFeed } from "@/components/opportunity-feed";
import type { OpportunityView } from "@/lib/opportunity-view";
import { ProfileView } from "@/components/profile-view";
import { COMPANIES } from "@/lib/companies-data";
import { TrackerView, type TrackerRow } from "@/components/tracker-view";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const DAY = 86_400_000;
export const CHECKED_AT = new Date(Date.now() - 4 * 60_000).toISOString();
const row = (id: number, stage: string, group: string, role: string, company: string, type: string, applied: string, next: string, due: string, urgent = false, fresh = false): TrackerRow => ({
  id: String(id), stage, group, role, company, initial: company[0], type, applied, next, due, dueAt: id * DAY, urgent, fresh, ghosted: next.startsWith("Ghosted"), nextStep: null, dueOn: null, notes: null, url: null, manual: false,
});

export const SAMPLES: Record<string, { path: string; render: () => React.ReactNode }> = {
  tracker: {
    path: "/tracker",
    render: () => (
      <TrackerView
        rows={[
          row(1, "saved", "Saved", "Discover: Behind the Scenes", "Rolls-Royce", "Spring week", "—", "Apply before it closes", "16 Oct", true),
          row(2, "saved", "Saved", "Operational Excellence Intern", "Müller UK & Ireland", "Internship", "—", "Tailor CV first", "24 Oct", true, true),
          row(3, "saved", "Saved", "Summer Research Assistant", "Bristol Robotics Lab", "Research", "—", "Email the lab", "20 Oct", true),
          row(4, "applied", "Applied", "Industrial Placement 2027", "Jaguar Land Rover", "Placement", "15 Sep", "Follow up Thu", "1 Oct"),
          row(5, "applied", "Applied", "Internship Programme 2027: R&D", "Kerry", "Internship", "22 Sep", "Waiting", "—"),
          row(6, "applied", "Applied", "Year in Industry: Test Engineer", "Renishaw", "Placement", "19 Sep", "Follow up Mon", "5 Oct"),
          row(8, "online_test", "Online test", "Placement: Electrical Systems", "Siemens Mobility", "Placement", "12 Sep", "Numerical test, 60 min", "today", true),
          row(10, "interview", "Interview", "Industrial Placement: Chassis", "Jaguar Land Rover", "Placement", "2 Sep", "Thu 10:00 · prep ready", "1 Oct"),
          row(11, "interview", "Interview", "Operational Excellence Intern", "Müller UK & Ireland", "Internship", "10 Sep", "Tue 20 Oct · 14:30", "20 Oct"),
          row(12, "offer", "Offer", "Summer Engineering Intern", "Williams Advanced Engineering", "Internship", "28 Aug", "Reply to offer", "9 Oct", true),
          row(14, "ghosted", "Closed", "Placement: Aerodynamics", "McLaren Racing", "Placement", "19 Aug", "Ghosted · 41 days", "—"),
        ]}
      />
    ),
  },
  profile: {
    path: "/profile",
    render: () => (
      <ProfileView
        firstName="Sam"
        lastName="Okafor"
        email="sam.okafor@student.ac.uk"
        count={412}
        telegram={{ username: "sam_eng" }}
        preferences={{ ...DEFAULT_PREFERENCES, sectors: ["Motorsport", "Automotive", "Civil aerospace", "Robotics", "Wind and solar"] }}
      />
    ),
  },
  companies: {
    path: "/companies",
    render: () => (
      <CompaniesView
        field="Engineering"
        degree="Mechanical Engineering"
        sectors={["Motorsport"]}
        muted={["Prodrive"]}
        lastChecked={CHECKED_AT}
        directory={Object.fromEntries(
          Object.entries(COMPANIES).map(([sector, list]) => [
            sector,
            list.map((entry) => {
              const [name, place] = entry.split("|");
              const open = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 0) % 13;
              return { name, place, open, openAnywhere: open, radarNames: [], watching: open ? ["workday"] : null };
            }),
          ]),
        )}
        others={[{ name: "Ocado Technology", place: "", open: 6, openAnywhere: 6, radarNames: [], watching: ["greenhouse"] }]}
      />
    ),
  },
  calendar: {
    path: "/calendar",
    render: () => {
      const ev = (day: string, kind: CalendarEvent["kind"], title: string, company: string, meta: string, note = "Saved in your tracker."): CalendarEvent => ({
        id: `${day}${title}`, day, kind, title, company, meta, note,
        ...(["deadline", "online_test", "interview"].includes(kind)
          ? { reminder: { applicationId: "x", remindKind: kind as "deadline", startsAt: `${day}T09:00:00Z`, on: false } }
          : {}),
      });
      return (
        <CalendarView
          today="2026-09-29"
          events={[
            ev("2026-09-22", "deadline", "Year in Industry: Process Engineer", "Unilever", "23:59"),
            ev("2026-09-29", "online_test", "Numerical reasoning test", "Siemens Mobility", "due 23:59 · 60 min", "Link is in your email from Siemens."),
            ev("2026-09-16", "deadline", "Discover: Behind the Scenes", "Rolls-Royce", "17:00"),
            ev("2026-10-01", "interview", "Interview: Industrial Placement", "Jaguar Land Rover", "10:00 · video"),
            ev("2026-10-01", "deadline", "Year in Industry: Test Engineer", "Renishaw", "23:59"),
            ev("2026-09-15", "applied", "Industrial Placement 2027", "Jaguar Land Rover", "you applied"),
            ev("2026-10-09", "closing", "Design Engineering 12 Month Placement Scheme", "Caterpillar", "closes · fits your radar"),
            ev("2026-09-29", "opened", "3 roles that fit you", "Haleon", "first seen by Nimbus"),
            ev("2026-10-01", "expected", "Applications usually open: In stages across January", "Jaguar Land Rover", "from their own site"),
          ]}
        />
      );
    },
  },
  "cv-studio": {
    path: "/cv-studio",
    render: () => {
      const saved = {
        name: "Sam Okafor", email: "sam.okafor@student.ac.uk", phone: "07700 900123", linkedin: "linkedin.com/in/sam-okafor", address: "Birmingham", uni: "University of Birmingham",
        degree: "BEng Mechanical Engineering", dates: "2024 – 2028", grade: "On track for a 2:1", modules: "Thermodynamics, Stress Analysis, Manufacturing Processes", skills: ["CAD", "ANSYS", "FEA", "CNC", "Python", "Teamwork"],
        exp: [
          { role: "Formula Student, suspension lead", org: "UoB Racing", dates: "2025 – now", bullets: "Designed uprights in CAD and ran FEA in ANSYS\nCut upright mass by 18% while keeping the safety factor above 2", on: true, kind: "project" as const },
          { role: "Summer production operative", org: "Bakery line", place: "Birmingham", dates: "Summer 2025", bullets: "Helped run Kaizen and 5S projects\nTracked downtime on the line", on: true, kind: "work" as const },
        ],
      };
      const jd = "We are looking for an Operational Excellence Intern to support continuous improvement across our manufacturing site. You will use Lean and Six Sigma tools, run root cause analysis, track OEE and support Kaizen events. Requirements: studying Mechanical or Manufacturing Engineering, confident with data analysis and Excel, strong communication and teamwork, awareness of health and safety, experience with 5S or PFMEA is a plus.";
      return (
        <CvStudio
          jobs={[{ id: "a", title: "Operational Excellence Intern", company: "Müller UK & Ireland", link: "https://careers.muller.co.uk", jd, jdName: "Muller_OpEx_Intern.pdf", mode: "build", cvName: null, cvText: null, cvMeta: null, cv: saved, step: 4 }]}
          selectedId="a"
          saved={saved}
          hasSaved
          signupCv={null}
          aiOn={false}
        />
      );
    },
  },
  opportunities: {
    path: "/",
    render: () => {
      const o = (id: number, type: string, tone: OpportunityView["tone"], match: number, title: string, company: string, loc: string, found: string, isNew: boolean, domain: string | null, closing: string): OpportunityView => ({
        id: String(id), type, tone, match, title, company, loc, found, isNew, initial: company[0], closing,
        logo: domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : null,
        why: ["Internships are one of the types you picked", "Manufacturing fits your Mechanical Engineering", "Based in the UK, where you said you'd work"],
        deadline: "24 Oct 2026", source: "careers.example.com", applyUrl: "https://example.com", contact: "Early Careers team", contactNote: "Listed by the employer", advert: "", via: null,
      });
      const list = [
        o(1, "Internship", "lil", 94, "Operational Excellence Intern", "Müller UK & Ireland", "Telford", "35m ago", true, "muller.co.uk", "closes 24 Oct"),
        o(2, "Spring week", "dawn", 91, "Discover: Behind the Scenes", "Rolls-Royce", "Solihull", "2h ago", true, "rolls-royce.com", "closes 16 Oct"),
        o(3, "Placement", "sky", 89, "Industrial Placement 2027: Mechanical", "Jaguar Land Rover", "Gaydon", "5h ago", true, "jaguarlandrover.com", "closes 1 Nov"),
        o(4, "Internship", "lil", 86, "Internship Programme 2027: R&D", "Kerry", "UK", "1h ago", true, "kerry.com", "closes 31 Oct"),
        o(5, "Research", "rose", 81, "Summer Research Assistant: Soft Robotics", "Bristol Robotics Lab", "Bristol", "1d ago", false, null, "closes 20 Oct"),
        o(6, "Apprenticeship", "teal", 78, "Apprentice Calibration Technician", "Triumph Motorcycles", "Hinckley", "3h ago", true, "triumphmotorcycles.co.uk", "closes 8 Nov"),
      ];
      return (
        <OpportunityFeed
          tab="you" type="All types" q="" limit={40} opportunities={list} hasMore={false} counts={{ you: 9, all: 1284 }} newCount={8}
          tracked={{ "2": "saved" }} phone={{ closingSoon: [list[1], list[4]], saved: [list[1]], today: 3, weekday: "Tuesday" }} find={false} telegramLinked error={null}
        />
      );
    },
  },
};
