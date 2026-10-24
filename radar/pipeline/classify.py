"""Rule-based classification. Cheap and runs on every job; the AI only looks at what rules can't settle."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone

from ..geo import first_city, guess_country
from ..models import Opportunity, RawJob
from .exclusions import excluded


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
    # "Staff Engineer" is senior; an NHS "Staff Nurse" is a newly qualified nurse
    # Schemes for service leavers and career returners, not students
    r"\barmed forces\b", r"\bservice leavers?\b", r"\b(career )?returners?\b",
    r"\bstaff (engineer|scientist|developer|software|data|accountant|product)", r"\blead (engineer|scientist|developer)\b", r"\btalent sourcer\b", r"\bpostdoc", r"\bpost-doctoral\b",
)

# Hints some hiring systems give in their own fields (employment type, experience level)
HINT_KINDS = {"intern": "internship", "internship": "internship", "apprentice": "apprenticeship", "graduate": "grad_scheme",
              "hackathon": "event", "event": "event"}
# Readers of event listings (Devpost, MLH, data/seed/events.csv) say so outright: a careers fair
# titled "Graduate Fair" is still an event, not a graduate job
EVENT_HINTS = {"hackathon", "event"}

DISCIPLINES: dict[str, re.Pattern] = {
    "mechanical": _rx(
        r"\bmechanical\b", r"\bmech\b", r"\bdesign engineer", r"\bstress\b", r"\bthermo", r"\bfluids?\b", r"\bhvac\b",
        r"\bcfd\b", r"(?<!search )(?<!game )(?<!games )(?<!rules )(?<!query )\bengines?\b(?! optimi)", r"\bsimulation\b",
    ),
    "manufacturing": _rx(
        # "production" in the factory sense, not TV or film ("Post Production", "Production Assistant")
        r"\bmanufactur", r"(?<!post )(?<!post-)\bproduction\b(?! (assistant|runner|coordinator|company|data))", r"\bindustrial engineer", r"\bprocess engineer", r"\blean\b",
        r"\bquality engineer", r"\boperations engineer", r"\bcalibration\b", r"\bmetrolog", r"\bmaintenance engineer",
        r"\bcontinuous improvement\b", r"\boperational excellence\b", r"\bmachining\b", r"\bcnc\b", r"\badditive\b",
        r"\bpowder bed\b", r"\blmd\b", r"\bfabricat", r"\btooling\b",
    ),
    "robotics": _rx(
        # Automation of machines, not of data or tests ("Data Management & Automation Intern")
        r"\brobot", r"\b(industrial|robotics?|factory|manufacturing|controls?|plc|process|electrical|building|warehouse) automation\b",
        r"(?<!test )(?<!& )(?<!and )\bautomation (engineer\w*|technician|intern\w*|placement|apprentic\w*|graduate)", r"^automation\b",
        r"[-–:|]\s*automation\b",
        r"\bmechatronic", r"\bcontrol (systems?|engineer)", r"\bcontrols engineer",
        r"\bautonom", r"\bgnc\b",
    ),
    "electrical": _rx(
        r"\belectrical\b", r"\belectronic", r"\bpower systems\b", r"\bembedded\b", r"\bfirmware\b", r"\bhardware\b",
        r"\bhigh voltage\b", r"\bprotection (and|&) control\b", r"\bfpga\b", r"\bsemiconductor", r"\bpcb\b", r"\brf engineer",
        r"\bsignal processing\b", r"\belectrification\b", r"\bsilicon\b", r"\basic\b", r"\bdesign verification\b", r"\bvlsi\b", r"\brtl\b",
        r"\bmixed[- ]signal\b", r"\banalog(ue)? (design|ic|circuit|engineer\w*)",
    ),
    "aerospace": _rx(r"\baerospace\b", r"\baeronautic", r"\baircraft\b", r"\bpropulsion\b", r"\bgas turbine", r"\bavionic"),
    "automotive": _rx(r"\bautomotive\b", r"\bvehicle\b", r"\bpowertrain\b", r"\bchassis\b", r"\bmotorsport\b"),
    "materials": _rx(
        # Materials science, not stock ("Materials Management Analyst") or a document ("Antimicrobial Material")
        r"\bmaterials\b(?! (management|handl\w*|planner|planning|controller|coordinator|buyer|purchas\w*|supply))",
        r"\bmaterial (science|scientist|engineer\w*|testing|characteri[sz]ation|development)\b", r"\bmetallurg", r"\bcomposites?\b", r"\bndt\b", r"\bnon-destructive\b", r"\bpolymer",
        r"\bcorrosion\b", r"\bwelding\b",
    ),
    "civil": _rx(r"\bcivil\b", r"\bstructural\b", r"\bstructures\b", r"\bgeotechnic", r"\bsoils?\b", r"\bdams?\b",
                 r"\binfrastructure engineer", r"\bwater engineer"),
    "chemical": _rx(r"\bchemical\b", r"\bchemistry\b", r"\bprocess safety\b"),
    "nuclear": _rx(r"\bnuclear\b", r"\bfusion\b"),
    "software": _rx(
        r"\bsoftware\b", r"\bdata\b", r"\bcomputer science\b", r"\bcomputing\b", r"\bdeveloper\b", r"\bprogrammer\b", r"\bcyber\b",
        r"\bmachine learning\b", r"\bdeep learning\b", r"\b(ai|ml|llms?|nlp)\b", r"\bcomputer vision\b", r"\bdevops\b",
        r"\bfull[- ]?stack\b", r"\bfront[- ]?end\b", r"\bback[- ]?end\b", r"\bcloud\b", r"\bsite reliability\b", r"\bsre\b",
        r"\bweb\b", r"\bmobile\b", r"\bios\b", r"\bandroid\b", r"\bplatform engineer", r"\btechnology (graduate|analyst|programme|intern)",
        r"\binformation security\b", r"\btest automation\b", r"\bgames? (developer|programmer)\b",
        r"\bit (support|service\w*|technician|engineer\w*|infrastructure|helpdesk)\b", r"\b(compiler|helpdesk|service desk)\b",
    ),
    # Science and health, for students outside engineering (Biomedical Science, Medicine, Marine Biology...)
    "biomedical": _rx(
        r"\bbiomedical\b", r"\bmedical (device|technolog|engineer|physics|imaging)", r"\bmedtech\b", r"\bclinical engineer",
        r"\bhealthcare science\b", r"\bprosthet", r"\borthot", r"\bdiagnostic", r"\bbioengineer", r"\bbiomaterial",
    ),
    "life_sciences": _rx(
        r"\bbio(logy|logical|logist|logics|chem\w*|tech\w*|pharma\w*|process\w*|informatic\w*|science\w*)\b", r"\bmicrobio",
        r"\bgenetic", r"\bgenomic", r"\bmolecular\b", r"\bcell (biology|culture|therapy|line)", r"\bimmuno", r"\bpharmacolog",
        r"\bpharmaceutical", r"\bdrug (discovery|development|safety|substance|product)", r"\bneuroscien", r"\btoxicolog",
        r"\bvirolog", r"\bproteins?\b", r"\bvaccines?\b", r"\blife sciences?\b", r"\blab(oratory)? (scientist|technician|analyst)",
        r"\bformulation\b", r"\bforensic", r"\bfood scien",
    ),
    "healthcare": _rx(
        r"\bclinical\b", r"\bclinicians?\b", r"\bmsk\b", r"\baudiolog", r"\bhealth screen", r"\bwellbeing\b", r"\bpractitioners?\b",
        r"\btherapists?\b", r"\bmental health\b", r"\bcwp\b", r"\bpharmac(y|ist)\b", r"\bnurs(e|es|ing)\b", r"\bmedic(al|ine)\b(?! (device|technolog|engineer|physics|imaging))", r"\bnhs\b", r"\bhealth ?care\b",
        r"\bpatients?\b", r"\bphysiotherap", r"\bradiograph", r"\bdental\b", r"\bdentist", r"\bveterinar", r"\bmidwi",
        r"\boptometr", r"\bparamedic", r"\bpsycholog", r"\bpublic health\b", r"\bdigital health\b", r"\boccupational therap",
        r"\bdietit", r"\bnutrition", r"\bspeech and language\b", r"\bsports? scien", r"\bexercise scien",
    ),
    "environmental": _rx(
        r"\benvironment(al)?\b", r"\becolog", r"\bmarine (biolog|scien|conservation|environment|survey)", r"\bconservation\b",
        r"\bsustainab", r"\bclimate\b", r"\bwildlife\b", r"\bocean", r"\bgeolog", r"\bgeoscien", r"\bearth scien",
        r"\bhydrolog", r"\bwater (science|quality|resources)\b", r"\bfisheries\b", r"\baquacult", r"\bbiodiversity\b",
        r"\bzoolog", r"\bnet zero\b", r"\bagronom", r"\bagricultur",
    ),
    "business": _rx(
        r"\bfinance\b", r"\bcommercial\b", r"\bprocurement\b", r"\bsupply chain\b", r"\bhuman resources\b",
        r"\bhr\b", r"\bmarketing\b", r"\bsales\b", r"\bbusiness (development|support|analyst|management)\b",
        r"\bpublic affairs\b", r"\bcompliance\b", r"\bproject management\b", r"\btreasury\b", r"\btrading\b",
        r"\bquant", r"\binvestment\b", r"\baudit\b", r"\btax\b", r"\baccount(ing|ancy)\b", r"\blegal\b",
        r"\boperations associate\b", r"\bconsult(ant|ing)\b", r"\bcrypto\b",
        r"\bmaterials? (management|planning|planner|handl\w*|controller|coordinator|buyer)\b", r"\binsurance\b", r"\bbroking\b",
    ),
    # Not engineering at all: keeps these out of every engineering student's For you
    "creative": _rx(
        r"\bgraphic design", r"\bbrand\b", r"\bsocial media\b", r"\bcontent\b", r"\bwriters?\b", r"\bjournalis",
        r"\bcopywrit", r"\bvideo\b", r"\bphotograph", r"\bevent (producer|planner|coordinator)\b", r"\bcommunications\b",
        r"\bpost[- ]?production\b", r"\b(tv|television|broadcast\w*|theatre|music)\b", r"(?<!thin )\bfilms?\b",
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
    "software": _rx(
        r"\bsoftware engineering\b", r"\bsoftware developer\b", r"\bcomputer science\b", r"\bmachine learning\b",
        r"\b(python|java|javascript|typescript|react|kubernetes|aws|azure)\b",
    ),
    "biomedical": _rx(r"\bbiomedical (engineering|science)\b", r"\bmedical devices?\b"),
    "life_sciences": _rx(
        r"\b(biology|biochemistry|biotechnology|microbiology|molecular biology|cell biology|pharmacology|life sciences|"
        r"biological sciences|bioprocessing|genomics)\b",
    ),
    "healthcare": _rx(r"\bclinical (research|trials?|practice|setting)\b", r"\bnhs\b"),
    "environmental": _rx(r"\benvironmental (science|engineering|consultancy|management|monitoring)\b", r"\becology\b"),
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
    if hint and hint.strip().lower() in EVENT_HINTS:
        return "event"
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
    """Cheap title-only check, used before fetching full descriptions. Defence roles are candidates
    too: they're kept with a flag and shown only to people who turn them on (owner, 18 Oct)."""
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


