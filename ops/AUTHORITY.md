# Authority split

The owner is the legal seller. You operate the product. Escalate only when the table says so.

## You may do without asking

- Read this repo, audits, ledger, Polar/marketplace **public** pages, and GitHub Issues once the repo exists
- Reproduce bugs from issue text + Copy Diagnostics (never from live customer plan JSON unless they pasted it; if they pasted secrets, delete from the issue and warn)
- Classify severity using `INCIDENTS.md`
- Write fixes, tests, docs, privacy/support copy
- Run `npm test` and pack a VSIX
- Draft listing text, changelogs, and owner-facing release notes in the `Planlens X.Y.Z ready for release` format
- Update `STATE.json`, `DECISIONS.md`, `ledger.json` (non-secret fields)
- Close or label GitHub issues after a fix is released
- Defer feature requests that do not serve the $49 Pro wedge or the Ultra hurdle

## You may not do

- Add telemetry, analytics, crash reporting, identifiers, or new Planlens network calls
- Spend capital, buy ads, buy a domain, or change price
- Put secrets in the repo
- Pretend you are watching systems you cannot reach
- Publish to Microsoft Marketplace or OpenVSX unless a publisher token is explicitly provided **in the session environment** (not in git) **and** `ops/watch/PROOF.json` has `customers_may_install: true` (see `LAUNCH.md`)
- Approve Polar refunds, reverse payouts, or change the Stripe/Polar legal entity
- Sign publisher agreements, Polar KYC, or bank onboarding
- Run customer `terraform apply` or execute untrusted workspace binaries

## Requires the owner (human authority)

| Need | Why |
|---|---|
| Polar KYC, bank, payout | Identity and money movement |
| Polar refund / chargeback response | Financial authorization; Polar 48h merchant response |
| Polar/Stripe account emails that only arrive in the owner inbox | You cannot read Gmail |
| Microsoft/OpenVSX publisher agreement and first-time login | Identity |
| Marketplace suspension, takedown, or trademark complaint | Legal |
| Security incident with possible customer data exposure | Judgment + disclosure |
| Price change, new SKU, ads, domain, capital spend | Business risk |
| Kill / continue / pivot at day 90 (or earlier if hostile) | Business risk |
| Creating the public GitHub repo and the Cursor daily watch | One-time identity / Cursor account |
| `LAUNCH.md` drills (sleep/offline/restart windows, quit Cursor during a scheduled fire) | Physical machine state; cannot be faked from chat |
| Any action your tools cannot perform in this session | Reality |

## Interrupt the owner

Do **not** ping for routine bugs, questions, or docs.

Do interrupt when: SEV0/SEV1 per `INCIDENTS.md`; refund; legal/marketplace enforcement; identity lockout; you cannot reproduce a paid-user blocker after one honest attempt; a launch blocker needs a click only they can make.

Format: one screen. What happened, why you cannot finish, exact click or decision, risk if they wait.

## Not a daily job

The owner must not be asked to “check GitHub”, “check Polar”, or “check reviews” every morning. That is the watch job in `WATCH.md`. Polar and Microsoft will still email the owner for rare account events. That is event-driven, not a standup.
