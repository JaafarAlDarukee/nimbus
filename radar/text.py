from __future__ import annotations

import html
import re
from datetime import datetime, timezone

_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")


def html_to_text(value: str | None) -> str:
    """Strip HTML tags and entities down to plain, single-spaced text."""
    if not value:
        return ""
    text = html.unescape(value)
    text = _TAGS.sub(" ", text)
    return _SPACES.sub(" ", html.unescape(text)).strip()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def from_millis(value: int | float | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
