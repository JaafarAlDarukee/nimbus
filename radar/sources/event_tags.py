"""Which hackathons and events are for engineering and science students, and for which degrees.

`engineering_tags(text)` returns the discipline tags (radar/pipeline/classify.py) an event suits, or
None when nothing in its name or themes is engineering or science (an AI or web-only hackathon)."""

from __future__ import annotations

import re

ENGINEERING_ONLY = ["mechanical", "electrical", "robotics", "aerospace", "automotive", "manufacturing", "materials", "civil", "chemical"]

_RULES: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"\b(hardware|iot|internet of things|embedded|electronics?|arduino|raspberry pi|fpga|circuits?|pcb)\b", re.I),
     ["electrical", "robotics", "mechanical"]),
    (re.compile(r"\b(robot\w*|drones?|uav|autonomous|mechatronic\w*)\b", re.I), ["robotics", "mechanical", "electrical"]),
    (re.compile(r"\b(space|satellites?|aerospace|rockets?|aviation|aircraft)\b", re.I), ["aerospace", "mechanical", "electrical"]),
    (re.compile(r"\b(energy|climate|sustainab\w*|renewables?|net zero|carbon|cleantech|batter(y|ies)|hydrogen|solar|wind)\b", re.I),
     ["environmental", "electrical", "mechanical", "chemical"]),
    (re.compile(r"\b(automotive|mobility|motorsport|formula student|vehicles?|ev|transport)\b", re.I), ["automotive", "mechanical", "electrical"]),
    (re.compile(r"\b(manufactur\w*|industry 4\.0|factory|cad|3d print\w*|additive|industrial)\b", re.I), ["manufacturing", "mechanical", "materials"]),
    (re.compile(r"\b(medtech|medical|health\w*|biomedical|biotech\w*|bio|genomics?|life sciences?|pharma\w*)\b", re.I),
     ["biomedical", "healthcare", "life_sciences"]),
    (re.compile(r"\b(civil|structur\w*|smart cit\w*|infrastructure|construction|water)\b", re.I), ["civil", "environmental"]),
    (re.compile(r"\b(chemistry|chemical|materials?|physics|quantum)\b", re.I), ["chemical", "materials", "electrical"]),
    (re.compile(r"\b(engineering|engineers?|stem)\b", re.I), ENGINEERING_ONLY),
]

# UK, Europe, North America, and the Middle East
REGIONS = {
    "GB", "IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "CH", "AT", "DK", "SE", "NO", "FI", "PL", "CZ", "GR", "HU", "RO",
    "US", "CA",
    "AE", "SA", "QA", "KW", "OM", "BH",
}


def engineering_tags(text: str) -> list[str] | None:
    tags: list[str] = []
    for pattern, add in _RULES:
        if pattern.search(text or ""):
            tags += [t for t in add if t not in tags]
    return tags or None