# Titles that are clearly engineering or science but don't name a field ("Graduate Engineer",
# "Engineering Placement 2027", "Technical Apprentice", "Laboratory Assistant"): a general tag that
# every engineering (or science) degree includes, so they still reach For you and personal alerts
GENERIC_ENGINEERING = _rx(
    r"\bengineer", r"\btechnical\b", r"\btechnician", r"\bmaintenance\b", r"\br&d\b", r"\bquality\b", r"(?<!post )(?<!post-)\bproduction\b(?! (assistant|runner|coordinator|company|data))",
    r"\bstem\b", r"\bmechanic",
)
GENERIC_SCIENCE = _rx(r"\bscien", r"\blab(oratory)?\b", r"\bresearch\b")
ENGINEER_TITLE = _rx(r"\bengineer")
# Engineering employers: a student role there whose title names no subject ("Build Systems
# Placement" at Mercedes-AMG HPP) is engineering, and so is a "Technology Intern - Machining"
ENGINEERING_EMPLOYER = _rx(
    r"\brolls[- ]royce\b", r"\bjaguar land rover\b", r"^jlr\b", r"\bgkn\b", r"\bmercedes[- ]amg\b", r"\bamg (hpp|high performance)",
    r"\bmclaren\b", r"\bwilliams (racing|advanced|grand prix)", r"\bred bull (racing|powertrains|technology|advanced)", r"\baston martin\b",
    r"\balpine (f1|racing)\b", r"\bbentley motors\b", r"\bnissan\b", r"\btoyota\b", r"\bhonda\b", r"\bbmw\b", r"\bjcb\b",
    r"\bcaterpillar\b", r"\bperkins\b", r"\bcummins\b", r"\bdyson\b", r"\brenishaw\b", r"\bsiemens\b", r"\balstom\b",
    r"\bhitachi rail\b", r"\bairbus\b", r"\bsafran\b", r"\bcollins aerospace\b", r"\bge aerospace\b", r"\bge vernova\b",
    r"\bspirax", r"\bedwards vacuum\b", r"\bmoog\b", r"\bparker hannifin\b", r"\bjohnson matthey\b", r"\bineos\b",
    r"\btata steel\b", r"\bbritish steel\b", r"\bsmith ?(\+|&|and) ?nephew\b",
    r"\bricardo\b", r"\bhoriba mira\b", r"\bvestas\b", r"\bsiemens gamesa\b", r"\bwabtec\b", r"\bagco\b", r"\bcnh industrial\b",
    r"\bleyland trucks\b", r"\bspencer group\b", r"\banalog devices\b", r"\barm\b(?! (holdings )?(finance|legal))", r"\bgraphcore\b",
)
_TECHNOLOGY_ONLY = _rx(r"\btechnology (graduate|analyst|programme|intern)")
# Roles at those employers that aren't engineering
_OTHER_WORK = _rx(
    r"\b(finance|financial|hr|human|marketing|sales|legal|procurement|purchasing|commercial|people|planning|planner|survey\w*|ux|"
    r"user experience|it|information technology|waste|project controls?|risk|geospatial|communications?|events?|admin\w*|office|"
    r"customer|business|supply chain|logistics|accounting|audit|tax|graphic|brand|media|retail|hospitality)\b"
)
_COMPUTING_WORDS = _rx(r"\b(software|data|developer|programmer|cyber|cloud|web|it|ai|ml|digital|security|devops)\b")


