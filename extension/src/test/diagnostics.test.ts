import assert from "node:assert/strict";
import test from "node:test";
import { assertDiagnosticsSafe, formatDiagnostics } from "../diagnostics";

test("diagnostics omit secrets and plan JSON fields", () => {
  const text = formatDiagnostics({
    planlensVersion: "0.1.4",
    editorAppName: "Cursor",
    editorVersion: "1.0.0",
    osPlatform: "win32",
    osArch: "x64",
    extensionMode: "production",
    binarySetting: "auto",
    licenseKeyPresent: true,
    polarOrganizationIdConfigured: true,
    checkoutUrlConfigured: false,
    lastError: "Open a Terraform/OpenTofu folder first.",
    supportUrl: null,
  });
  assert.match(text, /planlens_version: 0\.1\.4/);
  assert.match(text, /license_key_present: yes/);
  assert.doesNotMatch(text, /resource_changes/);
  assert.doesNotMatch(text, /sk_live/);
  assertDiagnosticsSafe(text, ["sk_live", "hunter2"]);
});

test("assertDiagnosticsSafe throws if a key leaks", () => {
  assert.throws(() => assertDiagnosticsSafe("key hunter2 leaked", ["hunter2"]));
});
