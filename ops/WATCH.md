# Watch — what can actually be observed

## The honest answer

If Planlens breaks for a user tomorrow and they file nothing, **you will not know**. That is the cost of no telemetry. Do not paper over it.

You **will** know if:

- A user opens a GitHub issue (seen on the next watch run, ≤ ~24h once automation exists)
- A marketplace review or Q&A appears (public pages, same watch)
- Polar shows new orders, refunds, or disputes (dashboard/API in a session, or Polar email to the owner)
- Terraform / OpenTofu / VS Code / Cursor / HashiCorp extension releases a version that may break parse or Run Plan (public GitHub releases, same watch)

You **will not** know if:

- The extension fails to activate on one OS
- A plan JSON shape you never tested throws locally
- Polar validate is down for one user who does not write
- The owner’s Gmail has a publisher notice you were not forwarded

## Tooling that exists in this workspace

| Signal | How | Cost | Needs owner identity? |
|---|---|---|---|
| Public GitHub releases (terraform, opentofu, vscode, vscode-terraform) | `ops/watch/check.mjs` | $0 | No |
| This repo’s GitHub Issues | `gh issue list` during watch | $0 | Yes — public repo + `gh` auth |
| Marketplace install/rating pages | Fetch listing URLs once listed | $0 | No (public HTML) |
| Polar orders/licenses | Polar dashboard or API in a **running session** | $0 | Yes — not in git |
| Polar/Microsoft email | Owner inbox | $0 | You cannot read it |
| In-product crashes | None | — | Telemetry rejected |
| Cursor Automation daily cron | Starts a session only if that automation actually fires | Uses existing Cursor plan | Yes — one-time create. **Unattended behavior is undemonstrated** until `LAUNCH.md` drills pass. |

Cursor Automations in this product surface support **cron** and **webhook**, not “new GitHub issue”. Daily cron is the launch monitor. Webhook is optional later.

## Daily watch procedure (agent prompt)

When a watch session starts:

1. Read `ops/STATE.json` and `ops/AUTHORITY.md`.
2. Run `node planlens/ops/watch/check.mjs` from the workspace root (or `planlens/ops/watch`).
3. If `support.public_inbox` is set and `gh` works: list open issues, newest first.
4. If listed: fetch marketplace listing pages recorded in STATE; update install/rating counts.
5. If Polar org id is known and a Polar token exists **in the environment** (never git): list new orders/refunds since `metrics`.
6. Write `ops/watch/last-run.json` and update STATE metrics.
7. If nothing needs a code change and no SEV0/1: **stop**. Do not message the owner.
8. If work is needed: do it in that session (fix, test, draft release note). Interrupt the owner only per `AUTHORITY.md`.

## Create the Cursor Automation (one-time, owner)

Do not create it until the GitHub repo exists (otherwise the job has almost nothing to read). Draft:

- **Name:** Planlens daily watch
- **Trigger:** every day
- **Instructions:** follow `planlens/ops/WATCH.md` daily watch procedure. Do not ping the owner for all-clear.
- **Tools:** repo checkout, network fetch, `gh` if authenticated.

A future session may open the Automations editor when the owner asks to create it. Until `STATE.watch.cursor_automation` is `created` **and** `ops/watch/PROOF.json` unattended rows are `passed`, assume **no demonstrated unattended watch**. A local interactive run of `check.mjs` is not the loop.

## Cadence vs emergencies

Daily is enough for a $49 niche extension. SEV0 security should use GitHub private advisories (once the repo exists), which may wait until the next watch **unless** the reporter also triggers a Polar/marketplace email. That lag is accepted vs telemetry. If a reporter emails Polar, Polar may loop the owner — that is the fast path for true emergencies.
