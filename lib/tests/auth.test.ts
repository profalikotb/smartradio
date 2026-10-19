import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { createSessionToken, verifySessionToken } from "@/lib/server/session";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("correct horse battery", 2 ** 14);
    expect(h.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });
  it("rejects malformed or weak-parameter hashes", async () => {
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "plain-text-password")).toBe(false);
    expect(await verifyPassword("x", "scrypt:1024:8:1:AAAA:BBBB")).toBe(false);
  });
});

describe("session tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "s".repeat(48);
  });
  it("valid token verifies; tampered token fails", async () => {
    const tok = await createSessionToken();
    expect(await verifySessionToken(tok)).toBe(true);
    const parts = tok.split(".");
    const tampered = [parts[0], parts[1], parts[2]!.slice(0, -2) + (parts[2]!.endsWith("A") ? "BB" : "AA")].join(".");
    expect(await verifySessionToken(tampered)).toBe(false);
  });
  it("token signed with another secret fails", async () => {
    const tok = await createSessionToken();
    process.env.SESSION_SECRET = "z".repeat(48);
    expect(await verifySessionToken(tok)).toBe(false);
  });
  it("fails closed without a configured secret", async () => {
    const tok = await createSessionToken();
    delete process.env.SESSION_SECRET;
    expect(await verifySessionToken(tok)).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });
});

describe("paste-mistake tolerance", () => {
  it("accepts the hash with the variable-name prefix, quotes or line breaks", async () => {
    const h = await hashPassword("correct horse battery", 2 ** 14);
    for (const v of [`APP_PASSWORD_HASH=${h}`, `"${h}"`, ` ${h}\n`, h.slice(0, 20) + "\n" + h.slice(20)])
      expect(await verifyPassword("correct horse battery", v)).toBe(true);
  });
});
