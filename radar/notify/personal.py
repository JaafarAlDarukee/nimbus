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

from ..match import company_key, filters_for, fit, is_match, is_muted, watched_as, with_defaults
from ..store import _fetch_all, client
from ..sources.inbox import SITES
from ..sources.event_tags import REGIONS
from .telegram import ALERT_COUNTRIES, ENGINEERING, KIND_LABELS, is_engineering, is_engineering_role

# "Your free trial ends soon" this many hours before it does (once)
TRIAL_REMIND_HOURS = 12
# One message per role, as soon as it's found (owner, 17 Oct); more than this in one check get a link instead
MAX_PER_PERSON = 30
# The personal bot is for landing a placement (owner, 18 Oct): placements, summer internships, spring
# weeks and insight days only. Graduate schemes, apprenticeships and events stay on the website and in
# the main channel.
BOT_KINDS = {"placement", "internship", "spring_week", "insight"}
# Every student type, for companies on the watchlist (the moment anything opens there)
WATCH_KINDS = BOT_KINDS | {"grad_scheme", "graduate_job", "apprenticeship", "research", "scholarship"}
# The morning digest, in UK time
DIGEST_HOUR, DIGEST_MINUTE = 7, 30
# The same role from several places (employer, Gradcracker, Bright Network, Adzuna) is sent once
REPEAT_DAYS = 30
# Nimbus is private (owner, 18 Oct: "make it for me only, no payment, no nothing"): only admins get
# personal alerts, and nobody gets trial or payment messages. Same switch as web/src/lib/access.ts PRIVATE.
PRIVATE = True
# Paid access, switched off while PRIVATE (mirrors web/src/lib/access.ts): 2 days free with TRIAL_ALERTS alerts, then £5 once
TRIAL_ALERTS = 5
PRICE = "£5"
SITE_URL = os.environ.get("NIMBUS_SITE_URL", "https://nimbus-pi-three.vercel.app").rstrip("/")
UK = ZoneInfo("Europe/London")
DAY = timedelta(days=1)


def _dm(when: datetime, weekday: bool = False) -> str:
    """'24 Oct' or 'Fri 24 Oct' in UK time (written out: Windows has no %-d)."""
    local = when.astimezone(UK)
    return f"{local:%a} {local.day} {local:%b}" if weekday else f"{local.day} {local:%b}"


def _day(value: str | None) -> str | None:
    return _dm(datetime.fromisoformat(value)) if value else None


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


def _via(row: dict) -> str | None:
    """"Gradcracker" for a role found in a job-site email, "Adzuna" for the job board."""
    if row.get("source_kind") == "adzuna":
        return "Adzuna"
    if row.get("source_kind") == "inbox":
        return next((s.name for s in SITES if s.job_link.search(row.get("apply_url") or "")), "a job site")
    return None


_YEARS = re.compile(r"\b20\d\d\b")
_COMPANY_WORDS = re.compile(r"\b(ltd|limited|plc|llp|inc|group|uk|gmbh|co|the|and|ireland|services|holdings)\b")


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


_LITTLE_WORDS = {"and", "the", "of", "for", "in", "at", "to", "an", "with", "or"}


def title_words(title: str) -> frozenset[str]:
    """The words of a title without years and little words (the same as SQL public.title_words)."""
    return frozenset(w for w in re.split(r"[^a-z0-9]+", (title or "").lower())
                     if len(w) > 1 and not re.fullmatch(r"20\d\d", w) and w not in _LITTLE_WORDS)


def similar_titles(a: frozenset[str], b: frozenset[str]) -> bool:
    """At least 5 words, and 90% of the shorter title's words in the other (SQL public.similar_titles)."""
    shorter = min(len(a), len(b))
    return shorter >= 5 and len(a & b) >= 0.9 * shorter


RoleKey = tuple[str, str, frozenset[str]]


def same_role_key(row: dict) -> RoleKey:
    """(title, employer, title words) with years, punctuation and company suffixes removed; employer ""
    when a job site didn't say ("via Bright Network")."""
    company = row.get("company_name") or ""
    company = "" if company.lower().startswith("via ") else _norm(_COMPANY_WORDS.sub(" ", company.lower()))
    title = row.get("title") or ""
    return _norm(_YEARS.sub(" ", title)), company, title_words(title)


