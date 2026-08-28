import * as vscode from "vscode";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { parsePlanText, type PlanSummary } from "./parsePlan";
import { toPullRequestMarkdown } from "./markdown";
import { comparePlans, validatePolarLicense, type LicenseState } from "./license";
import { renderCompareHtml, renderReviewHtml } from "./webview/reviewHtml";
import { resolveActiveFileUri } from "./activeUri";
import { assertDiagnosticsSafe, formatDiagnostics } from "./diagnostics";
import {
  MAX_PLAN_BYTES,
  assertNotWorkspaceBinary,
  assertReadablePlanSize,
  execFileUtf8,
  isAllowedCheckoutUrl,
  isAllowedEngineName,
  resolveEnginePath,
} from "./safety";

let lastPlan: PlanSummary | undefined;
let lastPlanLabel = "plan";
let cachedLicense: LicenseState | undefined;
let extensionMode = vscode.ExtensionMode.Production;
let lastError: string | null = null;

function noteError(message: string): string {
  lastError = message;
  return message;
}

function nonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function config() {
  return vscode.workspace.getConfiguration("planlens");
}

function workspaceFolderPaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

async function licenseState(): Promise<LicenseState> {
  if (
    extensionMode === vscode.ExtensionMode.Development &&
    config().get<boolean>("devUnlock")
  ) {
    return { pro: true, message: "devUnlock" };
  }
  const key = config().get<string>("licenseKey") ?? "";
  const org = config().get<string>("polarOrganizationId") ?? "";
  if (!key.trim()) {
    return { pro: false, message: "No license key." };
  }
  if (cachedLicense?.pro) {
    return cachedLicense;
  }
  cachedLicense = await validatePolarLicense(key, org);
  return cachedLicense;
}

function isProCached(): boolean {
  if (
    extensionMode === vscode.ExtensionMode.Development &&
    config().get<boolean>("devUnlock")
  ) {
    return true;
  }
  return cachedLicense?.pro === true;
}

async function requirePro(feature: string): Promise<boolean> {
  if (isProCached()) {
    return true;
  }
  const state = await licenseState();
  if (state.pro) {
    return true;
  }
  const checkout = config().get<string>("checkoutUrl") ?? "";
  const canBuy = checkout.length > 0 && isAllowedCheckoutUrl(checkout);
  const pick = await vscode.window.showWarningMessage(
    `${feature} is Planlens Pro ($49). Free review of an existing plan JSON file stays available.`,
    "Enter license",
    canBuy ? "Buy Pro" : "OK"
  );
  if (pick === "Enter license") {
    await enterLicense();
    return isProCached();
  }
  if (pick === "Buy Pro" && canBuy) {
    await vscode.env.openExternal(vscode.Uri.parse(checkout));
  }
  return false;
}

