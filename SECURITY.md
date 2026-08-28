# Security

Do not file public GitHub issues for vulnerabilities.

Use [GitHub Private vulnerability reporting](https://github.com/PixelPounder/planlens/security/advisories/new).

There is no personal security email. A public issue for a vulnerability is the wrong channel.

## What is in scope

- Planlens extension command execution (Run Plan)
- Polar checkout URL allowlist bypass
- License unlock without a Polar `granted` key
- Diagnostics or webview leaking plan JSON or license keys
- CSP / webview message handler abuse in Planlens

## What is out of scope

- PATH hijack of `terraform`/`tofu` **outside** the workspace (documented residual; same as a terminal)
- Secrets Terraform/OpenTofu did not mark `sensitive`
- Provider plugins Run Plan executes in the working directory after the user confirms
- VS Code / Cursor / Polar / marketplace infrastructure you do not own

Do not include exploit proof-of-concept that would let a stranger pwn third-party machines. Describe impact and the Planlens surface.
