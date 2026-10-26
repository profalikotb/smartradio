import { describe, expect, it } from "vitest";
import { EMPTY, markDone, recordPosition, resumePosition, sanitize, setLast, surahStats, toggleFavSurah } from "@/lib/tafsir/progress";

const p0 = { ...EMPTY };

describe("tafsir progress", () => {
  it("remembers each episode separately and resumes at the saved second", () => {
    let p = recordPosition(p0, "a", 1115, 3000, 1);
    p = recordPosition(p, "b", 40, 2000, 2);
    expect(resumePosition(p, "a")).toBe(1115);
    expect(resumePosition(p, "b")).toBe(40);
    expect(resumePosition(p, "never")).toBe(0);
  });
  it("finished (or nearly finished) episodes restart from the beginning and count as completed", () => {
    let p = recordPosition(p0, "a", 2990, 3000);
    expect(p.episodes.a!.done).toBe(true);
    expect(resumePosition(p, "a")).toBe(0);
    p = markDone(p0, "b");
    expect(p.episodes.b!.done).toBe(true);
  });
  it("last listen + recent surahs (most recent first, unique)", () => {
    let p = setLast(p0, { stationId: "tafsir:2", surah: 2, episodeId: "x/002", index: 2, pos: 1115, at: 1 });
    p = setLast(p, { stationId: "tafsir:36", surah: 36, episodeId: "x/036", index: 0, pos: 5, at: 2 });
    p = setLast(p, { stationId: "tafsir:2", surah: 2, episodeId: "x/002b", index: 3, pos: 9, at: 3 });
    expect(p.recentSurahs).toEqual([2, 36]);
    expect(p.last!.episodeId).toBe("x/002b");
    expect(p.lastSurah).toBe(2);
  });
  it("surah completion percent mixes completed and partial episodes", () => {
    let p = markDone(p0, "e1");
    p = recordPosition(p, "e2", 500, 1000);
    expect(surahStats(p, ["e1", "e2", "e3", "e4"])).toEqual({ done: 1, total: 4, percent: 38, started: true });
    expect(surahStats(p0, ["e1"]).started).toBe(false);
  });
  it("favorite surahs toggle and stay sorted", () => {
    let p = toggleFavSurah(p0, 36);
    p = toggleFavSurah(p, 2);
    expect(p.favSurahs).toEqual([2, 36]);
    expect(toggleFavSurah(p, 2).favSurahs).toEqual([36]);
  });
  it("corrupt or old stored data never crashes and keeps valid parts", () => {
    expect(sanitize("junk")).toMatchObject({ rate: 1, repeat: "off", episodes: {} });
    const s = sanitize({ savedAt: 5, rate: 9, repeat: "x", favSurahs: [2, 999, "a"], episodes: { ok: { pos: 10, dur: 100 }, bad: { pos: "x" } } });
    expect(s.rate).toBe(1);
    expect(s.favSurahs).toEqual([2]);
    expect(Object.keys(s.episodes)).toEqual(["ok"]);
    expect(sanitize({ rate: 1.25 }).rate).toBe(1.25);
  });
});
