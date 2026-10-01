"""Who a role is for. The same rules as the website's For you (web/src/lib/preferences.ts,
web/src/lib/opportunity-view.ts and web/src/lib/industries.ts): change them together."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from .pipeline.classify import DISCIPLINES

DEFAULT_TYPES = ["Placement", "Summer internship", "Spring week", "Hackathon", "Competition", "Conference"]

_PREFERENCES_TS = Path(__file__).resolve().parent.parent / "web" / "src" / "lib" / "preferences.ts"


def _ts_record(name: str) -> dict[str, list[str]]:
    """A `Record<string, string[]>` from the website's preferences.ts, so both sides use one list."""
    text = _PREFERENCES_TS.read_text(encoding="utf-8")
    start = text.index(f"{name}: Record<string, string[]> = {{")
    body = text[start: text.index("\n};", start)]
    pairs = re.findall(r'^\s*(?:"([^"]+)"|([A-Za-z]\w*))\s*:\s*\[([^\]]*)\]', body, re.M)
    record = {quoted or bare: re.findall(r'"([^"]+)"', values) for quoted, bare, values in pairs}
    if not record:
        raise ValueError(f"couldn't read {name} from {_PREFERENCES_TS}")
    return record


DEGREE_DISCIPLINES = _ts_record("DEGREE_DISCIPLINES")
FIELD_DISCIPLINES = _ts_record("FIELD_DISCIPLINES")
TYPE_KINDS = _ts_record("TYPE_KINDS")

COUNTRY_CODES = {
    "Ireland": "IE", "Germany": "DE", "Netherlands": "NL", "Belgium": "BE", "Luxembourg": "LU", "France": "FR",
    "Switzerland": "CH", "Austria": "AT", "Italy": "IT", "Spain": "ES", "Portugal": "PT", "Denmark": "DK",
    "Sweden": "SE", "Norway": "NO", "Finland": "FI", "Poland": "PL", "Czechia": "CZ", "Turkey": "TR", "USA": "US",
    "Canada": "CA", "Mexico": "MX", "Brazil": "BR", "UAE": "AE", "Qatar": "QA", "Saudi Arabia": "SA", "Kuwait": "KW",
    "Oman": "OM", "Bahrain": "BH", "Egypt": "EG", "South Africa": "ZA", "India": "IN", "China": "CN",
    "Hong Kong": "HK", "Taiwan": "TW", "South Korea": "KR", "Japan": "JP", "Singapore": "SG", "Malaysia": "MY",
    "Australia": "AU", "New Zealand": "NZ",
}
EUROPE = ["IE", "DE", "NL", "BE", "LU", "FR", "CH", "AT", "IT", "ES", "PT", "DK", "SE", "NO", "FI", "PL", "CZ", "GR", "HU", "RO"]

KIND_WORDS = {
    "placement": "Placements are", "internship": "Internships are", "spring_week": "Spring weeks are",
    "insight": "Insight programmes are", "grad_scheme": "Graduate roles are", "graduate_job": "Graduate roles are",
    "apprenticeship": "Apprenticeships are", "research": "Research roles are", "scholarship": "Scholarships are",
    "event": "Events are",
}
DISCIPLINE_WORDS = {
    "mechanical": "Mechanical engineering", "manufacturing": "Manufacturing", "robotics": "Robotics",
    "electrical": "Electrical engineering", "aerospace": "Aerospace", "automotive": "Automotive", "materials": "Materials",
    "civil": "Civil engineering", "chemical": "Chemical engineering", "software": "Software", "business": "Business",
    "biomedical": "Biomedical", "life_sciences": "Life sciences", "healthcare": "Healthcare",
    "environmental": "Environmental science",
}
# A discipline named in the title itself: the classifier's own title patterns
TITLE_DISCIPLINE = DISCIPLINES