def is_repeat(key: RoleKey, seen: list[RoleKey]) -> bool:
    """The same role: same employer (or one unknown) and the same title, or the same employer and a
    near-identical title ("Manufacturing Engineering (12 Month Placement Scheme)" and "12 Month
    Industrial Placement Scheme - Manufacturing Engineering - Technical Services")."""
    title, company, words = key
    for t, c, w in seen:
        same_employer = bool(c and company) and (c == company or c.startswith(company + " ") or company.startswith(c + " "))
        if t == title and (same_employer or not c or not company):
            return True
        if same_employer and similar_titles(words, w):
            return True
    return False


def _seen_roles(db: httpx.Client, ids: str) -> dict[str, list[RoleKey]]:
    """Each person's roles already sent in the last REPEAT_DAYS days, and everything in their tracker
    (saved, applied, interviews...), so a copy of a role they've applied to doesn't come again."""
    since = (datetime.now(timezone.utc) - timedelta(days=REPEAT_DAYS)).isoformat()
    seen: dict[str, list[RoleKey]] = {}
    for a in _fetch_all(db, "/alerts_sent", {"select": "user_id,opportunities(title,company_name)", "user_id": f"in.({ids})",
                                             "channel": "eq.telegram", "sent_at": f"gt.{since}"}):
        if a.get("opportunities"):
            seen.setdefault(a["user_id"], []).append(same_role_key(a["opportunities"]))
    for a in _fetch_all(db, "/applications", {"select": "user_id,title,company_name,opportunities(title,company_name)", "user_id": f"in.({ids})"}):
        role = a.get("opportunities") or {"title": a.get("title"), "company_name": a.get("company_name")}
        if role.get("title"):
            seen.setdefault(a["user_id"], []).append(same_role_key(role))
    return seen


# The type on top, in the colours of the website's type pills
TYPE_ICONS = {"placement": "🟦", "internship": "🟪", "spring_week": "🟨", "insight": "🟨", "grad_scheme": "🟫",
              "graduate_job": "🟫", "apprenticeship": "🟩", "research": "🟥", "scholarship": "🟥", "event": "🟧"}


def wanted(row: dict, prefs: dict, filters: tuple) -> bool:
    """Their own matches, plus, for engineering students, every UK and Ireland engineering, computing and
    science role of any type (what the main channel used to post; the channel now posts everything)."""
    if is_match(row, prefs, filters):
        return True
    return (prefs.get("field") == "Engineering" and row.get("country") in ALERT_COUNTRIES and is_engineering(row)
            and not is_muted(row, prefs) and (not row.get("defence") or bool(prefs.get("defence"))))


def wanted_event(row: dict, prefs: dict) -> bool:
    """Hackathons, competitions and fairs you can go to: in person, in the UK, Ireland, Europe, North
    America or the Middle East (owner, 19 Oct: "I want to get into hackathons and stuff abroad"),
    engineering, computing or science, or open to any subject."""
    if row.get("kind") != "event" or row.get("remote") or row.get("defence") or is_muted(row, prefs):
        return False
    if row.get("country") not in ALERT_COUNTRIES | REGIONS:
        return False
    tags = set(row.get("disciplines") or [])
    return not tags or bool(tags & ENGINEERING)


def open_on_nimbus(row: dict) -> str:
    """The role on the website (sign-in and payment first), which links on to the employer."""
    return f"{SITE_URL}/?open={row['id']}"


