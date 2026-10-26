import { describe, expect, it } from "vitest";
import { buildManifest, parseName, SOURCES, type IaFile } from "@/lib/tafsir/parse";

const f = (name: string, length?: string): IaFile => ({ name, source: "original", format: "VBR MP3", length });
// File names exactly as listed on archive.org/details/sharawee-complete-tafseer
const PRIMARY = [
  f("000_Intro1.mp3", "2416"), f("000_Intro2.mp3", "1800"),
  f("001_Al-Fatihah_001.mp3", "1500"), f("001_Al-Fatihah_002.mp3"), f("001_Al-Fatihah_003.mp3"), f("001_Al-Fatihah_004.mp3"),
  f("002_Al-Baqarah(001_001).mp3", "1830"), f("002_Al-Baqarah(030_034).mp3"), f("002_Al-Baqarah(002_005).mp3"),
  f("036_Ya-Sen(040_052).mp3"), f("036_Ya-Sen(013_025).mp3"), f("036_Ya-Sen(011_013).mp3"),
  { name: "036_Ya-Sen(011_013).ogg", source: "derivative", format: "Ogg Vorbis" },
];
const FALLBACK = [f("000_Intro.mp3"), f("001_Al-Fatihah.mp3"), f("002_Al-Baqarah.mp3"), f("050_Qaf.mp3", "3600"), f("051_a_060.mp3"), f("061_a_114.mp3")];

describe("file-name parsing", () => {
  it("reads surah, verse range, part and multi-surah files", () => {
    expect(parseName("036_Ya-Sen(013_025).mp3")).toMatchObject({ surah: 36, verseStart: 13, verseEnd: 25 });
    expect(parseName("026_Ash-Shu'ara(015_044).mp3")).toMatchObject({ surah: 26, verseStart: 15, verseEnd: 44 });
    expect(parseName("001_Al-Fatihah_003.mp3")).toMatchObject({ surah: 1, part: 3 });
    expect(parseName("051_a_060.mp3")).toEqual({ surah: 51, covers: [51, 60] });
    expect(parseName("cover.mp3")).toBeNull();
  });
});

describe("manifest", () => {
  const m = buildManifest([
    { source: SOURCES[0]!, files: PRIMARY },
    { source: SOURCES[1]!, files: FALLBACK },
  ]);
  it("orders episodes by verse, numbers them, titles them in Arabic, keeps durations", () => {
    expect(m.surahs[2]!.map((e) => [e.verseStart, e.verseEnd])).toEqual([[1, 1], [2, 5], [30, 34]]);
    expect(m.surahs[2]![1]!.title).toBe("سورة البقرة – الحلقة 2 · الآيات 2–5");
    expect(m.surahs[2]![0]!.title).toBe("سورة البقرة – الحلقة 1 · الآية 1");
    expect(m.surahs[2]![0]!.duration).toBe(1830);
    expect(m.surahs[36]!.map((e) => e.verseStart)).toEqual([11, 13, 40]);
    expect(m.surahs[1]!).toHaveLength(4);
    expect(m.intro).toHaveLength(2);
  });
  it("every episode carries id, https audioUrl and source; derivatives ignored", () => {
    for (const e of Object.values(m.surahs).flat()) {
      expect(e.audioUrl).toMatch(/^https:\/\/archive\.org\/download\//);
      expect(e.id).toContain("/");
      expect(e.sourceUrl).toMatch(/^https:\/\/archive\.org\/details\//);
    }
    expect(m.surahs[2]![0]!.audioUrl).toBe("https://archive.org/download/sharawee-complete-tafseer/002_Al-Baqarah(001_001).mp3");
  });
  it("fallback fills only surahs the primary lacks; nothing is invented for others", () => {
    expect(m.surahs[2]!.every((e) => e.sourceKey === "primary")).toBe(true);
    expect(m.surahs[50]![0]!.sourceKey).toBe("fallback");
    expect(m.surahs[50]![0]!.duration).toBe(3600);
    expect(m.surahs[55]![0]!.coversSurahs).toEqual([51, 60]);
    expect(m.surahs[3]).toBeUndefined(); // in neither test list → stays unavailable
  });
  it("records which sources answered", () => {
    const only = buildManifest([{ source: SOURCES[0]!, files: PRIMARY }, { source: SOURCES[1]!, files: null }]);
    expect(only.sources.map((s) => s.ok)).toEqual([true, false]);
    expect(only.surahs[50]).toBeUndefined();
  });
});
