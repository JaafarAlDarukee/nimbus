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

_UK_WORDS = re.compile(r"\b(united kingdom|uk|u\.k\.|gbr|great britain|england|scotland|wales|northern ireland)\b", re.I)

# Places whose names contain a UK word but are elsewhere ("Newcastle, New South Wales")
_NOT_UK = {"new south wales": "AU", "new england": "US"}

# A country name at the end of a place ("Cambridge, MA USA"), not inside a street name ("5 Canada Square")
_OTHER_COUNTRY_AT_END = re.compile(
    r"\b(" + "|".join(sorted((re.escape(k) for k, v in COUNTRY_CODES.items() if v != "GB"), key=len, reverse=True)) + r")$",
    re.I,
)

# Many UK place names also exist abroad ("Cambridge, MA", "Durham, NC", "Cambridge, ON"), so a
# state or province next to the city wins over the UK place list. DE and IN are left out: they
# are also the country codes for Germany and India.
US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "FL", "GA", "HI", "ID", "IL", "IA", "KS", "KY", "LA",
    "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
}
US_STATE_NAMES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
    "florida", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
    "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "north carolina",
    "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
    "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "west virginia", "wisconsin",
    "wyoming",
}
CA_PROVINCES = {"AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "ONTARIO", "QUEBEC", "BRITISH COLUMBIA", "ALBERTA"}
AU_STATES = {"NSW", "QLD", "VIC", "TAS", "ACT"}
# Big US cities named without a state; checked after UK places so "London, New York" stays UK
US_CITIES = {"new york", "boston", "chicago", "san francisco", "seattle", "los angeles", "houston", "austin"}

_PLACES = re.compile(r"[;\n]+| \| ")
_PARTS = re.compile(r"[,/|()\-–]+")


def country_code(name: str | None) -> str | None:
    if not name:
        return None
    name = name.strip()
    if len(name) == 2 and name.isalpha():
        return name.upper()
    return COUNTRY_CODES.get(name.lower(), None)


def guess_country(location: str) -> str | None:
    """Best-effort country from a free-text location like 'Derby, UK', 'Sunderland' or 'Cambridge, MA'.
    A list of places ('Amsterdam; London; New York') counts as UK if any of them is in the UK."""
    if not location:
        return None
    found = [c for c in (_place_country(p) for p in _PLACES.split(location)) if c]
    if "GB" in found:
        return "GB"
    return found[0] if found else None


def _place_country(place: str) -> str | None:
    lower = place.lower()
    for name, code in _NOT_UK.items():
        if name in lower:
            return code
    if _UK_WORDS.search(place):
        return "GB"
    parts = [p.strip() for p in _PARTS.split(place) if p.strip()]
    for part in parts:
        if found := _OTHER_COUNTRY_AT_END.search(part):
            return COUNTRY_CODES[found.group(1).lower()]
    for part in parts:
        if part in US_STATES or part.lower() in US_STATE_NAMES:
            return "US"
        if part.upper() in CA_PROVINCES and (len(part) > 2 or part.isupper()):
            return "CA"
        if part in AU_STATES:
            return "AU"
    for part in parts:
        if part.lower() in UK_PLACES:
            return "GB"
        if part.lower() in COUNTRY_CODES:
            return COUNTRY_CODES[part.lower()]
    if any(part.lower() in US_CITIES for part in parts):
        return "US"
    return None


def first_city(location: str) -> str | None:
    if not location:
        return None
    city = re.split(r"[,;|(]", location)[0].strip()
    return city or None
