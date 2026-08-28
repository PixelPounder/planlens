import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

type ExecCall = { file: string; args: string[]; cwd?: string };

function loadExtension(opts: {
  settings?: Record<string, unknown>;
  mode?: 1 | 2 | 3;
  exec?: ExecCall[];
  fetchCalls?: Array<{ url: string; body: string }>;
  confirm?: string | undefined;
  warnPick?: string | undefined;
  workspaceFolder?: string;
  activeFile?: { fsPath: string; scheme?: string; contents: string };
  hideActiveEditor?: boolean;
  activeTabUri?: { fsPath: string; scheme?: string };
}) {
  const execCalls = opts.exec ?? [];
  const fetchCalls = opts.fetchCalls ?? [];
  const settings: Record<string, unknown> = {
    licenseKey: "",
    polarOrganizationId: "",
    checkoutUrl: "",
    binary: "auto",
    devUnlock: false,
    ...(opts.settings ?? {}),
  };
  const messages: string[] = [];
  const errors: string[] = [];
  const opened: string[] = [];
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  let webviewHtml = "";
  let webviewHandler: ((msg: { type?: string }) => unknown) | undefined;
  let clipboard = "";

  const vscode = {
    ExtensionMode: { Production: 1, Development: 2, Test: 3 },
    ConfigurationTarget: { Global: 1 },
    ViewColumn: { Beside: 1 },
    ProgressLocation: { Notification: 1 },
    Uri: {
      parse: (s: string) => ({ toString: () => s, fsPath: s, scheme: "https" }),
      file: (fsPath: string) => ({ fsPath, scheme: "file" }),
    },
    workspace: {
      workspaceFolders: opts.workspaceFolder
        ? [{ uri: { fsPath: opts.workspaceFolder, scheme: "file" } }]
        : undefined,
      getConfiguration: () => ({
        get: (key: string) => settings[key],
        update: async (key: string, value: unknown) => {
          settings[key] = value;
        },
      }),
      fs: {
        readFile: async (uri: { fsPath: string }) => {
          if (opts.activeFile && uri.fsPath === opts.activeFile.fsPath) {
            return Buffer.from(opts.activeFile.contents);
          }
          const { readFileSync } = require("node:fs") as typeof import("node:fs");
          return readFileSync(uri.fsPath);
        },
      },
    },
    window: {
      activeTextEditor:
        opts.activeFile && !opts.hideActiveEditor
          ? {
              document: {
                uri: {
                  fsPath: opts.activeFile.fsPath,
                  scheme: opts.activeFile.scheme ?? "file",
                },
              },
            }
          : undefined,
      visibleTextEditors: [] as Array<{
        document: { uri: { fsPath: string; scheme: string } };
      }>,
      tabGroups: {
        activeTabGroup: {
          activeTab: opts.activeTabUri
            ? {
                input: {
                  uri: {
                    fsPath: opts.activeTabUri.fsPath,
                    scheme: opts.activeTabUri.scheme ?? "file",
                  },
                },
              }
            : opts.activeFile && opts.hideActiveEditor
              ? {
                  input: {
                    uri: {
                      fsPath: opts.activeFile.fsPath,
                      scheme: opts.activeFile.scheme ?? "file",
                    },
                  },
                }
              : undefined,
        },
      },
      showErrorMessage: async (msg: string) => {
        errors.push(msg);
        return undefined;
      },
      showWarningMessage: async (msg: string, ...rest: unknown[]) => {
        messages.push(msg);
        const modal = rest[0] && typeof rest[0] === "object";
        if (modal) {
          return opts.confirm;
        }
        return opts.warnPick;
      },
      showInformationMessage: async (msg: string) => {
        messages.push(msg);
      },
      showInputBox: async () => undefined,
      showOpenDialog: async () => undefined,
      withProgress: async (
        _opts: unknown,
        task: () => Promise<unknown>
      ) => task(),
      createWebviewPanel: () => ({
        webview: {
          cspSource: "https://example.test",
          set html(value: string) {
            webviewHtml = value;
          },
          get html() {
            return webviewHtml;
          },
          onDidReceiveMessage: (handler: (msg: { type?: string }) => unknown) => {
            webviewHandler = handler;
          },
        },
      }),
    },
    version: "1.85.0",
    env: {
      appName: "Cursor",
      openExternal: async (uri: { toString: () => string }) => {
        opened.push(uri.toString());
        return true;
      },
      clipboard: {
        writeText: async (text: string) => {
          clipboard = text;
        },
      },
    },
    commands: {
      registerCommand: (id: string, fn: (...args: unknown[]) => unknown) => {
        commands.set(id, fn);
        return { dispose() {} };
      },
    },
  };

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), body: String(init?.body ?? "") });
    return new Response(JSON.stringify({ status: "granted" }), { status: 200 });
  }) as typeof fetch;

  const childProcess = require("node:child_process") as typeof import("child_process");
  const origExecFile = childProcess.execFile;
  (childProcess as { execFile: unknown }).execFile = (
    file: string,
    args: string[] | undefined,
    options: { cwd?: string } | undefined,
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => {
    execCalls.push({ file, args: args ?? [], cwd: options?.cwd });
    const name = path.basename(file).toLowerCase();
    if (name === "where.exe" || name === "which") {
      const wanted = (args ?? [])[0];
      cb(null, path.join(os.tmpdir(), `${wanted}.exe`) + "\n", "");
      return {} as never;
    }
    if ((args ?? [])[0] === "plan") {
      cb(null, "", "");
      return {} as never;
    }
    if ((args ?? [])[0] === "show") {
      cb(
        null,
        JSON.stringify({
          format_version: "1.0",
          resource_changes: [
            {
              address: "null_resource.x",
              type: "null_resource",
              name: "x",
              change: { actions: ["create"], after: { n: 1 } },
            },
          ],
        }),
        ""
      );
      return {} as never;
    }
    cb(new Error(`unexpected exec ${file} ${args}`), "", "");
    return {} as never;
  };

  const origLoad = (Module as unknown as { _load: Function })._load;
  (Module as unknown as { _load: Function })._load = function (
    request: string,
    parent: unknown,
    isMain: boolean
  ) {
    if (request === "vscode") {
      return vscode;
    }
    return origLoad.call(this, request, parent, isMain);
  };

  const extPath = path.join(__dirname, "..", "extension.js");
  delete require.cache[require.resolve(extPath)];
  delete require.cache[require.resolve(path.join(__dirname, "..", "safety.js"))];
  delete require.cache[require.resolve(path.join(__dirname, "..", "license.js"))];
  delete require.cache[require.resolve(path.join(__dirname, "..", "activeUri.js"))];
  delete require.cache[require.resolve(path.join(__dirname, "..", "diagnostics.js"))];
  const ext = require(extPath) as {
    activate: (ctx: {
      extensionMode: number;
      subscriptions: unknown[];
      extension: { packageJSON: { version: string } };
    }) => void;
  };
  ext.activate({
    extensionMode: opts.mode ?? 1,
    subscriptions: [],
    extension: { packageJSON: { version: "0.1.4" } },
  });

  return {
    commands,
    errors,
    messages,
    opened,
    fetchCalls,
    execCalls,
    settings,
    get clipboard() {
      return clipboard;
    },
    get html() {
      return webviewHtml;
    },
    async post(type: string) {
      await webviewHandler?.({ type });
    },
    restore() {
      globalThis.fetch = origFetch;
      childProcess.execFile = origExecFile;
      (Module as unknown as { _load: Function })._load = origLoad;
    },
  };
}

