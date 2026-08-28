import type { PlanSummary } from "../parsePlan";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stringify(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function renderReviewHtml(
  plan: PlanSummary,
  nonce: string,
  cspSource: string,
  pro: boolean
): string {
  const payload = JSON.stringify(plan).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-size: 13px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-editor-background);
    }
    h1 {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 8px;
    }
    .counts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .chip {
      border: 1px solid var(--vscode-panel-border, #333);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .chip.create { color: var(--vscode-testing-iconPassed, #3fb950); }
    .chip.delete { color: var(--vscode-testing-iconFailed, #f85149); }
    .chip.replace { color: var(--vscode-charts-orange, #d29922); }
    .chip.update { color: var(--vscode-charts-blue, #58a6ff); }
    input, select, button {
      font: inherit;
      color: inherit;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, #444);
      padding: 4px 8px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: 0;
      cursor: pointer;
    }
    button.secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border, #333);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .note {
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
    main { padding: 12px 16px 48px; }
    details {
      border: 1px solid var(--vscode-panel-border, #333);
      margin: 0 0 8px;
      padding: 0 10px 8px;
    }
    summary {
      cursor: pointer;
      padding: 8px 0;
      font-weight: 600;
    }
    .meta { color: var(--vscode-descriptionForeground); font-weight: 400; }
    .danger { color: var(--vscode-testing-iconFailed, #f85149); }
    table { width: 100%; border-collapse: collapse; }
    td {
      vertical-align: top;
      padding: 4px 8px 4px 0;
      border-top: 1px solid var(--vscode-panel-border, #222);
    }
    td.path { width: 28%; font-family: var(--vscode-editor-font-family, monospace); }
    td.val { font-family: var(--vscode-editor-font-family, monospace); word-break: break-word; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header>
    <h1>Planlens</h1>
    <div class="counts" id="counts"></div>
    <div class="toolbar">
      <input id="search" placeholder="Filter by address or type" />
      <select id="action">
        <option value="changed">Changed only</option>
        <option value="all">All resources</option>
        <option value="create">Creates</option>
        <option value="update">Updates</option>
        <option value="delete">Destroys</option>
        <option value="replace">Replaces</option>
        <option value="danger">Needs attention</option>
      </select>
      <button id="copyMd" class="${pro ? "" : "secondary"}">Copy PR markdown</button>
      <button id="compare" class="secondary">Compare another plan</button>
    </div>
    <p class="note">${
      pro
        ? "Pro is active. Planlens does not upload plan JSON."
        : "Free review. Run plan, PR markdown, and compare are Planlens Pro. Opening this file did not contact Polar."
    }</p>
  </header>
  <main id="list"></main>
  <script nonce="${nonce}">
    const plan = ${payload};
    const pro = ${pro ? "true" : "false"};
    const vscode = acquireVsCodeApi();
    const list = document.getElementById("list");
    const search = document.getElementById("search");
    const action = document.getElementById("action");

    function esc(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    function val(v) {
      if (v === undefined) return "—";
      if (typeof v === "string") return esc(v);
      return esc(JSON.stringify(v));
    }

    document.getElementById("counts").innerHTML = [
      ["create", plan.counts.create, "add"],
      ["update", plan.counts.update, "change"],
      ["delete", plan.counts.delete, "destroy"],
      ["replace", plan.counts.replace, "replace"]
    ].map(([k,n,l]) => '<span class="chip '+k+'">'+n+' to '+l+'</span>').join("");

    function visible(r) {
      const q = search.value.trim().toLowerCase();
      const mode = action.value;
      const changed = r.action !== "no-op" && r.action !== "read";
      if (mode === "changed" && !changed) return false;
      if (mode === "danger" && !r.dangerous) return false;
      if (["create","update","delete","replace"].includes(mode) && r.action !== mode) return false;
      if (!q) return true;
      return (r.address + " " + r.type).toLowerCase().includes(q);
    }

    function render() {
      const rows = plan.resources.filter(visible);
      if (!rows.length) {
        list.innerHTML = "<p class='note'>No resources match.</p>";
        return;
      }
      list.innerHTML = rows.map(r => {
        const attrs = r.attributeChanges.map(c =>
          "<tr><td class='path'>"+esc(c.path)+"</td><td class='val'>"+val(c.before)+"</td><td class='val'>"+val(c.after)+"</td></tr>"
        ).join("");
        const danger = r.dangerous ? "<span class='danger'> "+esc(r.dangerReasons.join(", "))+"</span>" : "";
        const moved = r.previousAddress ? " moved from "+esc(r.previousAddress) : "";
        return "<details><summary><code>"+esc(r.address)+"</code> <span class='meta'>"+esc(r.action)+moved+"</span>"+danger+"</summary>" +
          (attrs ? "<table>"+attrs+"</table>" : "<p class='note'>No attribute-level diff.</p>") +
          "</details>";
      }).join("");
    }

    search.addEventListener("input", render);
    action.addEventListener("change", render);
    document.getElementById("copyMd").addEventListener("click", () => {
      vscode.postMessage({ type: "copyMarkdown" });
    });
    document.getElementById("compare").addEventListener("click", () => {
      vscode.postMessage({ type: "compare" });
    });
    render();
  </script>
</body>
</html>`;
}

export function renderCompareHtml(
  leftLabel: string,
  rightLabel: string,
  diff: {
    onlyLeft: string[];
    onlyRight: string[];
    actionChanged: Array<{ address: string; from: string; to: string }>;
  },
  nonce: string,
  cspSource: string
): string {
  const list = (title: string, items: string[]) =>
    `<h2>${escapeHtml(title)}</h2>` +
    (items.length
      ? `<ul>${items.map((i) => `<li><code>${escapeHtml(i)}</code></li>`).join("")}</ul>`
      : "<p>None.</p>");

  const changed = diff.actionChanged
    .map(
      (c) =>
        `<li><code>${escapeHtml(c.address)}</code> ${escapeHtml(c.from)} → ${escapeHtml(c.to)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
    h1 { font-size: 15px; }
  </style>
</head>
<body>
  <h1>Plan compare</h1>
  <p>${escapeHtml(leftLabel)} vs ${escapeHtml(rightLabel)}</p>
  ${list(`Only in ${leftLabel}`, diff.onlyLeft)}
  ${list(`Only in ${rightLabel}`, diff.onlyRight)}
  <h2>Action changed</h2>
  ${changed ? `<ul>${changed}</ul>` : "<p>None.</p>"}
</body>
</html>`;
}
