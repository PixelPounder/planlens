# Decisions

Append-only. Newest first.

## 2026-08-27 — Listing requires demonstrated unattended loop + GitHub drill

**Decision:** Polar payout/KYC may proceed and does **not** authorize public launch or customer installs. Architecture unchanged (GitHub Issues + daily Cursor Automation). Before listing: public GitHub support/security live; `ops/LAUNCH.md` drills passed and written to `ops/watch/PROOF.json`. Interactive `check.mjs` runs do not count. Cursor closed / machine asleep / offline / restarted / failed schedule are all `undemonstrated` until executed on the owner’s automation. Harmless simulated incident must be discovered by a scheduled watch, classified SEV3/drill, surfaced on the GitHub issue, and must not ping the owner.

**Rejected:** Treating payout-complete as launch; claiming cloud execution from vendor blogs; adding a new pager/host to skip the demonstration.

## 2026-08-27 — Agent-operated model; no telemetry; GitHub Issues as desk

**Decision:** Operate Planlens as an agent-run product. Owner is legal/financial authority only. Detect breakage via user reports + public signals, not first-party telemetry. Public GitHub Issues are the support desk (repo not created yet — launch blocker). Daily Cursor Automation is the unattended loop (not created yet — launch blocker). Copy Diagnostics is clipboard-only.

**Why:** The owner will not staff a second job. Telemetry would break the privacy claim that is part of the product. Cursor Automations cannot subscribe to GitHub issues natively, so cron is the realistic monitor. Polar KYC/bank is independent of listing and may proceed; **listing may not**.

**Rejected:** In-product analytics; personal email as support; owner daily dashboard checks; buying a domain before GitHub Pages is tried; creating a Cursor Automation in this session without an explicit “create the automation” ask (and before a GitHub repo exists).

## 2026-08-26 — Price USD $49 one-time; Polar Starter; no ads

Unchanged. No new evidence.

## 2026-08-26 — No first-party telemetry in 0.1.3

Verified on packaged JS. Polar validate is the only Planlens HTTP client. Privacy page updated the same day.
