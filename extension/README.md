# Planlens

Review plans for Terraform and OpenTofu as a structured diff.

Planlens is not affiliated with, endorsed by, or sponsored by HashiCorp. “Terraform” is a trademark of HashiCorp. “OpenTofu” is a trademark of the Linux Foundation.

## What it does

Open JSON produced by `terraform show -json` or `tofu show -json`. Planlens lists creates, updates, destroys, and replacements, with attribute diffs.

## What it does not claim

Planlens does **not** promise that all secrets are hidden. It redacts values the plan marks with `before_sensitive` / `after_sensitive`. Secrets that Terraform/OpenTofu did not mark sensitive can still appear in the review.

Planlens does **not** upload plan JSON. Opening a plan file does not contact Polar. Polar license validation runs only when you enter a license key or use a Pro command, and only if a Polar organization id is configured. That request contains the license key and organization id, not the plan.

**Run Plan** (Pro) executes the first `terraform.exe` / `tofu.exe` (Windows) or `terraform` / `tofu` (macOS/Linux) on your editor process PATH, after a confirmation. That is the same resolution a terminal in this environment would use, including user-writable PATH directories. Planlens will not run a `terraform`/`tofu` binary whose path is inside the workspace. It will not run `.cmd`/`.bat` shims. The CLI may contact backends, providers, and registries according to **your** configuration, inherit this process environment (including `TF_CLI_ARGS*`), lock state, and execute provider plugins from the working directory. Planlens does not apply changes.

## Free

- Open a plan JSON file
- Filter and search
- Redact plan-marked sensitive values
- Review stays in the editor process

## Planlens Pro ($49)

- Run `terraform`/`tofu` plan from the editor (confirmed, no extra shell arguments)
- Copy a PR markdown summary
- Compare two plans

## Support

Command Palette → **Planlens: Copy Diagnostics** copies a redacted report (no license key, no plan JSON). Paste it into a [GitHub issue](https://github.com/PixelPounder/planlens/issues). Do not paste license keys, plan JSON, or `.tf` files. Security reports: see [SECURITY.md](https://github.com/PixelPounder/planlens/blob/main/SECURITY.md).

## Produce a plan JSON

```bash
terraform plan -out=plan.bin
terraform show -json plan.bin > tfplan.json
```

Open `tfplan.json` (the filename should include `tfplan` so the editor title action appears) and run **Planlens: Review Active Plan JSON**. If the Command Palette has focus, Planlens uses the active tab. You can also run **Planlens: Open Plan JSON** and pick the file.