def format_match(row: dict, ticks: list[str], watched: str | None = None) -> str:
    e = html.escape
    kind = row.get("kind") or ""
    label = event_type(row.get("title") or "") if kind == "event" else KIND_LABELS.get(kind, "Opportunity")
    posted = row.get("posted_at") or row.get("first_seen_at")
    posted_text = "posted today" if posted and datetime.fromisoformat(posted).astimezone(UK).date() == datetime.now(UK).date() else (
        f"posted {_day(posted)}" if posted else "just found")
    if row.get("kind") == "event":  # an expo or hackathon: what it is and when it ends, not a deadline
        details = [event_type(row.get("title") or "")] + ([f"ends {_day(row['closes_at'])}"] if row.get("closes_at") else [])
    else:
        via = _via(row)
        details = [KIND_LABELS.get(row.get("kind") or "", "Opportunity"), f"via {via}" if via else posted_text]
        if row.get("closes_at"):
            details.append(f"deadline {_day(row['closes_at'])}")
        elif row.get("rolling"):
            details.append("rolling, apply early")
    where = row.get("location_text") or ("United Kingdom" if row.get("country") == "GB" else row.get("country") or "")
    if row.get("country") and row["country"] not in ALERT_COUNTRIES:
        where = f"{where}, {row['country']} (abroad)" if where and where != row["country"] else f"{row['country']} (abroad)"
    lines = [
        ("🔔 <b>Watched</b> · " if watched else "") + f"{TYPE_ICONS.get(kind, '⬜')} <b>{e(label.upper())}</b>",
        f"<b>{e(row['title'])}</b>",
        e(" · ".join(p for p in (row.get("company_name"), where) if p)),
        e(" · ".join(details)),
    ]
    if ticks:
        lines.append(e("  ".join(f"✓ {t}" for t in ticks)))
    if row.get("source_kind") in ("adzuna", "inbox"):
        lines.append("<i>Found on a job site, so it may have been up for a few days</i>")
    return "\n".join(lines)