function showPlan(
  context: vscode.ExtensionContext,
  plan: PlanSummary,
  title: string,
  pro: boolean
) {
  lastPlan = plan;
  lastPlanLabel = title;
  const panel = vscode.window.createWebviewPanel(
    "planlens.review",
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  const n = nonce();
  panel.webview.html = renderReviewHtml(plan, n, panel.webview.cspSource, pro);
  panel.webview.onDidReceiveMessage(
    async (msg: { type?: string }) => {
      if (msg.type === "copyMarkdown") {
        if (!(await requirePro("Copy PR markdown"))) {
          return;
        }
        if (!lastPlan) {
          return;
        }
        await vscode.env.clipboard.writeText(toPullRequestMarkdown(lastPlan));
        vscode.window.showInformationMessage("Planlens markdown copied.");
      }
      if (msg.type === "compare") {
        if (!(await requirePro("Compare plans"))) {
          return;
        }
        await compareWithFile(context, lastPlan);
      }
    },
    undefined,
    context.subscriptions
  );
}

async function readPlanFromUri(uri: vscode.Uri): Promise<PlanSummary> {
  if (uri.scheme === "file") {
    await assertReadablePlanSize(uri.fsPath);
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  if (bytes.byteLength > MAX_PLAN_BYTES) {
    throw new Error(
      `Plan file is ${bytes.byteLength} bytes. Planlens refuses files larger than ${MAX_PLAN_BYTES} bytes.`
    );
  }
  return parsePlanText(Buffer.from(bytes).toString("utf8"));
}

async function reviewUri(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    const plan = await readPlanFromUri(uri);
    showPlan(context, plan, `Planlens: ${path.basename(uri.fsPath)}`, isProCached());
  } catch (error) {
    vscode.window.showErrorMessage(
      noteError(error instanceof Error ? error.message : "Failed to open plan.")
    );
  }
}

async function enterLicense() {
  const key = await vscode.window.showInputBox({
    title: "Planlens Pro license key",
    prompt: "Paste the Polar license key from your receipt.",
    ignoreFocusOut: true,
    password: true,
  });
  if (key === undefined) {
    return;
  }
  await config().update("licenseKey", key.trim(), vscode.ConfigurationTarget.Global);
  cachedLicense = undefined;
  const state = await licenseState();
  vscode.window.showInformationMessage(
    state.pro ? "Planlens Pro is active." : state.message ?? "License not valid yet."
  );
}

async function resolveConfiguredEngine(): Promise<string> {
  const setting = config().get<string>("binary") ?? "auto";
  if (isAllowedEngineName(setting)) {
    return resolveEnginePath(setting);
  }
  try {
    return await resolveEnginePath("tofu");
  } catch {
    return resolveEnginePath("terraform");
  }
}

async function runPlan(context: vscode.ExtensionContext) {
  if (!(await requirePro("Run plan"))) {
    return;
  }
  const folder =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    (vscode.window.activeTextEditor
      ? path.dirname(vscode.window.activeTextEditor.document.uri.fsPath)
      : undefined);
  if (!folder) {
    vscode.window.showErrorMessage(
      noteError("Open a Terraform/OpenTofu folder first.")
    );
    return;
  }

  let enginePath: string;
  try {
    enginePath = await resolveConfiguredEngine();
    assertNotWorkspaceBinary(enginePath, workspaceFolderPaths().concat([folder]));
  } catch (error) {
    vscode.window.showErrorMessage(
      noteError(
        error instanceof Error ? error.message : "Could not resolve terraform/tofu."
      )
    );
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Planlens will run:\n${enginePath} plan -input=false -no-color -out <temp>\n\nin ${folder}\n\nThis uses your local Terraform/OpenTofu CLI from PATH (same first match a terminal would use, including user-writable PATH entries). It may contact configured backends, providers, and registries, may lock state, and will execute provider plugins from this working directory. Planlens does not apply changes.`,
    { modal: true },
    "Run plan"
  );
  if (confirmed !== "Run plan") {
    return;
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "planlens-"));
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Planlens: running plan",
        cancellable: false,
      },
      async () => {
        const binPlan = path.join(tmp, "plan.bin");
        await execFileUtf8(
          enginePath,
          ["plan", "-input=false", "-no-color", "-out", binPlan],
          folder
        );
        const shown = await execFileUtf8(enginePath, ["show", "-json", binPlan], folder);
        if (shown.stdout.length > MAX_PLAN_BYTES) {
          throw new Error("Plan JSON exceeded the size limit.");
        }
        const plan = parsePlanText(shown.stdout);
        showPlan(context, plan, `Planlens: ${path.basename(enginePath)} plan`, true);
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      noteError(error instanceof Error ? error.message : "Plan failed.")
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function compareWithFile(
  context: vscode.ExtensionContext,
  left: PlanSummary | undefined
) {
  if (!left) {
    vscode.window.showErrorMessage(noteError("Open a plan first."));
    return;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { "Plan JSON": ["json"] },
    title: "Compare with another terraform show -json / tofu show -json file",
  });
  if (!picked?.[0]) {
    return;
  }
  try {
    const right = await readPlanFromUri(picked[0]);
    const diff = comparePlans(left, right);
    const n = nonce();
    const panel = vscode.window.createWebviewPanel(
      "planlens.compare",
      "Planlens compare",
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );
    panel.webview.html = renderCompareHtml(
      lastPlanLabel,
      path.basename(picked[0].fsPath),
      diff,
      n,
      panel.webview.cspSource
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      noteError(error instanceof Error ? error.message : "Compare failed.")
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  extensionMode = context.extensionMode;
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "planlens.reviewActiveFile",
      async (commandUri?: vscode.Uri) => {
        const uri = resolveActiveFileUri({
          commandUri:
            commandUri && typeof commandUri === "object" && "fsPath" in commandUri
              ? commandUri
              : undefined,
          activeTextEditor: vscode.window.activeTextEditor,
          visibleTextEditors: [...(vscode.window.visibleTextEditors ?? [])],
          activeTabInput: vscode.window.tabGroups?.activeTabGroup?.activeTab?.input,
        });
        if (!uri) {
          vscode.window.showErrorMessage(
            noteError(
              "No active editor. Open a terraform show -json file, click into that editor, then run Planlens: Review Active Plan JSON. Or use Planlens: Open Plan JSON to pick the file."
            )
          );
          return;
        }
        await reviewUri(context, uri);
      }
    ),
    vscode.commands.registerCommand("planlens.reviewFile", async (uri?: vscode.Uri) => {
      if (uri) {
        await reviewUri(context, uri);
        return;
      }
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { "Plan JSON": ["json"] },
      });
      if (picked?.[0]) {
        await reviewUri(context, picked[0]);
      }
    }),
    vscode.commands.registerCommand("planlens.runPlan", () => runPlan(context)),
    vscode.commands.registerCommand("planlens.copyMarkdown", async () => {
      if (!lastPlan) {
        vscode.window.showErrorMessage(noteError("Review a plan first."));
        return;
      }
      if (!(await requirePro("Copy PR markdown"))) {
        return;
      }
      await vscode.env.clipboard.writeText(toPullRequestMarkdown(lastPlan));
      vscode.window.showInformationMessage("Planlens markdown copied.");
    }),
    vscode.commands.registerCommand("planlens.enterLicense", () => enterLicense()),
    vscode.commands.registerCommand("planlens.comparePlans", () =>
      compareWithFile(context, lastPlan)
    ),
    vscode.commands.registerCommand("planlens.copyDiagnostics", async () => {
      const mode =
        extensionMode === vscode.ExtensionMode.Development
          ? "development"
          : extensionMode === vscode.ExtensionMode.Test
            ? "test"
            : "production";
      const key = config().get<string>("licenseKey") ?? "";
      const org = config().get<string>("polarOrganizationId") ?? "";
      const checkout = config().get<string>("checkoutUrl") ?? "";
      const pkg = context.extension.packageJSON as {
        version?: string;
        bugs?: { url?: string };
      };
      const report = formatDiagnostics({
        planlensVersion: pkg?.version ?? "unknown",
        editorAppName: vscode.env.appName ?? "unknown",
        editorVersion: vscode.version ?? "unknown",
        osPlatform: os.platform(),
        osArch: os.arch(),
        extensionMode: mode,
        binarySetting: String(config().get<string>("binary") ?? "auto"),
        licenseKeyPresent: key.trim().length > 0,
        polarOrganizationIdConfigured: org.trim().length > 0,
        checkoutUrlConfigured: checkout.trim().length > 0,
        lastError,
        supportUrl: pkg?.bugs?.url ?? null,
      });
      assertDiagnosticsSafe(report, [key.trim()]);
      await vscode.env.clipboard.writeText(report);
      vscode.window.showInformationMessage(
        "Planlens diagnostics copied. Paste into a GitHub issue. Do not add license keys or plan JSON."
      );
    })
  );
}

export function deactivate() {}
