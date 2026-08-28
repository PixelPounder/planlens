import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveEnginePath, assertNotWorkspaceBinary } from "../safety";

const whereExe = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "where.exe"
);

test("PATH hijack outside the workspace is resolved (residual, same as a terminal)", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows PATH layout");
    return;
  }
  const hijackDir = mkdtempSync(path.join(os.tmpdir(), "pl-path-"));
  const fake = path.join(hijackDir, "terraform.exe");
  copyFileSync(whereExe, fake);
  const orig = process.env.PATH;
  process.env.PATH = hijackDir + path.delimiter + orig;
  try {
    const resolved = await resolveEnginePath("terraform");
    assert.equal(path.resolve(resolved), path.resolve(fake));
    assert.doesNotThrow(() =>
      assertNotWorkspaceBinary(resolved, [path.join(os.tmpdir(), "other-ws")])
    );
  } finally {
    process.env.PATH = orig;
  }
});

test("workspace terraform.exe on PATH is resolved then refused", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows PATH layout");
    return;
  }
  const ws = mkdtempSync(path.join(os.tmpdir(), "pl-ws-"));
  const planted = path.join(ws, "terraform.exe");
  copyFileSync(whereExe, planted);
  const orig = process.env.PATH;
  process.env.PATH = ws + path.delimiter + orig;
  try {
    const resolved = await resolveEnginePath("terraform");
    assert.throws(
      () => assertNotWorkspaceBinary(resolved, [ws]),
      /inside the workspace/
    );
  } finally {
    process.env.PATH = orig;
  }
});

test("skips terraform.cmd and uses terraform.exe later on PATH", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows PATH layout");
    return;
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), "pl-cmd-"));
  writeFileSync(path.join(dir, "terraform.cmd"), "@echo no\r\n");
  const exe = path.join(dir, "terraform.exe");
  copyFileSync(whereExe, exe);
  const orig = process.env.PATH;
  process.env.PATH = dir + path.delimiter + orig;
  try {
    const resolved = await resolveEnginePath("terraform");
    assert.equal(path.basename(resolved).toLowerCase(), "terraform.exe");
  } finally {
    process.env.PATH = orig;
  }
});

test("missing terraform becomes a friendly not-found error", async () => {
  const orig = process.env.PATH;
  process.env.PATH = mkdtempSync(path.join(os.tmpdir(), "pl-empty-"));
  try {
    await assert.rejects(() => resolveEnginePath("terraform"), /not found on PATH/);
  } finally {
    process.env.PATH = orig;
  }
});
