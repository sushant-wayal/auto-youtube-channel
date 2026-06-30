import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "motioncraft_admin";

function cleanEnvSecret(value?: string) {
  const trimmed = value?.trim() ?? "";
  const quote = trimmed.at(0);

  if ((quote === `"` || quote === `'`) && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function getAdminPassword() {
  return cleanEnvSecret(process.env.ADMIN_PASSWORD);
}

function getRawDotenvValue(key: string) {
  try {
    const envPath = join(process.cwd(), ".env");
    if (!existsSync(envPath)) return "";

    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trimStart().startsWith(`${key}=`));

    if (!line) return "";

    const [, ...valueParts] = line.split("=");
    return cleanEnvSecret(valueParts.join("="));
  } catch {
    return "";
  }
}

export function getAdminPasswordCandidates() {
  return Array.from(new Set([getAdminPassword(), getRawDotenvValue("ADMIN_PASSWORD")].filter(Boolean)));
}

function secret() {
  return cleanEnvSecret(process.env.ADMIN_SESSION_SECRET) || getAdminPassword() || "development-only-secret";
}

export function createAdminToken() {
  return createHmac("sha256", secret()).update("motioncraft-admin").digest("hex");
}

export function isValidAdminToken(value?: string) {
  if (!value) return false;
  const expected = createAdminToken();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
