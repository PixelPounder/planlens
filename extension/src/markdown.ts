import type { PlanSummary, ResourceChange } from "./parsePlan";

function fmt(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function section(title: string, rows: ResourceChange[]): string {
  if (rows.length === 0) {
    return "";
  }
  const lines = rows.map((row) => {
    const reason = row.actionReason ? ` (${row.actionReason})` : "";
    return `- \`${row.address}\`${reason}`;
  });
  return `### ${title}\n\n${lines.join("\n")}\n`;
}

export function toPullRequestMarkdown(plan: PlanSummary): string {
  const { counts } = plan;
  const header = [
    "## Planlens summary",
    "",
    `**${counts.create} to add, ${counts.update} to change, ${counts.delete} to destroy, ${counts.replace} to replace**`,
    plan.terraformVersion ? `Engine: ${plan.terraformVersion}` : "",
    plan.errored ? "This plan reported an error and is not applyable." : "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const changed = plan.resources.filter(
    (r) => r.action !== "no-op" && r.action !== "read"
  );
  const destroys = changed.filter((r) => r.action === "delete");
  const replaces = changed.filter((r) => r.action === "replace");
  const creates = changed.filter((r) => r.action === "create");
  const updates = changed.filter((r) => r.action === "update");

  const danger = changed.filter((r) => r.dangerous);
  const dangerBlock =
    danger.length === 0
      ? ""
      : `### Needs attention\n\n${danger
          .map((r) => `- \`${r.address}\` — ${r.dangerReasons.join(", ")}`)
          .join("\n")}\n`;

  const detail = changed
    .slice(0, 40)
    .map((r) => {
      const attrs = r.attributeChanges
        .slice(0, 12)
        .map((c) => `  - \`${c.path}\`: ${fmt(c.before)} → ${fmt(c.after)}`)
        .join("\n");
      return `#### \`${r.address}\` (${r.action})\n${attrs || "  - (no attribute diff)"}`;
    })
    .join("\n\n");

  return [
    header,
    dangerBlock,
    section("Destroys", destroys),
    section("Replaces", replaces),
    section("Creates", creates),
    section("Updates", updates),
    changed.length > 0 ? "### Attribute diffs (first 40 resources)\n" : "",
    detail,
    "",
    "_Generated locally by Planlens. Plan JSON was not uploaded._",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}