def disciplines_for(title: str, description: str, company: str = "") -> list[str]:
    """From the title when it names a field; otherwise from the description's own wording (said at
    least twice), and only when the title sounds technical; otherwise a general engineering or
    science tag when the title is clearly one of those, or the employer is an engineering one."""
    found = [name for name, pattern in DISCIPLINES.items() if pattern.search(title)]
    if found == ["creative"] and ENGINEER_TITLE.search(title):
        found.append("engineering")  # "Graduate Broadcast Engineer": a TV word, still an engineering job
    engineering_employer = bool(company and ENGINEERING_EMPLOYER.search(company))
    if (engineering_employer and "software" in found and "engineering" not in found and _TECHNOLOGY_ONLY.search(title)
            and not _COMPUTING_WORDS.search(title)):
        found.append("engineering")  # "Technology Intern - Powder Bed" at GKN Aerospace
    if found:
        return found
    if TECHNICAL_TITLE.search(title):
        found = [name for name, pattern in DESCRIPTION_DISCIPLINES.items() if len(pattern.findall(description)) >= 2]
    if found:
        return found
    if GENERIC_ENGINEERING.search(title):
        return ["engineering"]
    if GENERIC_SCIENCE.search(title):
        return ["science"]
    if engineering_employer and not _OTHER_WORK.search(title):
        return ["engineering"]
    return []


def kind_for(title: str, hint: str | None = None) -> str | None:
    """The opportunity type, or None for roles that aren't for students (senior, staff, managers)."""
    if STAFF_ROLE.search(title):
        return None
    return _kind(title, hint)


def classify(job: RawJob) -> Opportunity | None:
    kind = _kind(job.title, _hint(job))
    if kind is None or STAFF_ROLE.search(job.title):
        return None
    defence = excluded(job.company, job.title, job.description)

    # Event readers set the subject themselves: [] for hackathons (open to everyone), a list for a lab expo
    disciplines = job.raw["disciplines"] if "disciplines" in job.raw else disciplines_for(job.title, job.description, job.company)
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
        defence=defence,
        raw=job.raw,
    )