INDUSTRY_WORDS = {
    "Motorsport": r"\b(formula ?(1|one|e)|f1|motorsport|racing)\b",
    "Automotive": r"\b(automotive|vehicles?|powertrain|car maker)\b",
    "EV and batteries": r"\b(batter(y|ies)|electric vehicles?|ev charging|cell chemistry)\b",
    "Autonomous vehicles": r"\b(autonomous|self-driving|driverless)\b",
    "Rail": r"\b(rail(way)?s?|rolling stock|trains?)\b",
    "Civil aerospace": r"\b(aerospace|aircraft|aviation|aero ?engines?|airline)\b",
    "Marine and shipbuilding": r"\b(marine|shipbuilding|maritime|vessels?)\b",
    "Space and satellites": r"\b(space|satellites?|launch vehicles?|rockets?|orbital)\b",
    "Motorcycles": r"\bmotorcycles?\b",
    "Wind and solar": r"\b(wind (farm|turbine|energy)|offshore wind|solar|renewables?)\b",
    "Hydrogen": r"\b(hydrogen|fuel cells?|electroly[sz]er)\b",
    "Oil and gas": r"\b(oil and gas|petroleum|upstream|refinery)\b",
    "Power grid and utilities": r"\b(national grid|power networks?|utilities|electricity distribution|substations?)\b",
    "Energy storage": r"\b(energy storage|battery storage|grid storage)\b",
    "Carbon capture": r"\b(carbon capture|ccus?|direct air capture)\b",
    "Consumer products": r"\b(consumer (goods|products)|fmcg|household products)\b",
    "Food and drink manufacturing": r"\b(food|beverages?|drinks?|brewer(y|ies)|dairy)\b",
    "Additive manufacturing": r"\b(additive manufacturing|3d printing)\b",
    "Composites and materials": r"\b(composites?|advanced materials|polymers?)\b",
    "Industrial automation": r"\b(industrial automation|plc|scada|factory automation)\b",
    "Robotics": r"\brobot(ic|ics|s)?\b",
    "Medtech and devices": r"\b(medical devices?|medtech|surgical)\b",
    "Surgical robotics": r"\bsurgical robot",
    "Pharmaceuticals": r"\b(pharma(ceutical)?s?|drug development)\b",
    "Biotech": r"\b(biotech(nology)?|biologics)\b",
    "Construction": r"\b(construction|contractor)\b",
    "Infrastructure": r"\b(infrastructure|highways|bridges|tunnels)\b",
    "Water and wastewater": r"\b(water|wastewater)\b",
    "Semiconductors": r"\b(semiconductors?|chip design|wafer|foundry)\b",
    "Electronics and hardware": r"\b(electronics|hardware|pcb)\b",
}

_NOISE = re.compile(r"\b(the|uk|u\.k\.|ltd|limited|plc|llp|inc|group|holdings|gmbh|co|company)\b")


def normalise_company(name: str) -> str:
    text = unicodedata.normalize("NFD", name)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn").lower().replace("&", " and ")
    text = re.sub(r"[’'.]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", _NOISE.sub(" ", text)).strip()


def _directory() -> dict[str, list[str]]:
    """The Companies directory (web/src/lib/companies-data.ts), read straight from the website's file."""
    source = Path(__file__).resolve().parent.parent / "web" / "src" / "lib" / "companies-data.ts"
    try:
        text = source.read_text(encoding="utf-8")
        body = text[text.index("COMPANIES: Record<string, string[]> = {") + len("COMPANIES: Record<string, string[]> = "):]
        body = body[: body.index("\n};") + 3].rstrip(";")
        data = json.loads(re.sub(r",\s*}$", "}", body.strip()))
    except (OSError, ValueError):
        return {}
    return {sector: [normalise_company(entry.split("|")[0]) for entry in entries] for sector, entries in data.items()}


DIRECTORY = _directory()


def with_defaults(stored: dict | None) -> dict:
    prefs = {"field": "Engineering", "degrees": ["Mechanical Engineering"], "sectors": [], "types": DEFAULT_TYPES,
             "uk": ["Anywhere in the UK"], "abroad": [], "muted": []}
    prefs.update({k: v for k, v in (stored or {}).items() if v is not None})
    return prefs


