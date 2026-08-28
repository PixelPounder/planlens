# Launch authorization

Payout/KYC **does not** authorize public launch. Customers must not be able to install Planlens until this file’s proofs are `passed` in `watch/PROOF.json`.

Do not invent extra infrastructure. The operating path stays: public GitHub Issues + daily Cursor Automation running `WATCH.md`. This file is the **demonstration gate** on that path.

## Customers may install only when all are true

1. Polar payout connected **and** Planlens Pro product exists (license keys can be sold)
2. Public GitHub support/security is live (`STATE.support.public_inbox` is a real Issues URL; `SECURITY.md` is on that repo; issue templates are on that repo)
3. Cursor daily watch automation exists (`STATE.watch.cursor_automation` is `created`)
4. `ops/watch/PROOF.json` records **passed** (not assumed) for:
   - unattended loop while Cursor desktop is closed
   - unattended loop while the owner machine is asleep
   - unattended loop while the owner machine is offline
   - unattended loop across an owner-machine restart
   - a **failed** scheduled run is visible and the next run recovers
   - one harmless simulated incident through GitHub → watch → classify → surface

Marketing copy, marketplace drafts, and Polar product creation may happen before (4). **Listing / installable VSIX on Microsoft or OpenVSX may not.**

## What does not count as proof

- This chat, or any owner-started agent session, running `node planlens/ops/watch/check.mjs`
- Blog posts or Cursor marketing that automations “run in the cloud”
- `last-run.json` written by a local interactive session
- A GitHub issue the operator triages while the owner is in Cursor chatting

Evidence must come from a **scheduled (or webhook) automation run** whose start was not the owner opening this workspace to prompt an agent.

## Unattended-loop demonstration

Use the same Planlens daily watch automation (a shorter cron during the drill is allowed; restore daily after). For each row, record wall-clock window, automation run id or log URL, and result `passed` | `failed` | `undemonstrated`.

| Drill | Owner setup (one-time, not daily work) | Pass if |
|---|---|---|
| Cursor closed | Quit Cursor desktop. Do not open a Planlens chat. | Scheduled run still starts and leaves evidence (run log and/or commit/comment on the GitHub repo) |
| Machine asleep | Sleep the PC for a window that includes the scheduled fire | Same |
| Machine offline | Disconnect that PC for a window that includes the scheduled fire | Same |
| Machine restarted | Restart the PC before the fire; do not reopen a Planlens chat | Same |
| Scheduled run fails | One forced failure (e.g. `gh` unauthenticated, or a temporary bad command in the watch prompt). Restore after. | Failed run is visible in automation history; `PROOF` / issue / `last-run` from **that** run records the error; owner is not told all-clear; a later scheduled run succeeds without the owner babysitting |

If a drill **fails** (run did not start unless the desktop was open, or failure was silent): record `failed` with the observed behavior. Do not “fix” it by adding telemetry or a paid pager. Either adjust the watch to a runtime that actually fired in the drill (still Cursor Automation + GitHub — e.g. confirm Cloud environment, not a local machine runner) and **re-demonstrate**, or treat unattended operation as not met and **do not list**.

Third-party claims that Automations use Cursor Cloud are **not** a substitute for these drills on the owner’s account.

## Harmless simulated incident

1. Open a **public** GitHub issue on the Planlens repo titled `[drill] simulated support report — not a real customer`. Body: fake Copy Diagnostics (version `0.1.4`, no keys, no plan JSON) plus “review command showed a made-up error for this drill.”
2. Label `drill`. Do not ping the owner.
3. Leave it for the **next scheduled watch** (not an interactive session).
4. Pass when the watch run: finds the issue without the owner starting chat; classifies it (`drill` / SEV3); surfaces on the actual path (comment on the issue stating classification + that no owner interrupt is required); updates `PROOF.json` (via commit on that run, or a follow-up that quotes the automation log — the discovery itself must be the scheduled run).
5. Close the drill issue.

Appropriate surfacing for this harmless SEV3 is the GitHub issue + proof record. **Pinging the owner would be a fail** for this drill.

## After Polar payout (sequence)

Payout remains the current owner action. When they return:

1. Polar Planlens Pro $49 product (still not listing)
2. Public GitHub repo with Issues + security reporting + templates (owner identity)
3. Create the daily watch automation (owner one-time)
4. Execute this proof protocol; fill `PROOF.json`
5. Only then marketplace listing
