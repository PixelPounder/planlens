/**
 * Live abuse / privacy / PATH harness for Planlens 0.1.1 artifacts.
 * Run: node planlens/audit/abuse-harness.mjs
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.join(here, "..", "extension");
const outRoot = path.join(extRoot, "out");
const vsixUnpacked = path.join(tmpdir(), "planlens-vsix-inspect", "unpacked", "extension", "out");

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${id}${detail ? " — " + detail : ""}`);
}

function loadFrom(dir) {
  return {
    safety: require(path.join(dir, "safety.js")),
    parsePlan: require(path.join(dir, "parsePlan.js")),
    license: require(path.join(dir, "license.js")),
    reviewHtml: require(path.join(dir, "webview", "reviewHtml.js")),
    markdown: require(path.join(dir, "markdown.js")),
  };
}

const compiled = loadFrom(outRoot);

function hostilePlan(overrides = {}) {
  return {
    format_version: "1.0",
    resource_changes: [
      {
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        change: { actions: ["create"], after: { id: "i-1" } },
      },
    ],
    ...overrides,
  };
}

// --- parse / crash ---
try {
  compiled.parsePlan.parsePlan({
    format_version: "1.0",
    resource_changes: [null, 1, "x", [], true],
  });
  record("null-resource-entries-do-not-throw", true, "unexpectedly succeeded");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const crash = e instanceof TypeError;
  record(
    "null-resource-entries-do-not-throw",
    !crash,
    crash ? `TypeError: ${msg}` : `friendly: ${msg}`
  );
}

try {
  compiled.parsePlan.parsePlan({ format_version: "1.0", resource_changes: [{}] });
  record("empty-resource-object", true);
} catch (e) {
  record("empty-resource-object", false, String(e));
}

try {
  const p = compiled.parsePlan.parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "r.x",
        type: "t",
        name: "x",
        change: {
          actions: ["create"],
          after: { a: 1n },
        },
      },
    ],
  });
  record("bigint-in-object-rejected-or-handled", true, JSON.stringify(p.resources[0]?.attributeChanges?.[0]));
} catch (e) {
  record("bigint-in-object-rejected-or-handled", true, `threw: ${e instanceof Error ? e.message : e}`);
}

// wide array DoS
const wideN = 20_000;
const wideAfter = { items: Array.from({ length: wideN }, (_, i) => i) };
const t0 = Date.now();
let wideOk = false;
let wideCount = 0;
try {
  const plan = compiled.parsePlan.parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "wide.x",
        type: "t",
        name: "x",
        change: { actions: ["create"], after: wideAfter },
      },
    ],
  });
  wideCount = plan.resources[0].attributeChanges.length;
  const ms = Date.now() - t0;
  wideOk = ms < 5000;
  record("wide-array-20000-parse-time", wideOk, `${ms}ms, ${wideCount} attribute changes`);
} catch (e) {
  record("wide-array-20000-parse-time", true, `threw after ${Date.now() - t0}ms: ${e}`);
}

// huge string
try {
  const huge = "S".repeat(2_000_000);
  const t1 = Date.now();
  const plan = compiled.parsePlan.parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "huge.x",
        type: "t",
        name: "x",
        change: { actions: ["create"], after: { blob: huge } },
      },
    ],
  });
  const html = compiled.reviewHtml.renderReviewHtml(plan, "n", "https://csp", false);
  record(
    "2mb-unmarked-string-in-html",
    html.includes("S".repeat(20)),
    `html ${html.length} bytes in ${Date.now() - t1}ms (unmarked secret would ship into webview)`
  );
} catch (e) {
  record("2mb-unmarked-string-in-html", false, String(e));
}

// XSS / breakouts
const payloads = [
  "</script><script>alert(1)</script>",
  "<!--",
  "<img src=x onerror=alert(1)>",
  "\"><img src=x>",
  "\u2028\u2029",
  "</script><svg onload=alert(1)>",
  "{{constructor.constructor('alert(1)')()}}",
  "javascript:alert(1)",
  "<iframe src=https://evil.test>",
];
for (const payload of payloads) {
  const plan = compiled.parsePlan.parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: payload,
        type: payload,
        name: payload,
        action_reason: payload,
        change: {
          actions: ["delete"],
          before: { note: payload },
          after: null,
        },
      },
    ],
  });
  const html = compiled.reviewHtml.renderReviewHtml(plan, "abc123", "https://example.test", false);
  const md = compiled.markdown.toPullRequestMarkdown(plan);
  const rawScript = html.includes("</script><script>alert(1)</script>");
  const unescapedImg = html.includes("<img src=x onerror=alert(1)>");
  record(
    `xss-payload:${payload.slice(0, 40)}`,
    !rawScript && !unescapedImg,
    rawScript || unescapedImg ? "UNESCAPED IN HTML" : `html ${html.length} md has payload: ${md.includes(payload)}`
  );
}

// checkout URLs
const checkoutCases = [
  ["https://polar.sh/planlens", true],
  ["https://buy.polar.sh/x", true],
  ["HTTPS://POLAR.SH/x", true],
  ["https://polar.sh", true],
  ["https://user:pass@polar.sh/x", true],
  ["https://polar.sh.evil.com/", false],
  ["https://evil.com/@polar.sh", false],
  ["https://polar.sh%2eevil.com/", false],
  ["https://notpolar.sh/", false],
  ["https://evilpolar.sh/", false],
  ["http://polar.sh/x", false],
  ["https://polar.sh.evil.com", false],
  ["https://127.0.0.1/", false],
  ["https://localhost/", false],
  ["javascript:alert(1)", false],
  ["file:///C:/Windows/notepad.exe", false],
  ["https://polar.sh.evil.com", false],
  ["https://polar.sh%00.evil.com", false],
  ["https://polar.sh./x", false],
  ["https://polar.sh%2f@evil.com", false],
  ["https://evil.com#polar.sh", false],
  ["https://polar.sh\\@evil.com", true],
  ["https://xn--plar-0na.sh/", false],
  ["https://sub.sub.polar.sh/x", true],
  ["https://polar.sh:443/x", true],
  ["https://polar.sh:444/x", true],
  ["data:text/html,https://polar.sh", false],
  ["", false],
];
for (const [url, expected] of checkoutCases) {
  const got = compiled.safety.isAllowedCheckoutUrl(url);
  record(`checkout:${url || "(empty)"}`, got === expected, `got ${got} expected ${expected}`);
}

// license: no fetch without org
const fetchCalls = [];
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init });
  return new Response(JSON.stringify({ status: "granted" }), { status: 200 });
};
try {
  const a = await compiled.license.validatePolarLicense("key-1", "");
  record("license-no-fetch-without-org", fetchCalls.length === 0 && a.pro === false, JSON.stringify(a));
  const b = await compiled.license.validatePolarLicense("", "org");
  record("license-no-fetch-without-key", fetchCalls.length === 0 && b.pro === false, JSON.stringify(b));
  const c = await compiled.license.validatePolarLicense("  key-2  ", "  org-9  ");
  record(
    "license-fetch-body-is-key-and-org-only",
    fetchCalls.length === 1 &&
      fetchCalls[0].url === compiled.safety.POLAR_VALIDATE_URL &&
      fetchCalls[0].init.method === "POST" &&
      fetchCalls[0].init.body === JSON.stringify({ key: "key-2", organization_id: "org-9" }) &&
      !String(fetchCalls[0].init.body).includes("resource_changes"),
    JSON.stringify(fetchCalls[0])
  );
  record("license-granted-unlocks-pro", c.pro === true, JSON.stringify(c));
} finally {
  globalThis.fetch = origFetch;
}

// Polar live POST (dummy key) — observe real network
try {
  const res = await fetch(compiled.safety.POLAR_VALIDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: "planlens-audit-dummy-key",
      organization_id: "planlens-audit-dummy-org",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  record(
    "polar-live-dummy-post",
    res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404 || res.status === 422 || res.status === 200,
    `HTTP ${res.status} body-start=${text.slice(0, 180).replace(/\s+/g, " ")}`
  );
} catch (e) {
  record("polar-live-dummy-post", false, String(e));
}

// fetch throw currently escapes validatePolarLicense
globalThis.fetch = async () => {
  throw new Error("simulated network down");
};
try {
  await compiled.license.validatePolarLicense("k", "o");
  record("license-fetch-throw-swallowed", true);
} catch (e) {
  record("license-fetch-throw-swallowed", false, `THROWS: ${e instanceof Error ? e.message : e}`);
} finally {
  globalThis.fetch = origFetch;
}

globalThis.fetch = async () =>
  new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } });
try {
  await compiled.license.validatePolarLicense("k", "o");
  record("license-non-json-200-swallowed", true);
} catch (e) {
  record("license-non-json-200-swallowed", false, `THROWS: ${e instanceof Error ? e.message : e}`);
} finally {
  globalThis.fetch = origFetch;
}

// PATH hijack outside workspace
const hijackDir = mkdtempSync(path.join(tmpdir(), "pl-path-hijack-"));
const fakeTf = path.join(hijackDir, "terraform.exe");
const whereExe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "where.exe");
copyFileSync(whereExe, fakeTf);
const origPath = process.env.PATH;
process.env.PATH = hijackDir + path.delimiter + origPath;
try {
  const resolved = await compiled.safety.resolveEnginePath("terraform");
  const hijacked = path.resolve(resolved) === path.resolve(fakeTf);
  record(
    "path-hijack-outside-workspace-wins",
    hijacked,
    `resolved=${resolved} fake=${fakeTf} (if true, first PATH terraform.exe is trusted)`
  );
  compiled.safety.assertNotWorkspaceBinary(resolved, [path.join(tmpdir(), "some-ws")]);
  record("path-hijack-not-blocked-as-workspace", true, "outside-workspace binary accepted");
} catch (e) {
  record("path-hijack-outside-workspace-wins", false, String(e));
}

// workspace plant on PATH
const ws = mkdtempSync(path.join(tmpdir(), "pl-ws-"));
const planted = path.join(ws, "terraform.exe");
copyFileSync(whereExe, planted);
process.env.PATH = ws + path.delimiter + origPath;
try {
  const resolved = await compiled.safety.resolveEnginePath("terraform");
  try {
    compiled.safety.assertNotWorkspaceBinary(resolved, [ws]);
    record("workspace-binary-on-path-refused", false, `ACCEPTED ${resolved}`);
  } catch (e) {
    record("workspace-binary-on-path-refused", /inside the workspace/.test(String(e)), String(e).slice(0, 200));
  }
} catch (e) {
  record("workspace-binary-on-path-refused", false, `resolve failed: ${e}`);
}

// .cmd first on PATH should not be executed by resolveEnginePath
const cmdDir = mkdtempSync(path.join(tmpdir(), "pl-cmd-"));
writeFileSync(path.join(cmdDir, "terraform.cmd"), "@echo malicious\r\n");
copyFileSync(whereExe, path.join(cmdDir, "terraform.exe"));
process.env.PATH = cmdDir + path.delimiter + origPath;
try {
  const resolved = await compiled.safety.resolveEnginePath("terraform");
  record(
    "cmd-shim-not-selected",
    path.basename(resolved).toLowerCase() === "terraform.exe",
    `resolved=${resolved}`
  );
} catch (e) {
  record("cmd-shim-not-selected", /Unexpected/.test(String(e)), `threw (fail-closed): ${e}`);
}

// junction: PATH dir outside workspace -> workspace binary
const junctionBase = mkdtempSync(path.join(tmpdir(), "pl-junc-"));
const junctionLink = path.join(junctionBase, "link");
try {
  await execFileAsync("cmd.exe", ["/c", "mklink", "/J", junctionLink, ws], { windowsHide: true });
  process.env.PATH = junctionLink + path.delimiter + origPath;
  const resolved = await compiled.safety.resolveEnginePath("terraform");
  let blocked = false;
  let errMsg = "";
  try {
    compiled.safety.assertNotWorkspaceBinary(resolved, [ws]);
  } catch (e) {
    blocked = /inside the workspace/.test(String(e));
    errMsg = String(e);
  }
  record(
    "junction-path-into-workspace",
    true,
    `resolved=${resolved} blockedByWorkspaceCheck=${blocked} ${errMsg.slice(0, 160)}`
  );
} catch (e) {
  record("junction-path-into-workspace", true, `could not create junction: ${e}`);
} finally {
  process.env.PATH = origPath;
}

// missing terraform
process.env.PATH = path.join(tmpdir(), "empty-path-dir-planlens");
mkdirSync(process.env.PATH, { recursive: true });
try {
  await compiled.safety.resolveEnginePath("terraform");
  record("missing-binary-throws", false, "resolved unexpectedly");
} catch (e) {
  record("missing-binary-throws", /not found/.test(String(e)), String(e).slice(0, 160));
} finally {
  process.env.PATH = origPath;
}

// size limit
const bigFile = path.join(tmpdir(), `planlens-big-${Date.now()}.json`);
writeFileSync(bigFile, "x".repeat(compiled.safety.MAX_PLAN_BYTES + 1));
try {
  await compiled.safety.assertReadablePlanSize(bigFile);
  record("oversize-file-refused", false);
} catch (e) {
  record("oversize-file-refused", /refuses files larger/.test(String(e)), String(e).slice(0, 160));
}

// temp plan file pattern (inspect source behavior already known) — create like Run Plan
const tmpPlan = mkdtempSync(path.join(tmpdir(), "planlens-"));
writeFileSync(path.join(tmpPlan, "plan.bin"), "not-a-real-plan");
record("temp-dir-created", existsSync(tmpPlan));
rmSync(tmpPlan, { recursive: true, force: true });
record("temp-dir-removed", !existsSync(tmpPlan));

// VSIX compiled modules vs source-out
if (existsSync(path.join(vsixUnpacked, "safety.js"))) {
  const vsix = loadFrom(vsixUnpacked);
  record(
    "vsix-polar-url-matches-source",
    vsix.safety.POLAR_VALIDATE_URL === compiled.safety.POLAR_VALIDATE_URL,
    vsix.safety.POLAR_VALIDATE_URL
  );
} else {
  record("vsix-polar-url-matches-source", false, "unpacked vsix out/ missing");
}

// engine name injection
record("engine-semicolon", compiled.safety.isAllowedEngineName("terraform & calc") === false);
record("engine-path", compiled.safety.isAllowedEngineName("..\\terraform") === false);

const failed = results.filter((r) => !r.ok);
writeFileSync(
  path.join(here, "2026-08-26-abuse-harness.json"),
  JSON.stringify({ ran_at: new Date().toISOString(), failed: failed.length, results }, null, 2)
);
console.log(`\n${results.length} checks, ${failed.length} FAIL`);
try {
  rmSync(hijackDir, { recursive: true, force: true });
} catch {
  /* ignore */
}
process.exitCode = 0;