const samplePlan = JSON.stringify({
  format_version: "1.0",
  resource_changes: [
    {
      address: "null_resource.x",
      type: "null_resource",
      name: "x",
      change: { actions: ["create"], after: { n: 1 } },
    },
  ],
});

test("reviewing a plan does not call Polar even if a key is stored", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pl-rt-"));
  const file = path.join(tmp, "tfplan.json");
  writeFileSync(file, samplePlan);
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const host = loadExtension({
    settings: { licenseKey: "POLAR_KEY", polarOrganizationId: "org" },
    activeFile: { fsPath: file, contents: samplePlan },
    fetchCalls,
  });
  try {
    await host.commands.get("planlens.reviewActiveFile")!();
    assert.equal(fetchCalls.length, 0);
    assert.match(host.html, /Planlens/);
    assert.doesNotMatch(host.html, /POLAR_KEY/);
    assert.doesNotMatch(host.html, /resource_changes/);
  } finally {
    host.restore();
  }
});

test("Command Palette with no activeTextEditor still reviews the active tab", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pl-tab-"));
  const file = path.join(tmp, "sample.tfplan.json");
  writeFileSync(file, samplePlan);
  const host = loadExtension({
    activeFile: { fsPath: file, contents: samplePlan },
    hideActiveEditor: true,
  });
  try {
    await host.commands.get("planlens.reviewActiveFile")!();
    assert.match(host.html, /Planlens/);
    assert.equal(host.errors.length, 0);
  } finally {
    host.restore();
  }
});

test("reviewActiveFile with nothing open reports a clear error", async () => {
  const host = loadExtension({});
  try {
    await host.commands.get("planlens.reviewActiveFile")!();
    assert.match(host.errors.join("\n"), /No active editor/);
  } finally {
    host.restore();
  }
});

test("evil checkout URL is not opened", async () => {
  const host = loadExtension({
    settings: { checkoutUrl: "https://polar.sh@evil.com" },
    warnPick: "Buy Pro",
  });
  try {
    await host.commands.get("planlens.runPlan")!();
    assert.deepEqual(host.opened, []);
  } finally {
    host.restore();
  }
});

