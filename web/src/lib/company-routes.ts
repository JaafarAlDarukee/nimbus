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
  "Toyota UK": {
    careers: "https://recruitment.toyotauk.com/university-placements/",
    how: "11-month industrial placements at Burnaston and Deeside, engineering and non-engineering. Apply with the online application form on their recruitment site; they don't publish an email, but the page has a sign-up form for alerts.",
    opens: "October to December",
    opensMonth: 10,
    source: "https://recruitment.toyotauk.com/university-placements/",
    checked: "2026-10-01",
  },
  "National Grid": {
    careers: "https://jobs.nationalgrid.com",
    how: "12-month industrial placements and 12-week summer internships for undergraduates, on their own jobs site. Their site blocks automated reading, so set up Gradcracker or RateMyPlacement alerts for National Grid to the Nimbus inbox.",
    source: "https://jobs.nationalgrid.com",
    checked: "2026-10-01",
  },
  "Network Rail": {
    careers: "https://www.earlycareers.networkrail.co.uk/programme/undergraduate-schemes/",
    how: "Year-long and summer placements through their early-careers site: a short Match-me quiz, then an online application form.",
    source: "https://www.earlycareers.networkrail.co.uk/application-process-and-advice/applying-for-a-graduate-scheme-or-undergraduate-placement/",
    checked: "2026-10-01",
  },
  AstraZeneca: {
    careers: "https://astrazeneca.wd3.myworkdayjobs.com/Emerging-Talent",
    how: "University Industrial Placement Students (12 months) are posted on their Emerging Talent board, which Nimbus watches. This year's opened on 4 September and some closed within a month, so apply early.",
    opens: "Early September",
    opensMonth: 9,
    source: "https://astrazeneca.wd3.myworkdayjobs.com/Emerging-Talent",
    checked: "2026-10-01",
  },
  Dyson: {
    careers: "https://careers.dyson.com/early-careers",
    how: "Placements and internships are posted on their Workday site, which Nimbus watches. School leavers and undergraduates can also apply to the Dyson Institute, a paid engineering degree at Malmesbury.",
    source: "https://dyson.wd3.myworkdayjobs.com/dyson_careers",
    checked: "2026-10-01",
  },
  "Mercedes-AMG Petronas F1": {
    careers: "https://www.mercedesamgf1.com/careers",
    how: "Placements, graduate roles and apprenticeships are posted on their Workday graduate and undergraduate board, which Nimbus watches. Nothing is open right now; you'll be told the moment something is.",
    source: "https://mbgp.wd3.myworkdayjobs.com/Mercedes-AMGF1-Grad-Ugrad",
    checked: "2026-10-01",
  },
};
