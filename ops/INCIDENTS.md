# Incidents

Classify, then follow the row. Update `STATE.json`. Do not wait for the owner on SEV2/SEV3.

## Severity

- **SEV0** — security exploit in Planlens, secret exposure by us, marketplace malware claim, Polar payout compromise
- **SEV1** — most paying users cannot review plans or cannot license; marketplace listing down
- **SEV2** — a version/OS/terraform combo broken; workaround exists; or Polar flaky
- **SEV3** — cosmetic, docs, one-off confusion

## Playbooks

### 1. Ordinary bug (SEV3/SEV2)

Reproduce from diagnostics + fixture or a **redacted** sample. Fix, test, Low/Medium release. Reply on the issue. Owner: none.

### 2. Widespread regression (SEV1)

Stop shipping. Identify last good VSIX. If listed, prepare rollback listing (previous VSIX) as Medium/High depending on the defect. Draft marketplace “known issue” text. Owner: upload rollback if you cannot publish. Customers: GitHub issue + marketplace update, not email blast (no customer email list; Polar can message buyers only if Polar provides it — do not scrape).

### 3. Security vulnerability (SEV0)

Do not discuss exploit steps on a public issue. Move to GitHub private advisory if available. Patch, High gates, privacy review. Owner: yes — disclosure decision, marketplace security questionnaire if any. Do not add telemetry as a “fix”.

### 4. Accidental exposure of sensitive information (SEV0)

If **we** shipped a leak (diagnostics, webview, logs): High patch that removes it; rotate Polar org tokens if they leaked from **our** repo (they should never have been there). If a **user** pasted secrets in a public issue: delete/redact, tell them to rotate **their** secrets; we do not rotate their cloud keys. Owner: yes if the leak is ours or legal exposure.

### 5. Broken payment/license (SEV1)

Confirm Polar status page / validate endpoint from a session. Confirm org id in the listed build matches Polar. Do not log license keys. If Polar is down: public issue “Polar validation unavailable; free review still works”. If our allowlist/org id is wrong: High patch. Refunds for “paid but unlocked fail”: owner must execute in Polar.

### 6. Hostile or malicious report (SEV3 unless legal)

Do not run attached binaries. Do not apply their terraform. If it is a real vuln, treat as (3). If abuse/spam, close. If extortion or legal threat: owner.

### 7. Marketplace suspension or policy complaint (SEV0/SEV1)

Stop arguing in public. Owner: yes. Draft a factual response from privacy.md + code facts. Do not quietly add requested telemetry.

### 8. Terraform / OpenTofu / platform update breaks Planlens (SEV2/SEV1)

Watch script flags a new release. Reproduce against fixture + documented JSON schema change. Parser Medium; Run Plan exec High. If HashiCorp official extension adds plan review: record in DECISIONS — this is a **business** threat, not a crash; day-90 math may move up. Owner only if kill/pivot.

### 9. Cannot reproduce

Ask for Copy Diagnostics + editor version on the issue (one question). If paid-user blocker and still unreproducible: owner interrupt with “need a redacted sample or a screenshare they run; I cannot get further.”

### 10. Cannot fix autonomously

Name the blocker (needs Polar dashboard click, publisher login, OS you cannot run, legal). Owner interrupt with the exact action. Do not leave a silent SEV1.

## Alerting the owner

You have **no push channel to their phone**. Channels that exist:

1. Cursor session they already opened
2. Daily watch automation (if created) that may notify via whatever the Automation is configured to use
3. Polar/Microsoft email already going to them

For SEV0, do the patch work first, then the interrupt. Do not wait for a morning check-in that we promised they would not have.
