#!/usr/bin/env node
/**
 * Public-signal watch. No secrets. No Polar API. No telemetry from the extension.
 *
 * Usage (from repo root):
 *   node planlens/ops/watch/check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "last-run.json");
const STATE_PATH = path.join(__dirname, "..", "STATE.json");

const SOURCES = [
  { id: "terraform", url: "https://api.github.com/repos/hashicorp/terraform/releases/latest" },
  { id: "opentofu", url: "https://api.github.com/repos/opentofu/opentofu/releases/latest" },
  { id: "vscode", url: "https://api.github.com/repos/microsoft/vscode/releases/latest" },
  {
    id: "hashicorp-vscode-terraform",
    url: "https://api.github.com/repos/hashicorp/vscode-terraform/releases/latest",
  },
];

async function latestTag(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Planlens-watch (public-signal-only)",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = await res.json();
  return {
    tag: typeof body.tag_name === "string" ? body.tag_name : null,
    published_at: typeof body.published_at === "string" ? body.published_at : null,
    html_url: typeof body.html_url === "string" ? body.html_url : null,
  };
}

let previous = null;
try {
  previous = JSON.parse(fs.readFileSync(OUT, "utf8"));
} catch {
  previous = null;
}

const results = {};
const errors = [];
for (const src of SOURCES) {
  try {
    results[src.id] = await latestTag(src.url);
  } catch (err) {
    results[src.id] = null;
    errors.push({ id: src.id, error: err instanceof Error ? err.message : String(err) });
  }
}

const changed = [];
const prevSignals = previous && previous.signals ? previous.signals : {};
for (const id of Object.keys(results)) {
  const prevTag = prevSignals[id] && prevSignals[id].tag;
  const nextTag = results[id] && results[id].tag;
  if (nextTag && prevTag && nextTag !== prevTag) {
    changed.push({ id, from: prevTag, to: nextTag });
  } else if (nextTag && !prevTag) {
    changed.push({ id, from: null, to: nextTag });
  }
}

let supportInbox = null;
try {
  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  supportInbox = state.support && state.support.public_inbox;
} catch {
  supportInbox = null;
}

const report = {
  ran_at: new Date().toISOString(),
  script: "planlens/ops/watch/check.mjs",
  support_inbox: supportInbox,
  github_issues_checked: false,
  github_issues_note:
    "This script does not call gh. Daily automation should run `gh issue list` when the public repo exists.",
  polar_checked: false,
  marketplace_checked: false,
  signals: results,
  changed,
  errors,
  owner_interrupt_required: false,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify({ changed: report.changed, errors: report.errors }, null, 2) + "\n");
