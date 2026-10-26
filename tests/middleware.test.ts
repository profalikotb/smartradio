import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`https://radio.example${path}`, { headers });

describe("no password", () => {
  it("pages open directly; the old login page goes home", () => {
    expect(middleware(req("/")).status).toBe(200);
    expect(middleware(req("/tafsir/2")).status).toBe(200);
    const r = middleware(req("/login"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("https://radio.example/");
    expect(middleware(req("/api/login")).status).toBe(410);
  });
  it("API routes answer this app's pages only (not other sites, not bare scripts)", () => {
    expect(middleware(req("/api/tafsir", { "sec-fetch-site": "same-origin" })).status).toBe(200);
    expect(middleware(req("/api/tafsir", { "x-smart-radio": "1" })).status).toBe(200);
    expect(middleware(req("/api/tafsir", { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(middleware(req("/api/directory?q=x")).status).toBe(403);
  });
});
