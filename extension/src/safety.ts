import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const MAX_PLAN_BYTES = 32 * 1024 * 1024;
export const MAX_RESOURCES = 20_000;
export const MAX_DIFF_DEPTH = 40;
export const MAX_ATTRIBUTE_CHANGES = 50_000;
export const POLAR_VALIDATE_URL =
  "https://api.polar.sh/v1/customer-portal/license-keys/validate";

export function isAllowedCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === "polar.sh" || host.endsWith(".polar.sh");
  } catch {
    return false;
  }
}

export function assertNotWorkspaceBinary(
  binaryPath: string,
  workspaceFolders: string[]
): void {
  const resolved = path.resolve(binaryPath);
  for (const folder of workspaceFolders) {
    const root = path.resolve(folder);
    const rel = path.relative(root, resolved);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
      throw new Error(
        `Refusing to run ${resolved} because it is inside the workspace. Planlens only runs terraform/tofu from your system PATH, not from the project folder.`
      );
    }
  }
}

export function isAllowedEngineName(name: string): name is "terraform" | "tofu" {
  return name === "terraform" || name === "tofu";
}

export function execFileUtf8(
  file: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd,
        timeout: 10 * 60 * 1000,
        maxBuffer: MAX_PLAN_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

export async function resolveEnginePath(
  name: "terraform" | "tofu"
): Promise<string> {
  const locator =
    process.platform === "win32"
      ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "where.exe")
      : "/usr/bin/which";
  const locatorArgs = [name];
  const safeCwd = os.homedir();
  let stdout = "";
  try {
    const result = await execFileUtf8(locator, locatorArgs, safeCwd);
    stdout = result.stdout;
  } catch {
    throw new Error(`${name} was not found on PATH.`);
  }
  const allowed =
    process.platform === "win32" ? [`${name}.exe`] : [name];
  for (const line of stdout.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate) {
      continue;
    }
    const resolved = path.resolve(candidate);
    const base = path.basename(resolved).toLowerCase();
    if (!allowed.includes(base)) {
      continue;
    }
    return resolved;
  }
  throw new Error(`${name} was not found on PATH.`);
}

export async function assertReadablePlanSize(filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_PLAN_BYTES) {
    throw new Error(
      `Plan file is ${stat.size} bytes. Planlens refuses files larger than ${MAX_PLAN_BYTES} bytes.`
    );
  }
}
