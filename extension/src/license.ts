import type { PlanSummary } from "./parsePlan";
import { POLAR_VALIDATE_URL } from "./safety";

export type LicenseState = {
  pro: boolean;
  message?: string;
};

type PolarValidateResponse = {
  id?: string;
  status?: string;
  benefit_id?: string;
};

export async function validatePolarLicense(
  key: string,
  organizationId: string
): Promise<LicenseState> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { pro: false, message: "No license key." };
  }
  if (!organizationId.trim()) {
    return {
      pro: false,
      message: "Polar organization id is not configured yet.",
    };
  }

  try {
    const response = await fetch(POLAR_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: trimmed,
        organization_id: organizationId.trim(),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { pro: false, message: "License key was rejected." };
    }

    const body = (await response.json()) as PolarValidateResponse;
    if (body.status !== "granted") {
      return {
        pro: false,
        message: body.status
          ? `License status: ${body.status}`
          : "License response was not granted.",
      };
    }
    return { pro: true };
  } catch {
    return {
      pro: false,
      message: "Could not reach Polar to validate the license key.",
    };
  }
}

export function comparePlans(
  left: PlanSummary,
  right: PlanSummary
): {
  onlyLeft: string[];
  onlyRight: string[];
  actionChanged: Array<{ address: string; from: string; to: string }>;
} {
  const leftMap = new Map(
    left.resources
      .filter((r) => r.action !== "no-op" && r.action !== "read")
      .map((r) => [r.address, r.action])
  );
  const rightMap = new Map(
    right.resources
      .filter((r) => r.action !== "no-op" && r.action !== "read")
      .map((r) => [r.address, r.action])
  );

  const onlyLeft: string[] = [];
  const onlyRight: string[] = [];
  const actionChanged: Array<{ address: string; from: string; to: string }> = [];

  for (const [address, action] of leftMap) {
    if (!rightMap.has(address)) {
      onlyLeft.push(address);
    } else if (rightMap.get(address) !== action) {
      actionChanged.push({
        address,
        from: action,
        to: rightMap.get(address) as string,
      });
    }
  }
  for (const address of rightMap.keys()) {
    if (!leftMap.has(address)) {
      onlyRight.push(address);
    }
  }

  return { onlyLeft, onlyRight, actionChanged };
}
