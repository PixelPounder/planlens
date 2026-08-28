import { MAX_ATTRIBUTE_CHANGES, MAX_DIFF_DEPTH, MAX_RESOURCES } from "./safety";

export type PlanAction =
  | "no-op"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "replace";

export type AttributeChange = {
  path: string;
  before: unknown;
  after: unknown;
  unknownAfter: boolean;
  sensitive: boolean;
};

export type ResourceChange = {
  address: string;
  previousAddress?: string;
  moduleAddress?: string;
  mode: string;
  type: string;
  name: string;
  action: PlanAction;
  actions: string[];
  actionReason?: string;
  dangerous: boolean;
  dangerReasons: string[];
  attributeChanges: AttributeChange[];
};

export type PlanSummary = {
  formatVersion: string;
  terraformVersion?: string;
  applyable?: boolean;
  errored?: boolean;
  counts: Record<PlanAction, number>;
  changedCount: number;
  resources: ResourceChange[];
};

const DANGEROUS_TYPE_RE =
  /(iam|policy|role|security_group|firewall|route|kms|secret|s3_bucket|storage_account|sql|rds|database|elasticache|redshift|cloudsql|key_vault)/i;

export function classifyActions(actions: string[] | undefined): PlanAction {
  const list = actions ?? [];
  if (list.includes("create") && list.includes("delete")) {
    return "replace";
  }
  const first = list[0];
  if (
    first === "no-op" ||
    first === "create" ||
    first === "read" ||
    first === "update" ||
    first === "delete"
  ) {
    return first;
  }
  return "update";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function appendAll(target: AttributeChange[], part: AttributeChange[]): void {
  for (let i = 0; i < part.length; i++) {
    target.push(part[i]);
  }
}

function flattenDiff(
  before: unknown,
  after: unknown,
  afterUnknown: unknown,
  beforeSensitive: unknown,
  afterSensitive: unknown,
  path: Array<string | number>,
  budget: { left: number }
): AttributeChange[] {
  if (budget.left <= 0) {
    return [
      {
        path: formatPath(path),
        before: "(truncated)",
        after: "(too many attribute changes)",
        unknownAfter: false,
        sensitive: true,
      },
    ];
  }
  if (path.length > MAX_DIFF_DEPTH) {
    budget.left -= 1;
    return [
      {
        path: formatPath(path),
        before: "(truncated)",
        after: "(truncated at depth limit)",
        unknownAfter: false,
        sensitive: true,
      },
    ];
  }
  const sensitiveHere = beforeSensitive === true || afterSensitive === true;
  const unknownHere = afterUnknown === true;

  if (isPlainObject(before) || isPlainObject(after)) {
    const keys = new Set([
      ...Object.keys(isPlainObject(before) ? before : {}),
      ...Object.keys(isPlainObject(after) ? after : {}),
      ...Object.keys(isPlainObject(afterUnknown) ? afterUnknown : {}),
      ...Object.keys(isPlainObject(beforeSensitive) ? beforeSensitive : {}),
      ...Object.keys(isPlainObject(afterSensitive) ? afterSensitive : {}),
    ]);
    const out: AttributeChange[] = [];
    for (const key of keys) {
      if (budget.left <= 0) {
        out.push({
          path: formatPath(path),
          before: "(truncated)",
          after: "(too many attribute changes)",
          unknownAfter: false,
          sensitive: true,
        });
        break;
      }
      appendAll(
        out,
        flattenDiff(
          isPlainObject(before) ? before[key] : undefined,
          isPlainObject(after) ? after[key] : undefined,
          isPlainObject(afterUnknown) ? afterUnknown[key] : afterUnknown,
          isPlainObject(beforeSensitive) ? beforeSensitive[key] : beforeSensitive,
          isPlainObject(afterSensitive) ? afterSensitive[key] : afterSensitive,
          [...path, key],
          budget
        )
      );
    }
    return out;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    const left = Array.isArray(before) ? before : [];
    const right = Array.isArray(after) ? after : [];
    const unknownArr = Array.isArray(afterUnknown) ? afterUnknown : [];
    const beforeSensArr = Array.isArray(beforeSensitive) ? beforeSensitive : [];
    const afterSensArr = Array.isArray(afterSensitive) ? afterSensitive : [];
    const len = Math.max(left.length, right.length);
    const out: AttributeChange[] = [];
    for (let i = 0; i < len; i++) {
      if (budget.left <= 0) {
        out.push({
          path: formatPath(path),
          before: "(truncated)",
          after: "(too many attribute changes)",
          unknownAfter: false,
          sensitive: true,
        });
        break;
      }
      appendAll(
        out,
        flattenDiff(
          left[i],
          right[i],
          unknownArr[i] ?? afterUnknown,
          beforeSensArr[i] ?? beforeSensitive,
          afterSensArr[i] ?? afterSensitive,
          [...path, i],
          budget
        )
      );
    }
    return out;
  }

  if (!unknownHere && jsonEqual(before, after) && !sensitiveHere) {
    return [];
  }

  budget.left -= 1;
  return [
    {
      path: formatPath(path),
      before: sensitiveHere ? "(sensitive)" : before,
      after: sensitiveHere
        ? "(sensitive)"
        : unknownHere
          ? "(known after apply)"
          : after,
      unknownAfter: unknownHere,
      sensitive: sensitiveHere,
    },
  ];
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatPath(path: Array<string | number>): string {
  if (path.length === 0) {
    return "(root)";
  }
  return path
    .map((step, i) =>
      typeof step === "number"
        ? `[${step}]`
        : i === 0
          ? String(step)
          : `.${step}`
    )
    .join("");
}

function dangerReasons(resource: {
  type: string;
  action: PlanAction;
  actionReason?: string;
}): string[] {
  const reasons: string[] = [];
  if (resource.action === "delete") {
    reasons.push("destroy");
  }
  if (resource.action === "replace") {
    reasons.push("replace");
    if (resource.actionReason) {
      reasons.push(resource.actionReason);
    }
  }
  if (DANGEROUS_TYPE_RE.test(resource.type)) {
    reasons.push(`sensitive type ${resource.type}`);
  }
  return reasons;
}

type RawResourceChange = {
  address?: string;
  previous_address?: string;
  module_address?: string;
  mode?: string;
  type?: string;
  name?: string;
  action_reason?: string;
  change?: {
    actions?: string[];
    before?: unknown;
    after?: unknown;
    after_unknown?: unknown;
    before_sensitive?: unknown;
    after_sensitive?: unknown;
  };
};

export function parsePlan(input: unknown): PlanSummary {
  if (input === null || typeof input !== "object") {
    throw new Error("Plan JSON must be an object.");
  }
  const root = input as Record<string, unknown>;
  if (!Array.isArray(root.resource_changes)) {
    throw new Error(
      "This JSON is not a Terraform/OpenTofu plan. Expected resource_changes from `terraform show -json` or `tofu show -json`."
    );
  }
  if (root.resource_changes.length > MAX_RESOURCES) {
    throw new Error(
      `Plan has ${root.resource_changes.length} resource_changes. Planlens refuses plans with more than ${MAX_RESOURCES}.`
    );
  }

  const formatVersion = String(root.format_version ?? "unknown");
  const major = Number(formatVersion.split(".")[0]);
  if (Number.isFinite(major) && major > 1) {
    throw new Error(
      `Unsupported plan format_version ${formatVersion}. Planlens supports 1.x.`
    );
  }

  const resources: ResourceChange[] = [];
  const attrBudget = { left: MAX_ATTRIBUTE_CHANGES };
  for (const entry of root.resource_changes) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Plan resource_changes contains a non-object entry.");
    }
    const raw = entry as RawResourceChange;
    const actions = raw.change?.actions ?? [];
    const action = classifyActions(actions);
    const type = raw.type ?? "unknown";
    const reasons = dangerReasons({
      type,
      action,
      actionReason: raw.action_reason,
    });
    const attributeChanges =
      action === "no-op" || action === "read"
        ? []
        : flattenDiff(
            raw.change?.before,
            raw.change?.after,
            raw.change?.after_unknown,
            raw.change?.before_sensitive,
            raw.change?.after_sensitive,
            [],
            attrBudget
          );

    resources.push({
      address: raw.address ?? "(unknown)",
      previousAddress: raw.previous_address,
      moduleAddress: raw.module_address,
      mode: raw.mode ?? "managed",
      name: raw.name ?? "",
      type,
      action,
      actions,
      actionReason: raw.action_reason,
      dangerous: reasons.length > 0 && action !== "no-op" && action !== "read",
      dangerReasons: reasons,
      attributeChanges,
    });
  }

  const counts: Record<PlanAction, number> = {
    "no-op": 0,
    create: 0,
    read: 0,
    update: 0,
    delete: 0,
    replace: 0,
  };
  for (const resource of resources) {
    counts[resource.action] += 1;
  }

  return {
    formatVersion,
    terraformVersion:
      typeof root.terraform_version === "string"
        ? root.terraform_version
        : undefined,
    applyable: typeof root.applyable === "boolean" ? root.applyable : undefined,
    errored: typeof root.errored === "boolean" ? root.errored : undefined,
    counts,
    changedCount:
      counts.create + counts.update + counts.delete + counts.replace,
    resources,
  };
}

export function parsePlanText(text: string): PlanSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  return parsePlan(parsed);
}
