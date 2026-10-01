"""Personal Telegram messages: each linked user gets the new roles that fit their own radar, plus
reminders (calendar "remind me", saved roles closing soon, follow-ups 14 days after applying).

Chats are linked by the bot (supabase/functions/telegram). Every message is recorded in
alerts_sent first, so nothing is sent twice. Logs print counts only (they are public)."""

from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from ..match import DISCIPLINE_WORDS, filters_for, is_match, score, with_defaults
from ..store import _fetch_all, client
from .telegram import KIND_LABELS

MAX_PER_PERSON = 8
MIN_SCORE = 60
UK = ZoneInfo("Europe/London")
DAY = timedelta(days=1)


def _dm(when: datetime, weekday: bool = False) -> str:
    """'24 Oct' or 'Fri 24 Oct' in UK time (written out: Windows has no %-d)."""
    local = when.astimezone(UK)
    return f"{local:%a} {local.day} {local:%b}" if weekday else f"{local.day} {local:%b}"


def _day(value: str | None) -> str | None:
    return _dm(datetime.fromisoformat(value)) if value else None


def _hashtag(word: str) -> str:
    return "#" + "".join(part[:1].upper() + part[1:] for part in word.replace("&", " ").split())


def event_type(title: str) -> str:
    """The same labels as the website's cards (web/src/lib/opportunity-view.ts kindView)."""
    if re.search(r"hack", title, re.I):
        return "Hackathon"
    if re.search(r"careers? (fair|festival)|graduate fair", title, re.I):
        return "Careers fair"
    if re.search(r"\b(expo|exhibition|show|week)\b|\((expo|science festival)\)", title, re.I):
        return "Expo"
    if re.search(r"conference|summit|symposium|congress", title, re.I):
        return "Conference"
    if re.search(r"competition|challenge", title, re.I):
        return "Competition"
    return "Event"


def format_match(row: dict, points: int, industry: str | None) -> str:
    e = html.escape
    label = "Strong match for you" if points >= 85 else "Good match for you" if points >= 75 else "New for you"
    icon = "🟢" if points >= 85 else "🔵" if points >= 75 else "🟠"
    posted = row.get("posted_at") or row.get("first_seen_at")
    posted_text = "posted today" if posted and datetime.fromisoformat(posted).astimezone(UK).date() == datetime.now(UK).date() else (
        f"posted {_day(posted)}" if posted else "just found")
    if row.get("kind") == "event":  # an expo or hackathon: what it is and when it ends, not a deadline
        details = [event_type(row.get("title") or "")] + ([f"ends {_day(row['closes_at'])}"] if row.get("closes_at") else [])
    else:
        details = [KIND_LABELS.get(row.get("kind") or "", "Opportunity"), posted_text]
        if row.get("closes_at"):
            details.append(f"deadline {_day(row['closes_at'])}")
        elif row.get("rolling"):
            details.append("rolling, apply early")
    tags = [_hashtag(DISCIPLINE_WORDS.get(d, d).replace(" engineering", "")) for d in (row.get("disciplines") or [])[:3]]
    if industry:
        tags.append(_hashtag(industry))
    where = row.get("location_text") or ("United Kingdom" if row.get("country") == "GB" else row.get("country") or "")
    lines = [
        f"{icon} <b>{label}</b> · {points}% match",
        f"<b>{e(row['title'])}</b>",
        e(" · ".join(p for p in (row.get("company_name"), where) if p)),
        e(" · ".join(details)),
    ]
    if tags:
        lines.append(" ".join(tags))
    if row.get("source_kind") == "adzuna":
        lines.append("<i>via Adzuna: found on a job board, so it may be a few days old</i>")
    return "\n".join(lines)


def _buttons(row: dict) -> dict:
    return {"inline_keyboard": [
        [{"text": "Open and apply", "url": row["apply_url"]}],
        [{"text": "Save", "callback_data": f"s:{row['id']}"}, {"text": "Applied", "callback_data": f"a:{row['id']}"},
         {"text": "Not for me", "callback_data": f"n:{row['id']}"}],
    ]}


