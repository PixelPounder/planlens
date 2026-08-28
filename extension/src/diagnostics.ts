export type DiagnosticInput = {
  planlensVersion: string;
  editorAppName: string;
  editorVersion: string;
  osPlatform: string;
  osArch: string;
  extensionMode: "production" | "development" | "test" | "unknown";
  binarySetting: string;
  licenseKeyPresent: boolean;
  polarOrganizationIdConfigured: boolean;
  checkoutUrlConfigured: boolean;
  lastError: string | null;
  supportUrl: string | null;
};

export function formatDiagnostics(input: DiagnosticInput): string {
  return [
    "Planlens diagnostics (safe to paste in a public GitHub issue).",
    "Do not add license keys, plan JSON, or Terraform source below.",
    "",
    `planlens_version: ${input.planlensVersion}`,
    `editor: ${input.editorAppName} ${input.editorVersion}`,
    `os: ${input.osPlatform} ${input.osArch}`,
    `extension_mode: ${input.extensionMode}`,
    `binary_setting: ${input.binarySetting}`,
    `license_key_present: ${input.licenseKeyPresent ? "yes" : "no"}`,
    `polar_organization_id_configured: ${input.polarOrganizationIdConfigured ? "yes" : "no"}`,
    `checkout_url_configured: ${input.checkoutUrlConfigured ? "yes" : "no"}`,
    `last_error: ${input.lastError ?? "(none)"}`,
    `support_url: ${input.supportUrl ?? "(not published yet)"}`,
    "",
  ].join("\n");
}

export function assertDiagnosticsSafe(text: string, extras: string[] = []): void {
  const hay = text.toLowerCase();
  for (const extra of extras) {
    if (extra && hay.includes(extra.toLowerCase())) {
      throw new Error("Diagnostics report contained a forbidden secret fragment.");
    }
  }
}
