import { describe, expect, it } from "vitest";
import { isYtId, KHILAFA, resumePoint, type KState } from "@/lib/khilafa";

const base: KState = { ids: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"], titles: {}, eps: {} };

describe("الخلافة الإسلامية في 1000 عام", () => {
  it("uses the official Ne3raf playlist", () => {
    expect(KHILAFA.playlistId).toBe("PL4-hDbT07cQB0NlnFwwWT3tfce-DjZaLI");
    expect(isYtId("iOx3p3Wft2Y")).toBe(true);
    expect(isYtId("bad id")).toBe(false);
  });
  it("resumes the same episode at the saved second, by id", () => {
    const s: KState = { ...base, ids: ["zzzzzzzzzzz", ...base.ids], eps: { bbbbbbbbbbb: { pos: 754, dur: 3600, at: 1 } }, last: { id: "bbbbbbbbbbb", index: 1, pos: 754, at: 1 } };
    expect(resumePoint(s)).toEqual({ index: 2, pos: 754 });
  });
  it("moves to the next episode after one finished", () => {
    const s: KState = { ...base, eps: { aaaaaaaaaaa: { pos: 0, dur: 3600, done: true, at: 1 } }, last: { id: "aaaaaaaaaaa", index: 0, pos: 0, at: 1 } };
    expect(resumePoint(s)).toEqual({ index: 1, pos: 0 });
    expect(resumePoint(base)).toBeNull();
  });
});
