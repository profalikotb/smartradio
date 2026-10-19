/** Session tokens — Edge-safe (used by middleware) and Node-safe (used by route handlers). */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sr_session";

function secretKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export function sessionDays(): number {
  const d = Number(process.env.SESSION_DAYS);
  return Number.isFinite(d) && d >= 1 && d <= 400 ? Math.floor(d) : 180;
}

export function isConfigured(): boolean {
  return !!secretKey() && !!process.env.APP_PASSWORD_HASH;
}

export async function createSessionToken(): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error("SESSION_SECRET missing or shorter than 32 characters");
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime(`${sessionDays()}d`)
    .setAudience("prof-ali-kotb-smart-radio")
    .sign(key);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const key = secretKey();
  if (!key || !token) return false;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "prof-ali-kotb-smart-radio" });
    return payload.sub === "owner";
  } catch {
    return false;
  }
}