class _Telegram:
    def __init__(self, token: str):
        self.token = token
        self.http = httpx.Client(timeout=30)
        self.sent = 0

    def send(self, chat_id, text: str, markup: dict | None = None) -> bool:
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if markup:
            payload["reply_markup"] = markup
        for _ in range(2):
            response = self.http.post(f"https://api.telegram.org/bot{self.token}/sendMessage", json=payload)
            if response.status_code == 429:
                time.sleep(response.json().get("parameters", {}).get("retry_after", 5))
                continue
            self.sent += response.is_success
            time.sleep(0.05)  # Telegram allows about 30 messages a second across chats
            return response.is_success
        return False


def _claim(db: httpx.Client, user_id: str, opportunity_id: str, channel: str) -> bool:
    """Record a message before sending it; False if it was already sent."""
    response = db.post(
        "/alerts_sent",
        params={"on_conflict": "user_id,opportunity_id,channel"},
        headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
        json={"user_id": user_id, "opportunity_id": opportunity_id, "channel": channel},
    )
    response.raise_for_status()
    return bool(response.json())


def _send_once(db: httpx.Client, telegram: "_Telegram", user_id: str, opportunity_id: str, channel: str, chat, text: str,
               markup: dict | None = None) -> bool:
    """Record, then send. If Telegram fails, forget the record so the next run tries again."""
    if not _claim(db, user_id, opportunity_id, channel):
        return False
    if telegram.send(chat, text, markup):
        return True
    db.delete("/alerts_sent", params={"user_id": f"eq.{user_id}", "opportunity_id": f"eq.{opportunity_id}", "channel": f"eq.{channel}"})
    return False


def _linked(db: httpx.Client) -> list[dict]:
    channels = _fetch_all(db, "/notification_channels", {"select": "user_id,config", "channel": "eq.telegram", "enabled": "is.true"})
    return [c for c in channels if (c.get("config") or {}).get("chat_id")]


def send_matches(rows: list[dict]) -> None:
    """New roles from this run, to everyone they fit."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token or not rows:
        return
    with client() as db:
        people = _linked(db)
        if not people:
            return
        ids = ",".join(p["user_id"] for p in people)
        profiles = {p["id"]: p for p in _fetch_all(db, "/profiles", {"select": "id,preferences,cv_details", "id": f"in.({ids})"})}
        hidden: dict[str, set[str]] = {}
        for h in _fetch_all(db, "/hidden_opportunities", {"select": "user_id,opportunity_id", "user_id": f"in.({ids})"}):
            hidden.setdefault(h["user_id"], set()).add(h["opportunity_id"])

        telegram = _Telegram(token)
        reached = 0
        for person in people:
            profile = profiles.get(person["user_id"]) or {}
            prefs = with_defaults(profile.get("preferences"))
            filters = filters_for(prefs)
            cv_skills = (profile.get("cv_details") or {}).get("skills") or []
            fits = []
            for row in rows:
                if row["id"] in hidden.get(person["user_id"], set()) or not is_match(row, prefs, filters):
                    continue
                points, _, industry = score(row, prefs, filters, cv_skills)
                if points >= MIN_SCORE:
                    fits.append((points, industry, row))
            fits.sort(key=lambda f: -f[0])
            chat = person["config"]["chat_id"]
            sent_here = 0
            for points, industry, row in fits[:MAX_PER_PERSON]:
                if _send_once(db, telegram, person["user_id"], row["id"], "telegram", chat, format_match(row, points, industry), _buttons(row)):
                    sent_here += 1
            if len(fits) > MAX_PER_PERSON:
                telegram.send(chat, f"…and {len(fits) - MAX_PER_PERSON} more new matches. They're all in <b>For you</b> on the website.")
            reached += sent_here > 0
    print(f"Personal alerts: {telegram.sent} messages to {reached} people")


WELCOME_COLUMNS = "id,title,company_name,kind,disciplines,skills,country,remote,location_text,closes_at,posted_at,first_seen_at,rolling,apply_url,source_kind"


def send_welcome() -> None:
    """Someone who just connected gets their 3 best open matches straight away, so they see what
    alerts look like instead of waiting for the next new role."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    with client() as db:
        people = _linked(db)
        if not people:
            return
        ids = ",".join(p["user_id"] for p in people)
        started = {a["user_id"] for a in _fetch_all(db, "/alerts_sent", {"select": "user_id", "user_id": f"in.({ids})", "channel": "eq.telegram"})}
        newcomers = [p for p in people if p["user_id"] not in started]
        if not newcomers:
            return
        since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        recent = _fetch_all(db, "/opportunities", {"select": WELCOME_COLUMNS, "status": "eq.open", "first_seen_at": f"gt.{since}", "order": "first_seen_at.desc"})
        newcomer_ids = ",".join(p["user_id"] for p in newcomers)
        profiles = {p["id"]: p for p in _fetch_all(db, "/profiles", {"select": "id,preferences,cv_details", "id": f"in.({newcomer_ids})"})}
        telegram = _Telegram(token)
        for person in newcomers:
            profile = profiles.get(person["user_id"]) or {}
            prefs = with_defaults(profile.get("preferences"))
            filters = filters_for(prefs)
            cv_skills = (profile.get("cv_details") or {}).get("skills") or []
            fits = sorted(
                ((score(r, prefs, filters, cv_skills), r) for r in recent if is_match(r, prefs, filters)),
                key=lambda f: -f[0][0],
            )[:3]
            if not fits:
                continue
            chat = person["config"]["chat_id"]
            telegram.send(chat, "👋 <b>To get you started</b>, here are your best open matches right now. New ones will arrive the moment they open.")
            for (points, _, industry), row in fits:
                _send_once(db, telegram, person["user_id"], row["id"], "telegram", chat, format_match(row, points, industry), _buttons(row))
    print(f"Welcome matches: {telegram.sent} messages")


