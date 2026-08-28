# Releases

Not every change gets the 0.1.x adversarial audit. Classify first. Then run only that class’s gates. The owner should be able to approve from the release note without reading the diff.

## Classes

| Class | Examples | Gates | Human test? | Owner click? |
|---|---|---|---|---|
| **Low** | Copy, README, site CSS, labels, comments | `npm test`; no new network; privacy page unchanged | No | No, unless this is the listed marketplace version they must upload |
| **Medium** | Parser edge cases, UI layout, filters, diagnostics clipboard fields (non-secret), compare/markdown formatting | Tests for the change; grep that no `fetch`/exec paths grew; pack VSIX; skim privacy | No, unless it changes visible review layout in a way tests cannot see | Marketplace upload if already listed |
| **High** | `execFile`/Run Plan, PATH, Polar, checkout allowlist, license grant logic, filesystem, permissions, CSP, webview message handlers, dependencies, anything that can see plan JSON | Full `npm test`; targeted adversarial tests; VSIX JS grep for `fetch`, `exec`, telemetry strings; privacy diff; HAT only if exec/network/webview/CSP changed | **HAT required** if command execution, networking, licensing, or webview CSP/message surface changed | Yes — they run HAT or explicitly waive in writing on the release note |
| **Privacy/policy** | New network destination, diagnostics contents that could include paths, marketplace claims | Written case in `DECISIONS.md`; privacy.html same release; owner approval **before** merge | As High if code changes | Yes |

Default to the **higher** class if unsure.

HAT = owner (or a designated human) installs the VSIX in their normal Cursor, opens `fixtures/sample.tfplan.json`, checks menus, redaction, Pro gate. Not a substitute for real terraform/Polar if those surfaces changed — say so in remaining risk.

## Versioning

- Patch `0.1.z` — fixes and ops-safe changes
- Minor `0.y.0` — user-visible Pro/free behavior
- **Never** ship a High change as “just docs”

Keep `STATE.json` version in sync. Packaged `.vsix` path in STATE must match the file on disk.

## Owner-facing note (required)

```
Planlens X.Y.Z ready for release

Why the update exists:
What changed:
Tests performed:
Security/privacy impact:
Business/customer impact:
Remaining risk:
Human testing necessary: yes/no (why)
Exact action required from you:
```

If Exact action is “none”, do not ping. If the extension is already listed, Exact action is usually “upload this VSIX on Marketplace / OpenVSX” unless a publish token is in the session env.

## Do not

- Skip tests because the change “looks small”
- Raise class to High for every CSS tweak
- Claim marketplace publish happened if you only packed a VSIX