def _buttons(row: dict) -> dict:
    return {"inline_keyboard": [
        [{"text": "Open on Nimbus", "url": open_on_nimbus(row)}],
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


def access_state(profile: dict, now: datetime | None = None) -> str:
    """paid | trial | locked: admins and payers always paid; otherwise free until trial_ends_at."""
    now = now or datetime.now(timezone.utc)
    if profile.get("is_admin") or profile.get("paid_at"):
        return "paid"
    ends = profile.get("trial_ends_at")
    if ends and datetime.fromisoformat(ends) > now:
        return "trial"
    return "locked"


def _gate(db: httpx.Client, telegram: "_Telegram | None", people: list[dict]) -> tuple[list[dict], dict[str, int | None]]:
    """Who may get alerts now, and how many more each trial user may get (None = no limit).
    Locked users get one message, once, saying their trial ended and how to unlock."""
    if not people:
        return [], {}
    ids = ",".join(p["user_id"] for p in people)
    profiles = {p["id"]: p for p in _fetch_all(db, "/profiles", {"select": "id,is_admin,paid_at,trial_ends_at,trial_notice_at", "id": f"in.({ids})"})}
    now = datetime.now(timezone.utc)
    allowed: list[dict] = []
    budget: dict[str, int | None] = {}
    for person in people:
        profile = profiles.get(person["user_id"]) or {}
        if PRIVATE and not profile.get("is_admin"):
            continue  # private: no alerts and no trial or payment messages for anyone else
        state = access_state(profile, now)
        if state == "locked":
            if telegram is not None and not profile.get("trial_notice_at"):
                note = f"⏳ <b>Your free Nimbus trial has ended.</b>\nUnlock every job and instant alerts for {PRICE}, once: {SITE_URL}/pay"
                if telegram.send(person["config"]["chat_id"], note):
                    db.patch("/profiles", params={"id": f"eq.{person['user_id']}"}, json={"trial_notice_at": now.isoformat()}).raise_for_status()
            continue
        allowed.append(person)
        budget[person["user_id"]] = TRIAL_ALERTS if state == "trial" else None
    trial_ids = [uid for uid, left in budget.items() if left is not None]
    if trial_ids:
        for alert in _fetch_all(db, "/alerts_sent", {"select": "user_id", "user_id": f"in.({','.join(trial_ids)})", "channel": "eq.telegram"}):
            budget[alert["user_id"]] = max(0, (budget[alert["user_id"]] or 0) - 1)
    return allowed, budget


def send_matches(rows: list[dict]) -> None:
    """New roles from this run, to everyone they fit."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token or not rows:
        return
    with client() as db:
        telegram = _Telegram(token)
        people, budget = _gate(db, telegram, _linked(db))
        if not people:
            return
        ids = ",".join(p["user_id"] for p in people)
        profiles = {p["id"]: p for p in _fetch_all(db, "/profiles", {"select": "id,preferences,cv_details", "id": f"in.({ids})"})}
        hidden: dict[str, set[str]] = {}
        for h in _fetch_all(db, "/hidden_opportunities", {"select": "user_id,opportunity_id", "user_id": f"in.({ids})"}):
            hidden.setdefault(h["user_id"], set()).add(h["opportunity_id"])
        seen = _seen_roles(db, ids)

        reached = 0
        for person in people:
            profile = profiles.get(person["user_id"]) or {}
            prefs = with_defaults(profile.get("preferences"))
            filters = filters_for(prefs)
            fits = []
            watch = prefs.get("watch") or []
            for row in rows:
                if row["id"] in hidden.get(person["user_id"], set()):
                    continue
                watched = watched_as(row.get("company_name") or "", watch)
                if watched and row.get("kind") in WATCH_KINDS and row.get("country") in ALERT_COUNTRIES and not row.get("defence") \
                        and is_engineering_role(row) and not is_muted(row, prefs):
                    rank = 10  # your watched companies first
                elif row.get("kind") == "event" and wanted_event(row, prefs):
                    rank = 5
                elif row.get("kind") in BOT_KINDS and is_engineering_role(row) and wanted(row, prefs, filters):
                    rank = fit(row, prefs, filters)[0]
                else:
                    continue
                fits.append((rank, fit(row, prefs, filters)[1], row, watched))
            fits.sort(key=lambda f: -f[0])  # watched companies, then events, then your own degree's roles
            # Once per role, however many places list it (this run and the last 30 days)
            mine = seen.setdefault(person["user_id"], [])
            unique = []
            for f in fits:
                key = same_role_key(f[2])
                if not is_repeat(key, mine):
                    mine.append(key)
                    unique.append(f)
            fits = unique
            chat = person["config"]["chat_id"]
            left = budget.get(person["user_id"])
            limit = MAX_PER_PERSON if left is None else min(MAX_PER_PERSON, left)
            if not fits or limit <= 0:
                continue
            sent_here = 0
            for _, ticks, row, watched in fits[:limit]:
                if _send_once(db, telegram, person["user_id"], row["id"], "telegram", chat, format_match(row, ticks, watched), _buttons(row)):
                    sent_here += 1
            if len(fits) > limit and left is not None:
                telegram.send(chat, f"🔒 {len(fits) - limit} more new matches for you. The free trial includes {TRIAL_ALERTS} alerts: unlock every alert for {PRICE}, once: {SITE_URL}/pay")
            elif len(fits) > limit:
                telegram.send(chat, f"…and {len(fits) - limit} more new roles for you this round. They're all on Nimbus: {SITE_URL}")
            reached += sent_here > 0
    print(f"Personal alerts: {telegram.sent} messages to {reached} people")


WELCOME_COLUMNS = "id,title,company_name,kind,disciplines,skills,country,remote,location_text,closes_at,posted_at,first_seen_at,opened_at,rolling,apply_url,source_kind,defence"


def send_welcome() -> None:
    """Someone who just connected gets their 3 best open matches straight away, so they see what
    alerts look like instead of waiting for the next new role."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    with client() as db:
        people = _gate(db, None, _linked(db))[0]
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
            ranked = sorted(((fit(r, prefs, filters), r) for r in recent if r.get("kind") in BOT_KINDS and is_engineering_role(r) and is_match(r, prefs, filters)),
                            key=lambda f: -f[0][0])
            fits, keys = [], []
            for f in ranked:
                if not is_repeat(same_role_key(f[1]), keys):
                    keys.append(same_role_key(f[1]))
                    fits.append(f)
            fits = fits[:3]  # newcomers have sent nothing yet, so this fits inside the trial's 5
            if not fits:
                continue
            chat = person["config"]["chat_id"]
            telegram.send(chat, "👋 <b>To get you started</b>, here are your best open matches right now. New ones will arrive the moment they open.")
            for (_, ticks, _), row in fits:
                _send_once(db, telegram, person["user_id"], row["id"], "telegram", chat, format_match(row, ticks), _buttons(row))
    print(f"Welcome matches: {telegram.sent} messages")


def send_reminders() -> None:
    """Calendar reminders due within a day, saved roles closing within 3 days, and follow-ups."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    now = datetime.now(timezone.utc)
    e = html.escape
    with client() as db:
        chats = {p["user_id"]: p["config"]["chat_id"] for p in _gate(db, None, _linked(db))[0]}
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


def send_trial_reminders() -> None:
    """Once, about TRIAL_REMIND_HOURS before a free trial ends: what stops, and the £5 link."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token or PRIVATE:
        return
    now = datetime.now(timezone.utc)
    stamp = lambda t: t.strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    with client() as db:
        due = _fetch_all(db, "/profiles", {
            "select": "id,trial_ends_at", "paid_at": "is.null", "is_admin": "not.is.true", "trial_reminder_at": "is.null",
            "and": f"(trial_ends_at.gt.{stamp(now)},trial_ends_at.lt.{stamp(now + timedelta(hours=TRIAL_REMIND_HOURS))})",
        })
        if not due:
            return
        chats = {p["user_id"]: p["config"]["chat_id"] for p in _linked(db)}
        telegram = _Telegram(token)
        for profile in due:
            chat = chats.get(profile["id"])
            if not chat:
                continue  # no Telegram: the website's banner says it instead
            hours = max(1, round((datetime.fromisoformat(profile["trial_ends_at"]) - now).total_seconds() / 3600))
            note = (f"⏳ <b>Your free Nimbus trial ends in about {hours} hour{'s' if hours != 1 else ''}.</b>\n"
                    f"After that, alerts and the full list of roles stop. Keep everything for {PRICE}, once (no subscription): {SITE_URL}/pay")
            if telegram.send(chat, note):
                db.patch("/profiles", params={"id": f"eq.{profile['id']}"}, json={"trial_reminder_at": now.isoformat()}).raise_for_status()
    print(f"Trial reminders: {telegram.sent} sent")


# ---------------------------------------------------------------- watchlist status, opening soon, morning digest

def _watch_rows(db: httpx.Client, entry: str) -> list[dict]:
    """Every role Nimbus has seen at a watched employer (open or closed), by its name."""
    first = company_key(entry).split(" ")[0] if company_key(entry) else ""
    if not first:
        return []
    rows = _fetch_all(db, "/opportunities", {"select": "company_name,kind,status,country,opened_at,first_seen_at,defence",
                                             "company_name": f"ilike.*{first}*"})
    return [r for r in rows if watched_as(r.get("company_name") or "", [entry])]


def watch_status(entry: str, rows: list[dict], now: datetime) -> str:
    """One line: what's open now, or when it last opened, and when it usually opens (once Nimbus has a
    year of history: the same employer's first placement or internship last season)."""
    student = [r for r in rows if r.get("kind") in BOT_KINDS and r.get("country") in ALERT_COUNTRIES and not r.get("defence")]
    open_now = [r for r in student if r.get("status") == "open"]
    if open_now:
        return f"✅ {html.escape(entry)}: {len(open_now)} placement{'s' if len(open_now) != 1 else ''} or internship{'s' if len(open_now) != 1 else ''} open"
    opened = sorted(datetime.fromisoformat(r.get("opened_at") or r["first_seen_at"]) for r in student)
    line = f"💤 {html.escape(entry)}: nothing open"
    if opened:
        line += f" (last opened {_dm(opened[-1])})"
    last_season = [d for d in opened if timedelta(days=300) <= now - d <= timedelta(days=430)]
    if last_season:
        expected = last_season[0] + timedelta(days=365)
        if timedelta(0) <= expected - now <= timedelta(days=21):
            line += f" · ⏳ usually opens around {_dm(expected)}"
    return line


def digest_text(new_count: int, closing: list[dict], watch_lines: list[str], events: list[dict]) -> str:
    """The morning message: what came in, what closes soon, your companies, and (Mondays) events."""
    e = html.escape
    lines = ["☀️ <b>Good morning. Your placement radar</b>",
             f"• {new_count} new placement{'s' if new_count != 1 else ''} and internships sent to you since yesterday"]
    if closing:
        lines += ["", "⏰ <b>Closing in the next 7 days, not applied yet</b>"]
        lines += [f"• <a href=\"{e(r['apply_url'], quote=True)}\">{e(r['title'][:80])}</a> · {e(r.get('company_name') or '')} · closes {_dm(datetime.fromisoformat(r['closes_at']), weekday=True)}"
                  for r in closing]
    if watch_lines:
        lines += ["", "🔔 <b>Your companies</b>"] + watch_lines
    if events:
        lines += ["", "🌍 <b>Hackathons and events coming up</b>"]
        lines += [f"• <a href=\"{e(r['apply_url'], quote=True)}\">{e(r['title'][:80])}</a> · {e(r.get('location_text') or r.get('country') or '')}"
                  + (f" · ends {_dm(datetime.fromisoformat(r['closes_at']))}" if r.get("closes_at") else "") for r in events]
    lines += ["", "Add companies with /watch Rolls-Royce, JCB · see them with /watchlist"]
    return "\n".join(lines)


def send_morning_digest() -> None:
    """Once a day after DIGEST_HOUR:DIGEST_MINUTE (UK): the morning summary for each person with Telegram."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    now = datetime.now(timezone.utc)
    local = now.astimezone(UK)
    if not token or (local.hour, local.minute) < (DIGEST_HOUR, DIGEST_MINUTE):
        return
    today = local.date().isoformat()
    with client() as db:
        people = _gate(db, None, _linked(db))[0]
        if not people:
            return
        ids = ",".join(p["user_id"] for p in people)
        profiles = {p["id"]: p for p in _fetch_all(db, "/profiles", {"select": "id,preferences,digest_sent_on", "id": f"in.({ids})"})}
        week = (now + timedelta(days=7)).isoformat()
        closing_soon = _fetch_all(db, "/opportunities", {"select": WELCOME_COLUMNS, "status": "eq.open", "country": "in.(GB,IE)",
                                                         "closes_at": f"gt.{now.isoformat()}", "and": f"(closes_at.lt.{week})", "order": "closes_at"})
        upcoming = [] if local.weekday() != 0 else _fetch_all(db, "/opportunities", {
            "select": WELCOME_COLUMNS, "status": "eq.open", "kind": "eq.event", "remote": "not.is.true",
            "or": f"(closes_at.is.null,closes_at.gt.{now.isoformat()})", "order": "closes_at.nullslast"})
        telegram = _Telegram(token)
        for person in people:
            profile = profiles.get(person["user_id"]) or {}
            if profile.get("digest_sent_on") == today:
                continue
            prefs = with_defaults(profile.get("preferences"))
            filters = filters_for(prefs)
            uid = person["user_id"]
            new_count = len(_fetch_all(db, "/alerts_sent", {"select": "opportunity_id", "user_id": f"eq.{uid}", "channel": "eq.telegram",
                                                           "sent_at": f"gt.{(now - DAY).isoformat()}"}))
            tracker = _seen_roles(db, uid).get(uid, [])
            tracked_ids = {a["opportunity_id"] for a in _fetch_all(db, "/applications", {"select": "opportunity_id", "user_id": f"eq.{uid}"})}
            closing = [r for r in closing_soon if r.get("kind") in BOT_KINDS and is_engineering_role(r) and wanted(r, prefs, filters)
                       and r["id"] not in tracked_ids and not is_repeat(same_role_key(r), tracker)][:8]
            watch_lines = [watch_status(entry, _watch_rows(db, entry), now) for entry in (prefs.get("watch") or [])[:25]]
            events = [r for r in upcoming if wanted_event(r, prefs)][:8]
            if telegram.send(person["config"]["chat_id"], digest_text(new_count, closing, watch_lines, events)):
                db.patch("/profiles", params={"id": f"eq.{uid}"}, json={"digest_sent_on": today}).raise_for_status()
    print(f"Morning digest: {telegram.sent} sent")