def send_reminders() -> None:
    """Calendar reminders due within a day, saved roles closing within 3 days, and follow-ups."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    now = datetime.now(timezone.utc)
    e = html.escape
    with client() as db:
        chats = {p["user_id"]: p["config"]["chat_id"] for p in _linked(db)}
        if not chats:
            return
        ids = ",".join(chats)
        telegram = _Telegram(token)

        # 1. "Remind me the day before" from the calendar
        events = _fetch_all(db, "/calendar_events", {
            "select": "id,user_id,kind,title,starts_at", "user_id": f"in.({ids})", "remind": "is.true",
            "reminded_at": "is.null", "starts_at": f"gt.{now.isoformat()}",
        })
        kinds = {"deadline": "Deadline", "online_test": "Online test", "interview": "Interview", "assessment_centre": "Assessment centre", "other": "Due"}
        for event in events:
            starts = datetime.fromisoformat(event["starts_at"])
            if starts - now > timedelta(hours=30):
                continue
            when = "tomorrow" if starts.astimezone(UK).date() > now.astimezone(UK).date() else "today"
            text = f"⏰ <b>{kinds.get(event['kind'], 'Reminder')} {when}</b>\n{e(event['title'])}\n{_dm(starts, weekday=True)}"
            if telegram.send(chats[event["user_id"]], text):
                db.patch("/calendar_events", params={"id": f"eq.{event['id']}"}, json={"reminded_at": now.isoformat()}).raise_for_status()

        # 2. Saved roles closing within 3 days, and 3. follow-ups due
        apps = _fetch_all(db, "/applications", {
            "select": "user_id,stage,next_follow_up_at,opportunity:opportunities(id,title,company_name,closes_at,apply_url,status)",
            "user_id": f"in.({ids})", "stage": "in.(saved,applied)",
        })
        for app in apps:
            role = app.get("opportunity") or {}
            if not role.get("id"):
                continue
            chat = chats[app["user_id"]]
            name = f"<b>{e(role['title'])}</b>\n{e(role['company_name'])}"
            closes = datetime.fromisoformat(role["closes_at"]) if role.get("closes_at") else None
            if app["stage"] == "saved" and role.get("status") == "open" and closes and now < closes <= now + 3 * DAY:
                _send_once(db, telegram, app["user_id"], role["id"], "telegram:closing", chat,
                           f"🟠 <b>Closing soon</b> · closes {_dm(closes, weekday=True)}\n{name}\nYou saved this but haven't applied yet.",
                           {"inline_keyboard": [[{"text": "Open and apply", "url": role["apply_url"]}],
                                                [{"text": "Applied", "callback_data": f"a:{role['id']}"}]]})
            follow = datetime.fromisoformat(app["next_follow_up_at"]) if app.get("next_follow_up_at") else None
            if app["stage"] == "applied" and follow and follow <= now:
                _send_once(db, telegram, app["user_id"], role["id"], "telegram:follow-up", chat,
                           f"📬 <b>Time to follow up</b>\n{name}\nIt's been 14 days since you applied. A short, polite email to their "
                           "early-careers team is fine. Still nothing after 21 days? Mark it ghosted in your tracker.")
    print(f"Reminders: {telegram.sent} messages")
