# Support

## How customers find help

1. **In product:** Command Palette → **Planlens: Copy Diagnostics**. Clipboard report. No network.
2. **Public inbox:** [GitHub Issues](https://github.com/PixelPounder/planlens/issues). URL lives in `STATE.json` → `support.public_inbox` and in `package.json` `bugs.url`, README, and the site.
3. **Marketplace:** VS Code / OpenVSX Q&A and reviews. Treat as public support. Triage on the daily watch, not via the owner’s morning email.
4. **Paid license problems:** Polar customer portal / receipt first. If Polar emails the merchant, that is an owner interrupt (you cannot read that inbox).

Until `support.public_inbox` is a live URL **and** `ops/LAUNCH.md` proofs have passed, **do not list Planlens**. The GitHub inbox can exist before listing; customers must not be able to install until proofs pass.

## What users must not paste

License keys, plan JSON, `.tf` / `.tfvars`, cloud credentials, Polar cookies, screenshots of secrets. If they do: edit/redact the issue, tell them, do not copy secrets into git.

## How reports reach the agent (not the owner)

GitHub Issues are the desk. Cursor Automations **cannot natively trigger on new issues**. Therefore:

- **Primary:** daily Cursor Automation runs `ops/watch/check.mjs` and `gh issue list` (once the repo exists). If an open issue is new or SEV0/1, the automation works the issue in that run (reproduce → fix or draft reply → update STATE).
- **Optional later (still $0):** GitHub issue webhook → Cursor webhook automation for faster than 24h. Not required at launch.
- **Owner email is not the desk.** Do not print a personal email on the site.

You do not “receive” reports while no session is running. The watch job is what starts a session.

## Routine handling (you)

| Incoming | You do |
|---|---|
| Bug with diagnostics | Reproduce, classify, fix or ask one clarifying question on the issue |
| “How do I export JSON?” | Answer from README; close |
| License invalid | Check they bought Planlens Pro, key is granted, org id is in the installed build. Do not ask them to paste the key in public. Offer Polar portal. Refunds → owner |
| Feature request | Label `later` unless it unblocks paid review or the hurdle |
| Hostile / spam | Label, don’t argue, don’t escalate unless legal/malware |
| Review on marketplace | Reply as Planlens if a publisher reply API/UI is available in-session; otherwise draft text in the issue and only ping the owner if a reply requires their logged-in click |

Target: first agent response on a weekday watch run, not a human SLA. Polar’s own 48h merchant-loop is the exception (`INCIDENTS.md`).

## You vs owner

Routine bugs and questions never become a human ticket. Refunds, legal, account lockout, and Polar-looped threads do.