def filters_for(prefs: dict) -> tuple[set[str], set[str], set[str] | None]:
    kinds = {k for t in prefs.get("types", []) for k in TYPE_KINDS.get(t, [])}
    degrees = prefs.get("degrees", [])
    disciplines = {d for deg in degrees for d in DEGREE_DISCIPLINES.get(deg, [])}
    if not degrees or any(deg not in DEGREE_DISCIPLINES for deg in degrees):  # typed by hand: go by the field
        disciplines.update(FIELD_DISCIPLINES.get(prefs.get("field", ""), []))
    abroad = prefs.get("abroad", [])
    if "Worldwide" in abroad:
        return kinds, disciplines, None
    countries: set[str] = set()
    if prefs.get("uk"):
        countries.add("GB")
    if "Anywhere in Europe" in abroad:
        countries.update(EUROPE)
    countries.update(COUNTRY_CODES[p] for p in abroad if p in COUNTRY_CODES)
    return kinds, disciplines, countries or {"GB"}


def industry_match(sectors: list[str], company: str, text: str) -> str | None:
    name = normalise_company(company)
    for sector in sectors:
        if any(len(c) > 2 and (name == c or name.startswith(f"{c} ")) for c in DIRECTORY.get(sector, [])):
            return sector
        pattern = INDUSTRY_WORDS.get(sector)
        if pattern and re.search(pattern, text, re.I):
            return sector
    return None


def is_match(row: dict, prefs: dict, filters: tuple) -> bool:
    kinds, disciplines, countries = filters
    if kinds and row.get("kind") not in kinds:
        return False
    event = row.get("kind") == "event"
    tags = set(row.get("disciplines") or [])
    # Events with no subject (most hackathons) are for everyone; a lab expo or a medtech conference
    # only for the degrees it fits. Online events aren't tied to a country.
    if disciplines and not disciplines & tags and not (event and not tags):
        return False
    if countries is not None and row.get("country") not in countries and not (event and row.get("remote")):
        return False
    company = (row.get("company_name") or "").lower()
    return not any(company.startswith(m.lower()) for m in prefs.get("muted", []))


def score(row: dict, prefs: dict, filters: tuple, cv_skills: list[str]) -> tuple[int, list[str], str | None]:
    """(score out of 100, reasons, matching industry): the same points as the website."""
    kinds, disciplines, countries = filters
    degree = (prefs.get("degrees") or ["degree"])[0]
    points, why = 50, []
    if row.get("kind") in kinds and row.get("kind") in KIND_WORDS:
        points += 14
        why.append(f"{KIND_WORDS[row['kind']]} one of the types you picked")
    overlap = [d for d in row.get("disciplines") or [] if d in disciplines]
    in_title = next((d for d in overlap if d in TITLE_DISCIPLINE and TITLE_DISCIPLINE[d].search(row.get("title") or "")), None)
    if in_title:
        points += 20
        why.append(f"{DISCIPLINE_WORDS.get(in_title, in_title)} fits your {degree}")
    elif overlap:
        points += 8
        why.append(f"The advert asks for {DISCIPLINE_WORDS.get(overlap[0], overlap[0]).lower()}, part of your {degree}")
    text = f"{row.get('title', '')} {row.get('company_name', '')} {(row.get('description') or '')[:800]}"
    industry = industry_match(prefs.get("sectors", []), row.get("company_name") or "", text) if prefs.get("sectors") else None
    if industry:
        points += 12
        why.append(f"{industry} is one of your industries")
    if countries is None or row.get("country") in countries:
        points += 4
    mine = {s.lower() for s in cv_skills}
    shared = [s for s in row.get("skills") or [] if s.lower() in mine]
    points += min(9, len(shared) * 3)
    return max(30, min(97, points)), why[:3], industry
