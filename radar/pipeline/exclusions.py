"""Employers and roles Nimbus never shows: Airbus, BAE Systems, and anything nuclear or
weapons/defence. This is the group's own choice, applied to every source before anything is
saved or alerted. Companies with mixed work (e.g. civil aerospace) stay, but their nuclear or
defence roles are dropped by the title and description checks."""

from __future__ import annotations

import re

EXCLUDED_COMPANIES = re.compile(
    r"\b("
    r"airbus|bae systems|mbda|thales|leonardo|babcock|qinetiq|lockheed|raytheon|rtx|northrop|"
    r"general dynamics|elbit|l3harris|rafael|saab|rheinmetall|kongsberg|hensoldt|chemring|cobham|"
    r"ultra electronics|dstl|atomic weapons|awe|naval group|navantia|"
    r"nuclear|ukaea|sellafield|westinghouse|urenco|cavendish nuclear|tokamak energy|first light fusion|"
    r"rolls-royce submarines|rolls-royce smr"
    r")\b",
    re.I,
)

_TOPICS = (
    r"nuclear|fusion (energy|power|reactor|plant)|weapons?|missiles?|munitions?|ordnance|"
    r"defen[cs]e|military|submarines?|warships?|naval|armou?red|ballistic|combat|"
    r"ministry of defen[cs]e|\bmod\b"
)
EXCLUDED_TITLE = re.compile(rf"\b({_TOPICS})\b", re.I)
EXCLUDED_DESCRIPTION = re.compile(rf"\b({_TOPICS})\b", re.I)

# A job description counts as nuclear/defence work only if it keeps returning to it;
# one mention in company boilerplate ("civil aerospace, defence and power") is not enough.
DESCRIPTION_HITS = 3


def excluded_company(company: str) -> bool:
    return bool(EXCLUDED_COMPANIES.search(company or ""))


def excluded_title(title: str) -> bool:
    return bool(EXCLUDED_TITLE.search(title or ""))


def excluded_description(description: str) -> bool:
    return len(EXCLUDED_DESCRIPTION.findall(description or "")) >= DESCRIPTION_HITS


def excluded(company: str, title: str, description: str = "") -> bool:
    return excluded_company(company) or excluded_title(title) or excluded_description(description)
