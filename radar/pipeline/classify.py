"""Rule-based classification. Cheap and runs on every job; the AI only looks at what rules can't settle."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone

from ..geo import first_city, guess_country
from ..models import Opportunity, RawJob
from .exclusions import excluded, excluded_company, excluded_title


def _rx(*patterns: str) -> re.Pattern:
    return re.compile("|".join(patterns), re.I)


# Checked in order; the first match wins
KIND_RULES: list[tuple[str, re.Pattern]] = [
    ("spring_week", _rx(r"\bspring (week|insight|programme|program)\b")),
    ("insight", _rx(
        r"\binsight (day|days|week|programme|program|event)\b", r"\bdiscover(y)?\b.*\b(day|event|scenes)\b",
        r"\bopen day\b", r"\btaster\b", r"\bwork experience\b", r"\bbehind the scenes\b",
    )),
    ("scholarship", _rx(r"\bscholarships?\b", r"\bbursar(y|ies)\b", r"\bsponsored degree\b", r"\bsponsorship programme\b")),
    ("research", _rx(
        r"\bresearch (intern|internship|placement|assistant|student|associate)\b", r"\bsummer research\b",
        r"\bphd\b", r"\bstudentships?\b", r"\bdoctoral\b", r"\bktp associate\b",
    )),
    ("internship", _rx(
        r"\bintern(ship)?s?\b", r"\bsummer (placement|student|programme|program)\b",
        r"\bvacation (scheme|placement|student)\b", r"\bworking student\b", r"\bwerkstudent\b",
        # French "stage" only with French around it: "Stage Test Engineer" is a rocket stage
        r"\bco-?op\b", r"\bstagiaire\b", r"\bstage (ingénieur|de fin|en |d'été|h/f)", r"\bpraktikum\b",
    )),
    ("placement", _rx(
        r"\bplacements?\b", r"\byear in industry\b", r"\bindustrial (trainee|year)\b", r"\bsandwich\b",
        r"\bundergraduate\b", r"\bplacement student\b", r"\bstudent (engineer|position|role)\b",
    )),
    ("apprenticeship", _rx(r"\bapprentice(ship)?s?\b", r"\bausbildung\b", r"\bduales studium\b", r"\bdual study\b")),
    ("grad_scheme", _rx(
        r"\bgraduate (scheme|programme|program|development|trainee|leadership|engineer)\b",
        r"\bgraduate\b.*\b(engineer|scientist|analyst)\b", r"\b(engineer|scientist|analyst)\b.*\bgraduate\b",
        r"\bgrad scheme\b", r"\bnew grad\b", r"\bearly careers? graduate\b", r"\baggp\s?20\d\d\b",
    )),
    ("graduate_job", _rx(r"\bgraduate\b", r"\bentry[- ]level\b")),
]

# Titles that mention early careers but are really staff roles (recruiters, managers of programmes)
STAFF_ROLE = _rx(
    r"\bsenior\b", r"\bprincipal\b", r"\bhead of\b", r"\bdirector\b", r"\brecruit(er|ment|ing)\b",
    r"\bmanager\b", r"\bcoordinator\b", r"\bdelivery lead\b", r"\bpartner\b", r"\bprofessor\b", r"\blecturer\b",
    r"\bstaff\b", r"\blead (engineer|scientist|developer)\b", r"\btalent sourcer\b", r"\bpostdoc", r"\bpost-doctoral\b",
)

# Hints some hiring systems give in their own fields (employment type, experience level)
HINT_KINDS = {"intern": "internship", "internship": "internship", "apprentice": "apprenticeship", "graduate": "grad_scheme"}

DISCIPLINES: dict[str, re.Pattern] = {
    "mechanical": _rx(r"\bmechanical\b", r"\bmech\b", r"\bdesign engineer", r"\bstress\b", r"\bthermo", r"\bfluids?\b"),
    "manufacturing": _rx(
        r"\bmanufactur", r"\bproduction\b", r"\bindustrial engineer", r"\bprocess engineer", r"\blean\b",
        r"\bquality engineer", r"\boperations engineer",
    ),
    "robotics": _rx(
        r"\brobot", r"\bautomation\b", r"\bmechatronic", r"\bcontrol (systems?|engineer)", r"\bcontrols engineer",
        r"\bautonom", r"\bgnc\b",
    ),
    "electrical": _rx(r"\belectrical\b", r"\belectronic", r"\bpower systems\b", r"\bembedded\b", r"\bfirmware\b", r"\bhardware\b"),
    "aerospace": _rx(r"\baerospace\b", r"\baeronautic", r"\baircraft\b", r"\bpropulsion\b", r"\bgas turbine", r"\bavionic"),
    "automotive": _rx(r"\bautomotive\b", r"\bvehicle\b", r"\bpowertrain\b", r"\bchassis\b", r"\bmotorsport\b"),
    "materials": _rx(r"\bmaterials?\b", r"\bmetallurg", r"\bcomposites?\b"),
    "civil": _rx(r"\bcivil\b", r"\bstructural\b"),
    "chemical": _rx(r"\bchemical\b", r"\bchemistry\b"),
    "nuclear": _rx(r"\bnuclear\b", r"\bfusion\b"),
    "software": _rx(r"\bsoftware\b", r"\bdata\b", r"\bcomputer science\b", r"\bdeveloper\b", r"\bcyber\b"),
    "business": _rx(
        r"\bfinance\b", r"\bcommercial\b", r"\bprocurement\b", r"\bsupply chain\b", r"\bhuman resources\b",
        r"\bhr\b", r"\bmarketing\b", r"\bsales\b", r"\bbusiness (development|support|analyst|management)\b",
        r"\bpublic affairs\b", r"\bcompliance\b", r"\bproject management\b", r"\btreasury\b", r"\btrading\b",
        r"\bquant", r"\binvestment\b", r"\baudit\b", r"\btax\b", r"\baccount(ing|ancy)\b", r"\blegal\b",
        r"\boperations associate\b", r"\bconsult(ant|ing)\b", r"\bcrypto\b",
    ),
    # Not engineering at all: keeps these out of every engineering student's For you
    "creative": _rx(
        r"\bgraphic design", r"\bbrand\b", r"\bsocial media\b", r"\bcontent\b", r"\bwriters?\b", r"\bjournalis",
        r"\bcopywrit", r"\bvideo\b", r"\bphotograph", r"\bevent (producer|planner|coordinator)\b", r"\bcommunications\b",
    ),
}

# The description is only trusted with stricter wording, and only for titles that sound technical;
# otherwise company blurbs ("marketing materials", "we manufacture...") tag every job
DESCRIPTION_DISCIPLINES: dict[str, re.Pattern] = {
    "mechanical": _rx(r"\bmechanical engineering\b", r"\bmechanical engineer\b", r"\bmechanical design\b"),
    "manufacturing": _rx(
        r"\bmanufacturing engineer", r"\bproduction engineer", r"\bprocess engineer", r"\blean manufacturing\b",
        r"\bindustrial engineering\b",
    ),
    "robotics": _rx(r"\brobotics\b", r"\bmechatronics\b", r"\bcontrol systems\b"),
    "electrical": _rx(r"\belectrical engineering\b", r"\belectronic engineering\b", r"\belectrical engineer\b", r"\bembedded systems\b"),
    "aerospace": _rx(r"\baerospace engineering\b", r"\baeronautical\b", r"\bpropulsion\b", r"\bavionics\b"),
    "automotive": _rx(r"\bautomotive engineering\b", r"\bvehicle dynamics\b", r"\bpowertrain\b", r"\bmotorsport\b"),
    "materials": _rx(r"\bmaterials (science|engineering|engineer|scientist)\b", r"\bmetallurg", r"\bcomposites\b"),
    "civil": _rx(r"\bcivil engineering\b", r"\bstructural engineering\b"),
    "chemical": _rx(r"\bchemical engineering\b", r"\bprocess chemistry\b"),
    "software": _rx(r"\bsoftware engineering\b", r"\bsoftware developer\b", r"\bcomputer science\b"),
}
TECHNICAL_TITLE = _rx(
    r"\bengineer", r"\btechnical\b", r"\btechnician\b", r"\bscientist\b", r"\bresearch\b", r"\br&d\b", r"\blab\b",
    r"\btest\b", r"\bdesign\b(?! intern)", r"\bstem\b", r"\bscience\b",
)

SKILLS: dict[str, re.Pattern] = {
    "CAD": _rx(r"\bcad\b"),
    "SolidWorks": _rx(r"\bsolid ?works\b"),
    "CATIA": _rx(r"\bcatia\b"),
    "Siemens NX": _rx(r"\bsiemens nx\b", r"\bunigraphics\b", r"\bnx cad\b"),
    "Creo": _rx(r"\bcreo\b"),
    "AutoCAD": _rx(r"\bautocad\b"),
    "Inventor": _rx(r"\bautodesk inventor\b"),
    "Fusion 360": _rx(r"\bfusion 360\b"),
    "FEA": _rx(r"\bfea\b", r"\bfinite element"),
    "ANSYS": _rx(r"\bansys\b"),
    "Abaqus": _rx(r"\babaqus\b"),
    "CFD": _rx(r"\bcfd\b", r"\bcomputational fluid"),
    "MATLAB": _rx(r"\bmatlab\b"),
    "Simulink": _rx(r"\bsimulink\b"),
    "Python": _rx(r"\bpython\b"),
    "C++": _rx(r"\bc\+\+"),
    "LabVIEW": _rx(r"\blabview\b"),
    # Not bare "PLC": that's also a company suffix ("Man Group plc")
    "PLC": _rx(r"\bplcs\b", r"\bplc (programming|control|systems?|software|logic)\b", r"\bprogrammable logic"),
    "CNC / Machining": _rx(r"\bcnc\b", r"\bmachining\b"),
    "Lean": _rx(r"\blean\b"),
    "Six Sigma": _rx(r"\bsix sigma\b"),
    "GD&T": _rx(r"\bgd&t\b", r"\bgeometric dimensioning"),
    "FMEA": _rx(r"\b(d|p)?fmea\b"),
    "Additive manufacturing": _rx(r"\badditive manufactur", r"\b3d print"),
    "ROS": _rx(r"\bros2?\b"),
}

ROLLING = _rx(
    r"rolling basis", r"close (early|before)", r"closed early", r"may close", r"apply early",
    r"as soon as possible", r"reserve the right to close",
)
CLOSING = re.compile(
    r"clos(?:ing|es)(?: date)?(?: is| on)?[:\s]+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\s+(\d{4})", re.I
)


def _kind(title: str, hint: str | None) -> str | None:
    for kind, pattern in KIND_RULES:
        if pattern.search(title):
            return kind
    if hint:
        # Whole words only: "Internal" and "International" are not internships
        for word, kind in HINT_KINDS.items():
            if re.search(rf"\b{word}\b", hint, re.I):
                return kind
    return None


def _hint(job: RawJob) -> str | None:
    return " ".join(str(v) for k, v in job.raw.items() if k in ("employmentType", "commitment", "experience", "employment") and v) or None


def is_candidate(job: RawJob) -> bool:
    """Cheap title-only check, used before fetching full descriptions."""
    if excluded_company(job.company) or excluded_title(job.title):
        return False
    return _kind(job.title, _hint(job)) is not None and not STAFF_ROLE.search(job.title)


def _closing_date(text: str) -> datetime | None:
    match = CLOSING.search(text)
    if not match:
        return None
    day, month, year = match.groups()
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(f"{day} {month} {year}", fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def fingerprint(company: str, title: str, place: str) -> str:
    key = "|".join(_norm(v) for v in (company, title, place))
    return hashlib.sha1(key.encode()).hexdigest()


def disciplines_for(title: str, description: str) -> list[str]:
    """From the title when it names a field; otherwise from the description's own wording (said at
    least twice), and only when the title sounds technical."""
    found = [name for name, pattern in DISCIPLINES.items() if pattern.search(title)]
    if found or not TECHNICAL_TITLE.search(title):
        return found
    return [name for name, pattern in DESCRIPTION_DISCIPLINES.items() if len(pattern.findall(description)) >= 2]


def kind_for(title: str, hint: str | None = None) -> str | None:
    """The opportunity type, or None for roles that aren't for students (senior, staff, managers)."""
    if STAFF_ROLE.search(title):
        return None
    return _kind(title, hint)


def classify(job: RawJob) -> Opportunity | None:
    kind = _kind(job.title, _hint(job))
    if kind is None or STAFF_ROLE.search(job.title) or excluded(job.company, job.title, job.description):
        return None

    disciplines = disciplines_for(job.title, job.description)
    skills = [name for name, pattern in SKILLS.items() if pattern.search(f"{job.title} {job.description}")]
    country = job.country or guess_country(job.location) or guess_country(job.description[:500])
    city = first_city(job.location)

    return Opportunity(
        fingerprint=fingerprint(job.company, job.title, city or job.location),
        company=job.company,
        title=job.title,
        kind=kind,
        apply_url=job.url,
        source_kind=job.source_kind,
        location=job.location,
        country=country,
        city=city,
        remote=job.remote,
        disciplines=disciplines,
        skills=skills,
        description=job.description[:6000],
        posted_at=job.posted_at,
        closes_at=job.closes_at or _closing_date(job.description),
        rolling=True if ROLLING.search(job.description) else None,
        raw=job.raw,
    )
