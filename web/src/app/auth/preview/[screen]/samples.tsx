// Sample data taken from the design files, for the development-only previews.
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { CompaniesView } from "@/components/companies-view";
import { ProfileView } from "@/components/profile-view";
import { COMPANIES } from "@/lib/companies-data";
import { TrackerView, type TrackerRow } from "@/components/tracker-view";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const DAY = 86_400_000;
export const CHECKED_AT = new Date(Date.now() - 4 * 60_000).toISOString();
const row = (id: number, stage: string, group: string, role: string, company: string, type: string, applied: string, next: string, due: string, urgent = false, fresh = false): TrackerRow => ({
  id: String(id), stage, group, role, company, initial: company[0], type, applied, next, due, dueAt: id * DAY, urgent, fresh, ghosted: next.startsWith("Ghosted"),
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
              return { name, place, open, radarNames: [] };
            }),
          ]),
        )}
        others={[{ name: "Ocado Technology", place: "", open: 6, radarNames: [] }]}
      />
    ),
  },
  calendar: {
    path: "/calendar",
    render: () => {
      const ev = (day: string, kind: CalendarEvent["kind"], title: string, company: string, meta: string, note = "Saved in your tracker."): CalendarEvent => ({
        id: `${day}${title}`, applicationId: "x", day, kind, title, company, meta, note, startsAt: `${day}T09:00:00Z`, reminded: false,
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
          ]}
        />
      );
    },
  },
};
