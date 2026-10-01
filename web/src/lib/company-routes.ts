/**
 * How to get into a company when there's nothing (or little) advertised: their careers page, the
 * route they publish, a published contact, and when applications usually open. Only what the
 * company itself publishes, with the page it came from. Add more as they're checked.
 */
export type CompanyRoute = {
  careers: string;
  how: string;
  contact?: string;
  /** When applications usually open, in the company's own words */
  opens?: string;
  /** Month number (1-12) the calendar uses for "expected to open" */
  opensMonth?: number;
  source: string;
  checked: string;
};

export const ROUTES: Record<string, CompanyRoute> = {
  "Mitsubishi Electric": {
    careers: "https://gb.mitsubishielectric.com/en/about/local/careers/index.html",
    how: "Placements are rarely advertised. Their UK careers page asks you to contact their Recruitment Specialists about vacancies, so send a short email with your CV saying what you study and what kind of placement you want.",
    contact: "MEU-UK.Recruitment@meuk.mee.com",
    source: "https://gb.mitsubishielectric.com/en/about/local/careers/index.html",
    checked: "2026-10-01",
  },
  "Jaguar Land Rover": {
    careers: "https://careers.jaguarlandrover.com/early-careers/undergraduates",
    how: "Five undergraduate programmes (engineering, manufacturing engineering, data, commercial, design). Register interest on their early-careers site; each programme page gives its own opening date.",
    contact: "graduate@jaguarlandrover.com",
    opens: "In stages across January",
    opensMonth: 1,
    source: "https://careers.jaguarlandrover.com/early-careers/undergraduates",
    checked: "2026-10-01",
  },
  "McLaren Racing": {
    careers: "https://racingcareers.mclaren.com/jobs",
    how: "All roles, including work experience and graduate roles, are on their racing careers site. Their site asks tools not to read it, so get Gradcracker or LinkedIn alerts for McLaren sent to the Nimbus inbox.",
    source: "https://racingcareers.mclaren.com/",
    checked: "2026-10-01",
  },
};
