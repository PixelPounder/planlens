# Privacy promises

These are product claims. Changing them is a High release class (`RELEASE.md`) and needs an owner-facing case **before** code.

## Promises

1. Planlens does not include first-party telemetry, analytics, crash reporting, usage tracking, or advertising identifiers.
2. Opening a plan JSON file does not make a Planlens network call.
3. Plan JSON is parsed locally and is not uploaded.
4. The only Planlens-initiated HTTP client is Polar license validation: `POST https://api.polar.sh/v1/customer-portal/license-keys/validate` with `{key, organization_id}` when the user enters a license key or invokes a Pro command **and** an organization id is configured.
5. Buy Pro opens only allowlisted `https` Polar checkout hosts.
6. **Copy Diagnostics** copies a redacted report to the clipboard. It does not send network traffic. It must not contain license keys, plan JSON, Terraform source, PATH, environment variables, or workspace paths.
7. Cursor, VS Code, marketplaces, Polar, and `terraform`/`tofu` (on Run Plan) have their own network behavior. Do not describe those as Planlens telemetry.

## Classes of data (keep these distinct)

| Class | Allowed? | Notes |
|---|---|---|
| Automatic telemetry | No | Not justified at this volume; would break the local/private wedge |
| Anonymous aggregate in-product | No | Still a background network client |
| User-initiated diagnostics | Yes | Clipboard only until the user pastes |
| Support submissions | Yes | Public GitHub Issues; user chooses what to paste |
| Marketplace statistics | Yes | Public install counts / ratings; no customer PII |
| Payment/license (Polar) | Polar's systems | Owner/agent may use Polar dashboard or API in a session; never commit keys |
| Public issue reports | Yes | Assume public forever; strip secrets if a user pastes them |

## Telemetry case (standing decision)

**Rejected.** A crash reporter would make silent failures visible. It would also send stacks that can include file paths and would contradict the privacy page and marketplace listing. Planlens is a niche $49 tool. Detection is reports + public signals + Polar, not a phone-home.

Reopen only if: (a) a widespread SEV1 cannot be diagnosed from reports, **and** (b) a design exists that is strictly user-opt-in, off by default, sends no plan JSON, and the privacy page is updated in the same release. That still requires the owner because it is a material privacy change.
