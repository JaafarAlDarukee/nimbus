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
    check("mech gets the channel's computing roles", m.is_match(row("placement", ["software"]), mech, fm))
    check("mech skips nursing", not m.is_match(row("placement", ["healthcare"]), mech, fm))
    check("subject-free event for everyone", m.is_match(row("event", [], None, True), bio, fb) and m.is_match(row("event", [], None, True), mech, fm))
    check("lab expo only for science", m.is_match(row("event", ["life_sciences"]), bio, fb) and not m.is_match(row("event", ["life_sciences"]), mech, fm))
    check("UK and Ireland only, whatever was picked before", m.filters_for(m.with_defaults({"abroad": ["Worldwide", "Germany"]}))[2] == {"GB", "IE"})
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
                        "country": "GB", "closes_at": "2026-11-05T23:59:00+00:00", "disciplines": ["life_sciences"]}, ["Life sciences in the title"])
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
    check("broadcast engineer is still engineering", "engineering" in disciplines_for("Graduate Broadcast Engineer - Support", ""))
    check("theatre design stays creative", disciplines_for("Graduate Audiovisual & Theatre Design", "") == ["creative"])
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
    from .models import RawJob
    bae = classify(RawJob(company="BAE Systems", title="Undergraduate Structural Engineer 2027", url="https://example.com/b", source_kind="inbox", location="Barrow"))
    check("defence roles kept with a flag", bae is not None and bae.defence)
    civil = classify(RawJob(company="Rolls-Royce", title="Civil Aerospace Placement 2027", url="https://example.com/r", source_kind="workday", location="Derby"))
    check("civil roles not flagged", civil is not None and not civil.defence)
    mech_d = m.with_defaults({"field": "Engineering", "degrees": ["Mechanical Engineering"]})
    flagged = {"kind": "placement", "disciplines": ["engineering"], "country": "GB", "title": "Undergraduate Structural Engineer", "company_name": "BAE Systems", "defence": True}
    check("defence hidden unless turned on", not m.is_match(flagged, mech_d, m.filters_for(mech_d)) and m.is_match(flagged, {**mech_d, "defence": True}, m.filters_for(mech_d)))
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
    check("near-identical title at the same employer is the same role",
          is_repeat(same_role_key({"title": "Manufacturing Engineering (12 Month Placement Scheme)", "company_name": "Caterpillar Uk Ltd"}),
                    [same_role_key({"title": "12 Month Industrial Placement Scheme - Manufacturing Engineering - Technical Services", "company_name": "Caterpillar"})]))
    check("different roles at one employer stay apart",
          not is_repeat(same_role_key({"title": "Summer Internship 2027 - Mechanical Engineer - London", "company_name": "Arup"}),
                        [same_role_key({"title": "Summer Internship 2027 - Mechanical Engineer - Manchester", "company_name": "Arup"})]))
    from .sources.inbox import REMINDER_SUBJECT
    check("reminder emails spotted", all(REMINDER_SUBJECT.search(s) for s in ["Closing soon: 12 placements", "Last chance to apply", "Deadlines this week"])
          and not any(REMINDER_SUBJECT.search(s) for s in ["New engineering jobs for you", "3 new placements match your alert"]))
    check("same title, other employer is new", not is_repeat(same_role_key({"title": "Mechanical Engineering Industrial Placement", "company_name": "Cummins"}),
                                                             [same_role_key({"title": "Mechanical Engineering Industrial Placement", "company_name": "Phillips 66"})]))
    mech = m.with_defaults({"field": "Engineering", "degrees": ["Mechanical Engineering"], "types": ["Placement"], "sectors": ["Automotive"]})
    fm = m.filters_for(mech)
    check("every type shows", {"placement", "apprenticeship", "grad_scheme", "graduate_job", "event"} <= fm[0])
    check("the whole field shows, plus the channel's computing and science", {"chemical", "civil", "electrical", "engineering", "software", "science"} <= fm[1] and "healthcare" not in fm[1])
    jlr = {"id": "abc", "title": "Industrial Placement 2027: Mechanical", "company_name": "Jaguar Land Rover", "kind": "placement",
           "disciplines": ["mechanical"], "skills": ["CAD", "MATLAB"], "country": "GB", "apply_url": "https://example.com"}
    rank, ticks, _ = m.fit(jlr, mech, fm)
    check("fit: your degree in the title", rank == 2 and ticks[0] == "Mechanical in the title" and not any("CV" in t for t in ticks), f"{rank} {ticks}")
    check("fit: another subject in your field", m.fit({**jlr, "title": "Chemical Engineer Placement", "disciplines": ["chemical"], "company_name": "Acme Ltd"}, mech, fm)[1][0] == "Chemical engineering")
    rank, ticks, _ = m.fit({**jlr, "title": "Placement Student - Quality", "disciplines": ["engineering"], "company_name": "Acme Ltd"}, mech, fm)
    check("fit: general engineering role", rank == 0 and ticks[0] == "Engineering role", f"{rank} {ticks}")
    from .notify.personal import wanted
    from .notify.telegram import ALERT_COUNTRIES
    channel_rows = [{**jlr, "title": "Software Developer Graduate", "kind": "graduate_job", "disciplines": ["software"]},
                    {**jlr, "title": "Research & Development Placement", "disciplines": ["science"]},
                    {**jlr, "title": "Design Intern", "kind": "internship", "disciplines": []},
                    {**jlr, "title": "Mechanical Engineering Placement", "country": "IE"}]
    check("the bot gets everything the channel posts", all(wanted(r, mech, fm) for r in channel_rows if r.get("country") in ALERT_COUNTRIES and is_engineering(r)))
    from .notify.telegram import LIST_CHARS, role_lists
    many = [{**jlr, "id": str(i), "title": f"Graduate Engineer {i} " + "x" * 60, "apply_url": "https://example.com/" + "y" * 120} for i in range(100)]
    packed = role_lists("🌍 <b>100 new roles abroad</b>", many)
    check("channel lists keep every role and fit Telegram", sum(m.count("\n• ") for m in packed) == 100 and all(len(m) <= LIST_CHARS for m in packed), str([len(m) for m in packed]))
    from .notify.telegram import fields_for
    check("embedded software goes to engineering and computing", fields_for({"disciplines": ["electrical", "software"]}) == {"engineering", "computing"})
    check("nursing goes to medical only", fields_for({"disciplines": ["healthcare"]}) == {"medical"})
    check("chemistry goes to engineering and science", fields_for({"disciplines": ["chemical"]}) == {"engineering", "science"})
    check("no subject: main channel only", fields_for({"disciplines": []}) == set())
    from .notify import telegram as tg
    delivered: list[str] = []
    real_send, real_pause = tg._send, tg.PAUSE
    tg._send, tg.PAUSE = (lambda client, token, chat, text, url=None: delivered.append(chat) or True), 0
    try:
        count = tg._deliver(None, "t", {"main": [("a", None)] * 3, "eng": [("b", None)] * 2, "empty": []})
    finally:
        tg._send, tg.PAUSE = real_send, real_pause
    uk = {**jlr, "id": "uk", "country": "GB", "title": "Mechanical Engineering Placement", "disciplines": ["mechanical"]}
    us = {**uk, "id": "us", "country": "US"}
    nurse = {**uk, "id": "nhs", "title": "Trainee Nurse", "disciplines": ["healthcare"], "country": "IE"}
    box = tg.channel_outbox([uk, us, nurse, {**uk, "id": "bae", "defence": True}], "main", {"eng": "engineering", "med": "medical"})
    check("channels: UK and Ireland only, nothing abroad", len(box["main"]) == 2 and len(box["eng"]) == 1 and len(box["med"]) == 1
          and not any("abroad" in text or "US" in text for messages in box.values() for text, _ in messages), str({k: len(v) for k, v in box.items()}))
    check("every channel's messages delivered, taking turns", count == 5 and delivered.count("main") == 3 and delivered[:2] in (["main", "eng"], ["eng", "main"]), str(delivered))
    check("muted employers stay muted", not wanted({**channel_rows[3], "company_name": "Muted Co"}, {**mech, "muted": ["Muted Co"]}, fm))
    check("apprenticeships reach a mechanical student", m.is_match({**jlr, "kind": "apprenticeship", "title": "Engineering Apprentice", "disciplines": ["engineering"]}, mech, fm))
    msg = format_match({**jlr, "posted_at": None, "first_seen_at": "2026-10-17T09:00:00+00:00"}, ["Mechanical in the title"])
    check("alert: type on top, ticks, no score", msg.startswith("🟦 <b>PLACEMENT</b>") and "✓ Mechanical in the title" in msg and "%" not in msg and "match" not in msg.lower(), msg)
    from .notify.personal import _buttons
    check("alert opens Nimbus first", _buttons(jlr)["inline_keyboard"][0][0]["url"].endswith("/?open=abc"))

    print(f"{ok} passed, {fail} failed")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
