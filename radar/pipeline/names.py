"""Tidy employer names from hiring systems, which often carry internal codes
('GBA0 Revvity (UK) Ltd.', 'TGB - Trumpf Limited') or only a short site nickname ('cat')."""

from __future__ import annotations

import re

# Site nicknames that show up when a hiring system gives no proper employer name
NICKNAMES = {
    "analogdevices": "Analog Devices", "barrywehmiller": "Barry-Wehmiller", "brooksauto": "Brooks Automation",
    "cae": "CAE", "cat": "Caterpillar", "finning": "Finning", "fourseasons": "Four Seasons", "gartner": "Gartner",
    "hp": "HP", "huntsman": "Huntsman", "jda": "Blue Yonder", "levistraussandco": "Levi Strauss & Co.",
    "lseg": "LSEG", "ncr": "NCR", "prysmiangroup": "Prysmian Group", "quilter": "Quilter",
    "rollsroyce": "Rolls-Royce", "taskus": "TaskUs", "trafigura": "Trafigura", "unilever": "Unilever",
    "aig": "AIG", "gtt": "GTT",
}

_PREFIXES = [
    re.compile(r"^\([^)]*\)\s*"),                                        # (FCRS = GB016) Novartis
    re.compile(r"^[-–]\s*"),                                             # - CS Company
    re.compile(r"^(united kingdom|uk|gbr?|ww_uk)\s*[-–]\s*", re.I),      # UK - Rackspace, GBR - Kantar
    re.compile(r"^(united kingdom|uk)\s{2,}", re.I),                     # "United Kingdom  Avis Budget"
    re.compile(r"^company \d+\s*[-–]\s*", re.I),                         # Company 64 - MFC Global
    re.compile(r"^\d{1,6}\s+(?=[A-Za-z]{2})"),                           # 02 Reed Specialist, 1054 GlaxoSmithKline
    # Codes with a digit or underscore, 3+ characters (so brands like '3M' survive): GBA0, C_012, LE-1000
    re.compile(r"^(?!\d+(st|nd|rd|th)\b)(?=\S*[\d_])[A-Za-z0-9_]{3,14}(-[A-Za-z0-9]+)?\s*[-–]?\s+"),
    re.compile(r"^[A-Z]{2,6}-(?=[A-Z])"),                                # ALEU-Adobe, NAA-Jones
    re.compile(r"^[A-Z0-9_]{2,6}\s+[-–]\s+"),                            # TGB - Trumpf
    re.compile(r"^[A-Z]{2,6}\([A-Z]{2,3}\)\s+"),                         # FQM(UK) First Quantum
    re.compile(r"^GBR?\s+(?=[A-Z0-9])"),                                 # GBR 3M, GB Fresenius
]
_CAPS_CODE = re.compile(r"^([A-Z]{2,6})\s+(\S.*)$")


def _initials(words: str) -> str:
    return "".join(w[0] for w in re.findall(r"[A-Za-z][A-Za-z.&']*", words)).upper()


def _drop_caps_code(name: str) -> str:
    """Drop a leading all-caps code only when it's clearly a code, not the brand itself:
    it mentions GB/UK ('RDCUK', 'UKT'), repeats the next word ('GBABB ABB'), or spells the
    next words' initials ('HCK Hyundai Capital', 'TMGLTD Tubi Media Group Ltd')."""
    match = _CAPS_CODE.match(name)
    if not match:
        return name
    code, rest = match.groups()
    first_word = rest.split()[0].upper()
    initials = _initials(rest)
    looks_like_code = (
        code.startswith(("GB", "UK")) or code.endswith("UK")
        or code.endswith(first_word)
        or (len(initials) >= 2 and code.startswith(initials[:2]))
    )
    return rest if looks_like_code and len(rest.split()) >= 2 else name


def clean_company_name(name: str) -> str:
    cleaned = (name or "").strip()
    if cleaned.lower() in NICKNAMES:
        return NICKNAMES[cleaned.lower()]
    for _ in range(3):
        before = cleaned
        for pattern in _PREFIXES:
            cleaned = pattern.sub("", cleaned).strip()
        cleaned = _drop_caps_code(cleaned)
        if cleaned == before:
            break
    if cleaned.islower() and " " not in cleaned:
        cleaned = cleaned.title()
    return cleaned or name.strip()
