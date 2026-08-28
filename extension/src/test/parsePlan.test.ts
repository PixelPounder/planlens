import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { classifyActions, parsePlan, parsePlanText } from "../parsePlan";
import { toPullRequestMarkdown } from "../markdown";
import { comparePlans } from "../license";

test("classifyActions maps create+delete to replace", () => {
  assert.equal(classifyActions(["delete", "create"]), "replace");
  assert.equal(classifyActions(["create", "delete"]), "replace");
  assert.equal(classifyActions(["update"]), "update");
  assert.equal(classifyActions(["no-op"]), "no-op");
});

test("acceptance fixture filename matches the tfplan menu filter", () => {
  assert.match("sample.tfplan.json", /tfplan/i);
});

test("parsePlan reads the sample fixture", () => {
  const text = readFileSync(
    path.join(__dirname, "..", "..", "fixtures", "sample.tfplan.json"),
    "utf8"
  );
  const plan = parsePlanText(text);
  assert.equal(plan.counts.create, 1);
  assert.equal(plan.counts.update, 1);
  assert.equal(plan.counts.delete, 1);
  assert.equal(plan.counts.replace, 1);
  assert.equal(plan.counts["no-op"], 1);
  assert.equal(plan.changedCount, 4);

  const db = plan.resources.find((r) => r.address === "aws_db_instance.main");
  assert.ok(db);
  assert.equal(db.action, "replace");
  assert.equal(db.dangerous, true);
  assert.ok(db.attributeChanges.some((c) => c.sensitive && c.path === "password"));
  assert.ok(db.attributeChanges.some((c) => c.unknownAfter && c.path === "id"));

  const instance = plan.resources.find((r) => r.address === "aws_instance.web");
  assert.ok(instance);
  const typeChange = instance.attributeChanges.find((c) => c.path === "instance_type");
  assert.deepEqual(typeChange?.before, "t3.micro");
  assert.deepEqual(typeChange?.after, "t3.small");
  assert.equal(
    instance.attributeChanges.some((c) => c.path === "ami"),
    false
  );
});

test("rejects non-plan JSON", () => {
  assert.throws(() => parsePlan({ values: {} }), /resource_changes/);
});

test("redacts sensitive values in markdown", () => {
  const text = readFileSync(
    path.join(__dirname, "..", "..", "fixtures", "sample.tfplan.json"),
    "utf8"
  );
  const md = toPullRequestMarkdown(parsePlanText(text));
  assert.match(md, /aws_db_instance\.main/);
  assert.doesNotMatch(md, /hunter2/);
  assert.match(md, /Needs attention/);
  assert.doesNotMatch(md, /should-never-show/);
});

test("comparePlans detects added and removed addresses", () => {
  const left = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "a",
        type: "t",
        name: "a",
        change: { actions: ["update"], before: { n: 1 }, after: { n: 2 } },
      },
    ],
  });
  const right = parsePlan({
    format_version: "1.0",
    resource_changes: [
      {
        address: "b",
        type: "t",
        name: "b",
        change: { actions: ["create"], before: null, after: { n: 1 } },
      },
    ],
  });
  const diff = comparePlans(left, right);
  assert.deepEqual(diff.onlyLeft, ["a"]);
  assert.deepEqual(diff.onlyRight, ["b"]);
});