test("allowed polar checkout URL may be opened from Buy Pro", async () => {
  const host = loadExtension({
    settings: { checkoutUrl: "https://polar.sh/planlens" },
    warnPick: "Buy Pro",
  });
  try {
    await host.commands.get("planlens.runPlan")!();
    assert.deepEqual(host.opened, ["https://polar.sh/planlens"]);
  } finally {
    host.restore();
  }
});

test("devUnlock is ignored in production mode", async () => {
  const host = loadExtension({
    settings: { devUnlock: true },
    mode: 1,
  });
  try {
    await host.commands.get("planlens.runPlan")!();
    assert.ok(host.messages.some((m) => /Planlens Pro/.test(m)));
    assert.equal(
      host.execCalls.filter((c) => (c.args ?? [])[0] === "plan").length,
      0
    );
  } finally {
    host.restore();
  }
});

test("Run Plan does not exec terraform if the user cancels the modal", async () => {
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const execCalls: ExecCall[] = [];
  const ws = mkdtempSync(path.join(os.tmpdir(), "pl-run-"));
  const whereExe = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "where.exe"
  );
  const fake = path.join(os.tmpdir(), "terraform.exe");
  try {
    copyFileSync(whereExe, fake);
  } catch {
    writeFileSync(fake, "x");
  }
  const origPath = process.env.PATH;
  process.env.PATH = path.dirname(fake) + path.delimiter + origPath;
  const host = loadExtension({
    settings: {
      licenseKey: "k",
      polarOrganizationId: "org",
      binary: "terraform",
    },
    workspaceFolder: ws,
    confirm: undefined,
    fetchCalls,
    exec: execCalls,
  });
  try {
    await host.commands.get("planlens.runPlan")!();
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /api\.polar\.sh/);
    assert.equal(JSON.parse(fetchCalls[0].body).key, "k");
    assert.equal(
      execCalls.filter((c) => c.args[0] === "plan").length,
      0
    );
  } finally {
    process.env.PATH = origPath;
    host.restore();
  }
});

test("Run Plan uses execFile argv without extra user args after confirm", async () => {
  const execCalls: ExecCall[] = [];
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const ws = mkdtempSync(path.join(os.tmpdir(), "pl-run2-"));
  mkdirSync(ws, { recursive: true });
  const whereExe = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "where.exe"
  );
  const hijack = mkdtempSync(path.join(os.tmpdir(), "pl-okbin-"));
  const fake = path.join(hijack, "terraform.exe");
  copyFileSync(whereExe, fake);
  const origPath = process.env.PATH;
  process.env.PATH = hijack + path.delimiter + origPath;
  const host = loadExtension({
    settings: {
      licenseKey: "k",
      polarOrganizationId: "org",
      binary: "terraform",
    },
    workspaceFolder: ws,
    confirm: "Run plan",
    fetchCalls,
    exec: execCalls,
  });
  try {
    await host.commands.get("planlens.runPlan")!();
    const planCalls = execCalls.filter((c) => c.args[0] === "plan");
    const showCalls = execCalls.filter((c) => c.args[0] === "show");
    assert.equal(planCalls.length, 1);
    assert.deepEqual(planCalls[0].args.slice(0, 3), [
      "plan",
      "-input=false",
      "-no-color",
    ]);
    assert.equal(planCalls[0].args[3], "-out");
    assert.match(planCalls[0].args[4], /plan\.bin$/);
    assert.equal(planCalls[0].cwd, ws);
    assert.equal(showCalls.length, 1);
    assert.deepEqual(showCalls[0].args.slice(0, 2), ["show", "-json"]);
    assert.match(host.html, /Planlens/);
  } finally {
    process.env.PATH = origPath;
    host.restore();
  }
});

test("copy diagnostics does not fetch Polar or include the license key", async () => {
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const host = loadExtension({
    settings: {
      licenseKey: "SECRET_LICENSE_KEY_DO_NOT_LEAK",
      polarOrganizationId: "org_public_id",
    },
    fetchCalls,
  });
  try {
    await host.commands.get("planlens.reviewActiveFile")!();
    await host.commands.get("planlens.copyDiagnostics")!();
    assert.equal(fetchCalls.length, 0);
    assert.match(host.clipboard, /planlens_version: 0\.1\.4/);
    assert.match(host.clipboard, /license_key_present: yes/);
    assert.doesNotMatch(host.clipboard, /SECRET_LICENSE_KEY_DO_NOT_LEAK/);
    assert.doesNotMatch(host.clipboard, /org_public_id/);
    assert.match(host.clipboard, /No active editor/);
  } finally {
    host.restore();
  }
});
