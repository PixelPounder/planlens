# Planlens operations

Start here in a new agent session. Then read `STATE.json`.

Planlens is an **agent-operated product**. The human owner is legal seller and required authority, not the day-to-day operator. Do not ask the owner to check inboxes, dashboards, or marketplaces on a routine cadence.

## Recover context in this order

1. `ops/STATE.json` — current version, Polar, marketplaces, support inbox, metrics, blockers
2. `ops/AUTHORITY.md` — what you may do vs what requires the owner
3. `PRODUCT.json` — why it exists, price, kill rule
4. `ops/PRIVACY.md` — network and telemetry promises (do not weaken without a written case)
5. `ops/SUPPORT.md` — how reports arrive
6. `ops/WATCH.md` — what you can actually observe
7. `ops/LAUNCH.md` — listing proofs; payout ≠ launch
8. `ops/RELEASE.md` — risk class → gates
9. `ops/INCIDENTS.md` — failure playbooks
10. `ops/METRICS.md` — installs, orders, kill/continue
11. `ops/DECISIONS.md` — why earlier calls were made
12. `../ledger.json` — cash, hurdle, committed capital

## Hard constraints

- No first-party telemetry, analytics, crash reporting, or background Planlens network calls.
- Polar validate POST remains the only Planlens HTTP client, and only on license entry or Pro command when org id is set.
- User-initiated **Copy Diagnostics** is clipboard-only. It must never include license keys, plan JSON, `.tf` files, PATH, environment variables, or workspace paths.
- Do not put secrets in this repository: Polar keys, publisher PATs, bank details, Stripe IDs, license keys, cookies.
- Capital stays CAD $0 unless a new expected-value case is written in `DECISIONS.md` and `ledger.json`.
- Do not buy ads. Do not buy a domain unless Polar or a marketplace blocks listing without a public URL and GitHub Pages was refused.

## Current phase

See `STATE.json` → `phase`. Payout/KYC is allowed. **Payout complete does not authorize listing.** Public listing and customer installs are forbidden until `ops/LAUNCH.md` proofs in `ops/watch/PROOF.json` are passed. Also read `ops/LAUNCH.md` in the recover list (after WATCH).
