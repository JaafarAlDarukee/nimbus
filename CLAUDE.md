# Nimbus: notes for Claude

Nimbus is a private job radar for UK engineering students ("Opportunities, the moment they form."). The owner is a first-time coder: guide them step by step in plain English.

**Start every session by reading `vault/00 Start Here.md`** (an Obsidian vault). It links to the roadmap and status, decisions, architecture, and the next steps. Update the vault (status, decisions, session log) whenever something meaningful changes, so work can continue after the conversation resets.

## Non-negotiables
- Never ask for, handle or print secret values. The owner creates accounts and pastes keys (`gh secret set`, Supabase dashboard/Vault).
- This repo is **public** and CI logs are public: no personal data (emails, names, chat IDs, inbox contents) in commits or logs.
- Nimbus never applies to or messages employers. It never shows Airbus, BAE Systems, Boeing, or nuclear / weapons / defence roles.
- Don't bypass sites that block automated access.
- Next.js here is v16: read `web/AGENTS.md` and the bundled docs before using unfamiliar APIs.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Layout
`radar/` Python checker (GitHub Actions) · `data/` seed and discovered boards · `supabase/` migrations, config, email templates · `web/` Next.js site · `vault/` project memory · `design/` owner's design exports (git-ignored, local only).
