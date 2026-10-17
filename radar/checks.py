"""Smoke checks for the radar's rules. No network, no database. Run from the repo root:

    .venv/Scripts/python.exe -m radar.checks

Prints only failures and a total; exits 1 if anything fails. Run after changing classify.py,
match.py, exclusions.py, the event readers or the website's preferences.ts / companies-data.ts."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from . import match as m
from .models import RawJob
from .notify.personal import event_type, format_match
from .notify.telegram import is_engineering
from .pipeline.classify import classify, disciplines_for, kind_for
from .pipeline.exclusions import excluded
from .sources import READERS
from .sources.event_tags import engineering_tags
from .sources.events import load as load_events
from .sources.inbox import jobs_from_email
from .sources.nhsjobs import jobs_from as nhs_jobs_from

ROOT = Path(__file__).resolve().parent.parent
ok = fail = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global ok, fail
    if cond:
        ok += 1
    else:
        fail += 1
        print(f"FAIL {name} {detail}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    # Opportunity types
    for title, kind in [
        ("Mechanical Engineering Placement 2027", "placement"), ("Summer Internship 2027 - Electrical", "internship"),
        ("Graduate Engineer Scheme 2027", "grad_scheme"), ("Spring Week 2027", "spring_week"),
        ("Degree Apprenticeship - Manufacturing", "apprenticeship"), ("Senior Mechanical Engineer", None),
        ("Early Careers Recruitment Manager", None), ("Summer Research Internship in Biochemistry", "research"),
        ("Staff Software Engineer", None),
    ]:
        check(f"kind {title}", kind_for(title) == kind, f"got {kind_for(title)}")
    check("hint intern", kind_for("Software Engineer, Payments", "Intern") == "internship")
    check("hint event", kind_for("Graduate Careers Fair (careers fair)", "event") == "event")

    # Subject tags
    for title, tag in [
        ("Mechanical Design Engineer Placement", "mechanical"), ("Biomedical Scientist Trainee", "biomedical"),
        ("Biochemistry Placement Year", "life_sciences"), ("Clinical Research Associate", "healthcare"),
        ("Marine Biology Summer Internship", "environmental"), ("Graduate Geotechnical Engineer", "civil"),
        ("FPGA Engineering Intern", "electrical"), ("NDT Inspector Apprentice", "materials"),
        ("Machine Learning Engineer Intern", "software"), ("Full Stack Developer Graduate", "software"),
        ("Graduate Engineer 2027", "engineering"), ("Technical Apprentice", "engineering"),
        ("Laboratory Assistant Placement", "science"),
    ]:
        check(f"tag {title}", tag in disciplines_for(title, ""), str(disciplines_for(title, "")))
    check("medical device is not healthcare", "healthcare" not in disciplines_for("Medical Device Quality Engineer", ""))
    check("sales stays business", disciplines_for("Sales Engineer Intern", "") == ["business"])

    # Never shown: defence, nuclear, weapons
    for company, title in [("BAE Systems", "Placement"), ("Airbus", "Intern"), ("Royal Navy", "Engineer Officer"),
                           ("Acme", "Weapons Systems Intern"), ("Abaco Systems", "Placement"), ("Martin-Baker", "Placement")]:
        check(f"excluded {company}/{title}", excluded(company, title))
    check("Rolls-Royce civil stays", not excluded("Rolls-Royce", "Civil Aerospace Placement"))

    # The website's lists, read by the radar (keys must stay quoted)
    src = (ROOT / "web" / "src" / "lib" / "onboarding-data.ts").read_text(encoding="utf-8")
    body = src[src.index("DEGREES_BY_FIELD"):src.index("DEGREE_NOTES")]
    degrees = [d for d in re.findall(r'"([^"]+)"', body) if d not in ("Medical and health",)]
    check("every degree has tags", all(d in m.DEGREE_DISCIPLINES for d in degrees), str([d for d in degrees if d not in m.DEGREE_DISCIPLINES]))
    check("types parsed", "Expo or careers fair" in m.TYPE_KINDS and m.TYPE_KINDS["Placement"] == ["placement"])
    check("companies directory parses", len(m.DIRECTORY) > 50, str(len(m.DIRECTORY)))

    # Matching (For you and personal Telegram)
    def row(kind, tags, country="GB", remote=False, title="x"):
        return {"kind": kind, "disciplines": tags, "country": country, "remote": remote, "title": title, "company_name": "x"}
    bio = m.with_defaults({"field": "Science", "degrees": ["Biomedical Science"]})
    mech = m.with_defaults({"field": "Engineering", "degrees": ["Mechanical Engineering"]})
    cs = m.with_defaults({"field": "Computing", "degrees": ["Data Science"], "types": ["Graduate scheme", "Summer internship", "Hackathon"]})
    fb, fm, fc = m.filters_for(bio), m.filters_for(mech), m.filters_for(cs)
    check("bio gets life sciences", m.is_match(row("placement", ["life_sciences"]), bio, fb))
    check("bio skips mechanical", not m.is_match(row("placement", ["mechanical"]), bio, fb))
    check("mech gets mechanical", m.is_match(row("placement", ["mechanical"]), mech, fm))
    check("mech gets generic engineering", m.is_match(row("placement", ["engineering"]), mech, fm))
    check("data science gets software grad scheme", m.is_match(row("grad_scheme", ["software"]), cs, fc))
    check("mech skips software", not m.is_match(row("placement", ["software"]), mech, fm))
    check("subject-free event for everyone", m.is_match(row("event", [], None, True), bio, fb) and m.is_match(row("event", [], None, True), mech, fm))
    check("lab expo only for science", m.is_match(row("event", ["life_sciences"]), bio, fb) and not m.is_match(row("event", ["life_sciences"]), mech, fm))
    check("abroad role hidden", not m.is_match(row("placement", ["mechanical"], "US"), mech, fm))
    check("typed degree uses field", "mechanical" in m.filters_for(m.with_defaults({"field": "Engineering", "degrees": ["Acoustical Engineering"]}))[1])

    # Shared channel: engineering and computing, not business
    check("channel takes engineering", is_engineering({"title": "Graduate Engineer", "disciplines": ["engineering"]}))
    check("channel takes software", is_engineering({"title": "Data Science Placement", "disciplines": ["software"]}))
    check("channel skips business", not is_engineering({"title": "Sales Intern", "disciplines": ["business"]}))

    # Readers registered
    for kind in ["workday", "greenhouse", "lever", "ashby", "smartrecruiters", "workable", "successfactors", "rss", "sitemap",
                 "adzuna", "inbox", "devpost", "mlh", "events", "nhsjobs"]:
        check(f"reader {kind}", kind in READERS)

    # Events list (data/seed/events.csv)
    events = load_events()
    check("events load", len(events) >= 1, str(len(events)))
    for e in events:
        o = classify(e)
        check(f"event classifies {e.title}", o is not None and o.kind == "event")
        check(f"event tags known {e.title}", all(t in m.DISCIPLINE_WORDS for t in e.raw["disciplines"]), str(e.raw["disciplines"]))
    check("event labels", event_type("Advanced Engineering 2026 (expo)") == "Expo" and event_type("DurHack") == "Hackathon")
    msg = format_match({"kind": "event", "title": "Lab Innovations 2026 (expo)", "company_name": "Lab Innovations", "location_text": "Birmingham",
                        "country": "GB", "closes_at": "2026-11-05T23:59:00+00:00", "disciplines": ["life_sciences"]}, "good", ["Life sciences in the title"])
    check("event alert wording", "Expo · ends 5 Nov" in msg, msg)
    check("hackathon tags", engineering_tags("Climate Hardware Hack") is not None and engineering_tags("Web3 Builders") is None)

    # Inbox: each job site's links (incl. Higherin's tracker in the path)
    for sender, html, n in [
        ("x@gradcracker.com", '<a href="https://www.gradcracker.com/hub/12/jcb/placement/345/design-engineer">Design Engineer Placement</a>', 1),
        ("alerts@notifications.higherin.com", '<a href="https://v6.r.eu-west-2.awstrack.me/L0/https:%2F%2Fhigherin.com%2Fjobs%2Fview%2Fmech-placement/1/x">Mechanical Placement 2027</a>', 1),
        ("jobalerts-noreply@linkedin.com", '<a href="https://www.linkedin.com/comm/jobs/view/4012345678/?trk=x">Graduate Mechanical Engineer</a>', 1),
        ("news@brightnetwork.co.uk", '<a href="https://www.brightnetwork.co.uk/graduate-jobs/acme/mechanical-placement-2027">Mechanical Placement 2027</a>', 1),
        ("a@accounts.google.com", '<a href="https://myaccount.google.com/x">Check activity</a>', 0),
        ("x@gradcracker.com", '<a href="https://www.gradcracker.com/unsubscribe">Unsubscribe</a>', 0),
    ]:
        got = jobs_from_email(sender, None, html)
        check(f"inbox {sender}", len(got) == n, f"{len(got)} jobs")

    # NHS Jobs result card
    card = ('data-test="search-result"><h2><a href="/candidate/jobadvert/E1-26-1?keyword=trainee" data-test="search-result-job-title">'
            ' Trainee Biomedical Scientist </a></h2><div data-test="search-result-location"><h3> NHS Trust <div class="location-font-size">'
            ' Leeds LS1 </div></h3></div><li data-test="search-result-closingDate"> Closing date: <strong> 31 October 2026 </strong></li>')
    nhs = nhs_jobs_from(card)
    check("nhs card parses", len(nhs) == 1 and nhs[0].title == "Trainee Biomedical Scientist" and nhs[0].company == "NHS Trust")
    check("nhs trainee kept", bool(nhs) and classify(nhs[0]) is not None)

    # Paid access, the same rules as web/src/lib/access.ts
    from datetime import datetime, timedelta, timezone
    from .notify.personal import TRIAL_ALERTS, access_state
    now = datetime.now(timezone.utc)
    later, earlier = (now + timedelta(days=1)).isoformat(), (now - timedelta(hours=1)).isoformat()
    check("admin always paid", access_state({"is_admin": True, "trial_ends_at": earlier}) == "paid")
    check("payer paid after trial", access_state({"paid_at": earlier, "trial_ends_at": earlier}) == "paid")
    check("trial while it lasts", access_state({"trial_ends_at": later}) == "trial")
    check("locked after trial", access_state({"trial_ends_at": earlier}) == "locked" and access_state({}) == "locked")
    check("trial alerts match the site's 5 jobs", TRIAL_ALERTS == 5)

    # Personal alerts: facts, not a made-up %, and each role once (owner, 17 Oct)
    from .notify.personal import is_repeat, same_role_key
    from .sources.inbox import SITES as INBOX_SITES
    from .sources.inbox import _company_from
    check("post production is not manufacturing", "manufacturing" not in disciplines_for("Post Production Technology Internship 2027", ""))
    check("factory production stays", "manufacturing" in disciplines_for("Industrial Placement - Production", ""))
    check("materials management is not materials", "materials" not in disciplines_for("Intern - Materials Management Analyst", ""))
    check("a document isn't materials", "materials" not in disciplines_for("Evidence Intern: Reviewing Fragmented Antimicrobial Material", ""))
    check("materials specialist stays", "materials" in disciplines_for("Summer Internship - Materials Specialist", ""))
    check("data automation is not robotics", "robotics" not in disciplines_for("Data Management & Automation Intern", ""))
    check("automation engineer is robotics", "robotics" in disciplines_for("Automation Engineer Placement", ""))
    check("test automation is not robotics", "robotics" not in disciplines_for("Test Automation Engineer Intern", ""))
    check("software society hackathon not mechanical", "mechanical" not in (engineering_tags("Society of Software Engineers Halloween Hackathon") or []))
    check("engineering hackathon still tagged", "mechanical" in (engineering_tags("Engineering Design Hackathon") or []))
    check("defence sponsor in a title excluded", excluded("Nanyang Technological University", "NTU x ST Engineering Hackathon"))
    bright = next(s for s in INBOX_SITES if s.name == "Bright Network")
    check("IT support is not engineering", disciplines_for("IT Support Engineer Internship 2026", "") == ["software"])
    check("insurance technician is business", "engineering" not in disciplines_for("Graduate Placement Support Technician - Insurance Broking", ""))
    higherin = next(s for s in INBOX_SITES if s.name == "Higherin")
    check("higherin employer", (_company_from("https://higherin.com/jobs/46073/mercedes-amg-high-performance-powertrains-ltd/hse-placement-2027", higherin) or "").startswith("Mercedes Amg"))
    check("bright network employer", _company_from("https://www.brightnetwork.co.uk/graduate-jobs/bmw/production-data-scientist-internship-oxford-2027-apk1", bright) == "BMW")
    check("same role from two places", is_repeat(same_role_key({"title": "Industrial Placement Vehicle Motion 2027", "company_name": "via Bright Network"}),
                                                  [same_role_key({"title": "Industrial Placement - Vehicle Motion", "company_name": "Bentley Motors Ltd"})]))
    check("same company, suffix differs", is_repeat(same_role_key({"title": "Powertrain Calibration Support Intern", "company_name": "Bosch"}),
                                                    [same_role_key({"title": "Powertrain Calibration Support Intern", "company_name": "Bosch Group"})]))
    check("same title, other employer is new", not is_repeat(same_role_key({"title": "Mechanical Engineering Industrial Placement", "company_name": "Cummins"}),
                                                             [same_role_key({"title": "Mechanical Engineering Industrial Placement", "company_name": "Phillips 66"})]))
    mech = m.with_defaults({"field": "Engineering", "degrees": ["Mechanical Engineering"], "types": ["Placement"], "sectors": ["Automotive"]})
    fm = m.filters_for(mech)
    jlr = {"title": "Industrial Placement 2027: Mechanical", "company_name": "Jaguar Land Rover", "kind": "placement", "disciplines": ["mechanical"],
           "skills": ["CAD", "MATLAB"], "country": "GB"}
    level, ticks, _ = m.fit(jlr, mech, fm, ["CAD", "MATLAB"])
    check("fit: top with ticks", level == "top" and ticks[0] == "Mechanical in the title" and "Placement" in ticks and "CAD, MATLAB on your CV" in ticks, f"{level} {ticks}")
    level, ticks, _ = m.fit({**jlr, "title": "Placement Student - Quality", "disciplines": ["engineering"], "skills": [], "company_name": "Acme Ltd"}, mech, fm, [])
    check("fit: generic engineering is worth a look", level == "look" and ticks[0] == "Engineering role", f"{level} {ticks}")
    check("fit: other subject is no fit", m.fit({**jlr, "title": "Cyber Security Placement", "disciplines": ["software"]}, mech, fm, [])[0] is None)
    msg = format_match({**jlr, "posted_at": None, "first_seen_at": "2026-10-17T09:00:00+00:00", "apply_url": "https://example.com"}, "top", ["Mechanical in the title", "Placement"])
    check("alert shows ticks, no %", "Top match" in msg and "✓ Mechanical in the title" in msg and "%" not in msg, msg)

    print(f"{ok} passed, {fail} failed")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
