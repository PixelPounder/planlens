import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { parsePlan, parsePlanText } from "../parsePlan";
import { validatePolarLicense } from "../license";
import { toPullRequestMarkdown } from "../markdown";
import { renderReviewHtml } from "../webview/reviewHtml";
import {
  MAX_ATTRIBUTE_CHANGES,
  MAX_RESOURCES,
  assertNotWorkspaceBinary,
  isAllowedCheckoutUrl,
  isAllowedEngineName,
} from "../safety";

test("rejects non-https and non-polar checkout URLs", () => {
  assert.equal(isAllowedCheckoutUrl("https://polar.sh/planlens"), true);
  assert.equal(isAllowedCheckoutUrl("https://buy.polar.sh/xyz"), true);
  assert.equal(isAllowedCheckoutUrl("http://polar.sh/planlens"), false);
  assert.equal(isAllowedCheckoutUrl("https://evil.com/?next=polar.sh"), false);
  assert.equal(isAllowedCheckoutUrl("https://polar.sh.evil.com"), false);
  assert.equal(isAllowedCheckoutUrl("https://notpolar.sh"), false);
  assert.equal(isAllowedCheckoutUrl("https://polar.sh@evil.com"), false);
  assert.equal(isAllowedCheckoutUrl("https://evil.com@polar.sh"), true);
  assert.equal(isAllowedCheckoutUrl("https://polar.sh/@evil.com"), true);
  assert.equal(isAllowedCheckoutUrl("javascript:alert(1)"), false);
});

test("engine names are a closed set", () => {
  assert.equal(isAllowedEngineName("terraform"), true);
  assert.equal(isAllowedEngineName("tofu"), true);
  assert.equal(isAllowedEngineName("terraform; calc"), false);
  assert.equal(isAllowedEngineName("C:\\repo\\terraform.exe"), false);
});

test("refuses a terraform binary planted in the workspace", () => {
  const workspace = path.join(os.tmpdir(), "planlens-ws");
  const planted = path.join(workspace, "terraform.exe");
  assert.throws(
    () => assertNotWorkspaceBinary(planted, [workspace]),
    /inside the workspace/
  );
  assert.doesNotThrow(() =>
    assertNotWorkspaceBinary(path.join(os.homedir(), "bin", "terraform.exe"), [
      workspace,
    ])
  );
});

test("unmarked secrets in plan JSON are visible — claim must not say otherwise", () => {
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "null_resource.leak",
        type: "null_resource",
        name: "leak",
        change: {
          actions: ["update"],
          before: { triggers: { token: "AKIA_UNMARKED" } },
          after: { triggers: { token: "AKIA_UNMARKED" } },
          before_sensitive: {},
          after_sensitive: {},
        },
      },
    ],
  });
  const token = plan.resources[0].attributeChanges.find(
    (c) => c.path === "triggers.token"
  );
  assert.equal(token, undefined);
  const create = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "null_resource.leak",
        type: "null_resource",
        name: "leak",
        change: {
          actions: ["create"],
          before: null,
          after: { triggers: { token: "AKIA_UNMARKED" } },
          after_sensitive: {},
        },
      },
    ],
  });
  const shown = create.resources[0].attributeChanges.find(
    (c) => c.path === "triggers.token"
  );
  assert.equal(shown?.after, "AKIA_UNMARKED");
  assert.equal(shown?.sensitive, false);
});

test("marked sensitive values never appear in review payload or markdown", () => {
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "aws_db_instance.main",
        type: "aws_db_instance",
        name: "main",
        change: {
          actions: ["update"],
          before: { password: "super-secret" },
          after: { password: "super-secret" },
          before_sensitive: { password: true },
          after_sensitive: { password: true },
        },
      },
    ],
  });
  const html = renderReviewHtml(plan, "nonce", "https://example", false);
  const md = toPullRequestMarkdown(plan);
  assert.doesNotMatch(html, /super-secret/);
  assert.doesNotMatch(md, /super-secret/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /img-src https:/);
});

test("script breakout in resource address is escaped in HTML payload", () => {
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "</script><script>alert(1)</script>",
        type: "t",
        name: "x",
        change: {
          actions: ["create"],
          after: { n: 1 },
        },
      },
    ],
  });
  const html = renderReviewHtml(plan, "abc", "https://example", false);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
});

test("malformed input is rejected", () => {
  assert.throws(() => parsePlanText(""), /not valid JSON/);
  assert.throws(() => parsePlanText("[]"), /resource_changes/);
  assert.throws(() => parsePlan({ format_version: "1.0" }), /resource_changes/);
  assert.throws(
    () => parsePlan({ format_version: "2.0", resource_changes: [] }),
    /Unsupported plan format_version/
  );
});

test("hostile extra keys and __proto__ do not crash parse", () => {
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "a.b",
        type: "t",
        name: "b",
        change: {
          actions: ["create"],
          after: JSON.parse('{"__proto__":{"polluted":true},"ok":1}'),
        },
      },
    ],
  });
  assert.equal(plan.changedCount, 1);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("refuses oversized resource_changes lists", () => {
  const resource_changes = Array.from({ length: MAX_RESOURCES + 1 }, (_, i) => ({
    address: `r.${i}`,
    type: "t",
    name: String(i),
    change: { actions: ["no-op"] },
  }));
  assert.throws(
    () => parsePlan({ format_version: "1.0", resource_changes }),
    /refuses plans/
  );
});

test("deep objects truncate instead of overflowing the stack", () => {
  let after: Record<string, unknown> = { leaf: "x" };
  for (let i = 0; i < 80; i++) {
    after = { child: after };
  }
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "deep.x",
        type: "t",
        name: "x",
        change: { actions: ["create"], after },
      },
    ],
  });
  assert.ok(
    plan.resources[0].attributeChanges.some((c) =>
      String(c.after).includes("truncated")
    )
  );
});

test("wide arrays do not overflow the stack and are capped", () => {
  const after = {
    items: Array.from({ length: 200_000 }, (_, i) => i),
  };
  const plan = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "wide.x",
        type: "t",
        name: "x",
        change: { actions: ["create"], after },
      },
    ],
  });
  assert.ok(plan.resources[0].attributeChanges.length <= MAX_ATTRIBUTE_CHANGES + 1);
  assert.ok(
    plan.resources[0].attributeChanges.some((c) =>
      String(c.after).includes("too many attribute changes")
    )
  );
});

test("non-object resource_changes entries are rejected without a TypeError", () => {
  assert.throws(
    () =>
      parsePlan({
        format_version: "1.0",
        resource_changes: [null],
      }),
    /non-object entry/
  );
});

test("Polar fetch failures and non-JSON bodies do not throw", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const a = await validatePolarLicense("k", "org");
    assert.equal(a.pro, false);
  } finally {
    globalThis.fetch = orig;
  }
  globalThis.fetch = async () =>
    new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } });
  try {
    const b = await validatePolarLicense("k", "org");
    assert.equal(b.pro, false);
  } finally {
    globalThis.fetch = orig;
  }
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "active" }), { status: 200 });
  try {
    const c = await validatePolarLicense("k", "org");
    assert.equal(c.pro, false);
  } finally {
    globalThis.fetch = orig;
  }
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "granted" }), { status: 200 });
  try {
    const d = await validatePolarLicense("k", "org");
    assert.equal(d.pro, true);
  } finally {
    globalThis.fetch = orig;
  }
  const e = await validatePolarLicense("k", "");
  assert.equal(e.pro, false);
});

