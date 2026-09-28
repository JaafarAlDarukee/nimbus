from __future__ import annotations

import re

COUNTRY_CODES = {
    "united kingdom": "GB", "uk": "GB", "great britain": "GB", "england": "GB", "scotland": "GB",
    "wales": "GB", "northern ireland": "GB", "gb": "GB", "gbr": "GB",
    "ireland": "IE", "germany": "DE", "france": "FR", "spain": "ES", "italy": "IT",
    "netherlands": "NL", "belgium": "BE", "switzerland": "CH", "austria": "AT", "sweden": "SE",
    "norway": "NO", "denmark": "DK", "finland": "FI", "poland": "PL", "czech republic": "CZ",
    "czechia": "CZ", "portugal": "PT", "romania": "RO", "hungary": "HU",
    "united states": "US", "united states of america": "US", "usa": "US", "canada": "CA", "mexico": "MX",
    "japan": "JP", "china": "CN", "india": "IN", "singapore": "SG", "south korea": "KR",
    "korea, republic of": "KR", "australia": "AU", "new zealand": "NZ",
    "united arab emirates": "AE", "uae": "AE", "saudi arabia": "SA", "qatar": "QA", "oman": "OM",
    "kuwait": "KW", "bahrain": "BH", "turkey": "TR", "brazil": "BR", "south africa": "ZA",
}

# UK places that often appear without "UK" in job locations (manufacturing hubs, big sites, cities)
UK_PLACES = {
    "aberdeen", "abingdon", "barrow", "barrow-in-furness", "basildon", "bath", "belfast", "birmingham",
    "birtley", "blackburn", "bolton", "bradford", "bridgend", "brighton", "bristol", "brough",
    "broughton", "burnaston", "brackley", "brixworth", "cambridge", "cardiff", "carlisle", "chelmsford",
    "cheltenham", "chester", "coventry", "crewe", "culham", "darlington", "deeside", "derby", "didcot",
    "doncaster", "dundee", "durham", "edinburgh", "exeter", "filton", "gateshead", "gaydon", "glasgow",
    "gloucester", "goole", "grove", "guildford", "halewood", "harlow", "harwell", "hatfield", "hull",
    "huddersfield", "inchinnan", "ipswich", "kingston upon hull", "lancaster", "leeds", "leicester",
    "lincoln", "liverpool", "livingston", "london", "loughborough", "luton", "malmesbury", "manchester",
    "middlesbrough", "milton keynes", "newcastle", "newcastle upon tyne", "newport", "newton aycliffe",
    "northampton", "norwich", "nottingham", "oxford", "pencoed", "peterborough", "plymouth", "portsmouth",
    "preston", "reading", "rochester", "rosyth", "samlesbury", "sheffield", "slough", "solihull",
    "southampton", "stafford", "stevenage", "stockton", "stockton-on-tees", "stoke", "stoke-on-trent",
    "sunderland", "swansea", "swindon", "telford", "uttoxeter", "wakefield", "warrington", "warton",
    "washington", "wolverhampton", "woking", "worcester", "wrexham", "yeovil", "york",
}

_UK_WORDS = re.compile(r"\b(united kingdom|uk|u\.k\.|great britain|england|scotland|wales|northern ireland)\b", re.I)


def country_code(name: str | None) -> str | None:
    if not name:
        return None
    name = name.strip()
    if len(name) == 2 and name.isalpha():
        return name.upper()
    return COUNTRY_CODES.get(name.lower(), None)


def guess_country(location: str) -> str | None:
    """Best-effort country from a free-text location like 'Derby, UK' or 'Sunderland'."""
    if not location:
        return None
    if _UK_WORDS.search(location):
        return "GB"
    for part in re.split(r"[,;/|()\-–]+", location.lower()):
        part = part.strip()
        if part in UK_PLACES:
            return "GB"
        if part in COUNTRY_CODES:
            return COUNTRY_CODES[part]
    return None


def first_city(location: str) -> str | None:
    if not location:
        return None
    city = re.split(r"[,;|(]", location)[0].strip()
    return city or None
