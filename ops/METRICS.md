# Metrics and kill/continue

No in-product telemetry. Scoreboard is **public marketplace counts + Polar orders + cash in `ledger.json`**.

## Record in STATE.json after each watch

- `installs_vscode` / `installs_openvsx` (from listing pages; null if unlisted)
- `orders`, `refunds` (Polar; 0 until product exists)
- `listed_at`, `day_90_review_at`

Do not invent numbers. If a page cannot be parsed, leave null and say so in `last-run.json`.

## Hurdle

Cursor Ultra ~USD $200/month. Owner ~47% Alberta marginal on extra sole-prop profit if Ultra stays a personal bill. Polar Starter (org after 27 May 2026): **5% + 50¢** per charge plus Polar extras (e.g. international cards). Payout: Stripe CAD bank, conversion fees.

Cash operating cost of this model at current scale: **$0** (GitHub free, no hosting, no ads). Cursor usage of the daily watch is billed against the subscription this product is trying to cover. That is circular and accepted: if Cursor is cancelled, the agent-operated model dies.

## Kill framework (unchanged)

Clock starts at **first public listing**, not at Polar KYC.

- ~0 installs at 90 days → kill (discovery)
- ≥100 installs and 0 orders → pivot or kill (value/price)
- 1–4 orders → +30 days if reviews are not hostile
- ≥5 paid and no security incident → continue
- Do not buy ads
- Do not spend the CAD $500 on acquisition

Owner makes the kill decision. You prepare the memo from STATE + ledger. Do not wait until day 90 if reviews are hostile or a SEV0 is mishandled.

## Feature requests

Default **later**. Build only if it increases paid conversion or reduces SEV1 support load. Compare-plans/Run Plan already are the wedge.
