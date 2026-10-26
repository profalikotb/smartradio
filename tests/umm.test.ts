import { describe, expect, it } from "vitest";
import { buildLibrary, identify, skeleton, splitArabic, UMM_SOURCES, type IaFile } from "@/lib/umm/parse";

const f = (name: string, extra: Partial<IaFile> = {}): IaFile => ({ name, source: "original", format: "VBR MP3", length: "2400", ...extra });
const src = (key: string) => UMM_SOURCES.find((s) => s.key === key)!;

describe("song identification", () => {
  it("Arabic names: song + concert date", () => {
    expect(splitArabic("أراك عصي الدمع 25 مارس 1965")).toEqual({ song: "أراك عصي الدمع", detail: "25 مارس 1965" });
    expect(splitArabic("إسأل روحك - حفله خيريه 30 أبريل 1970")).toEqual({ song: "اسأل روحك", detail: "حفله خيريه 30 أبريل 1970" });
    expect(splitArabic("أنا في انتظارك 1943").song).toBe("أنا في انتظارك");
  });
  it("transliterations map to Arabic titles despite spelling variants", () => {
    const id = (n: string) => identify(f(n), new Map())!;
    expect(id("Studio-Aghadan Alqak.mp3").song).toBe("أغدًا ألقاك");
    expect(id("001.aghdaan_alqak.mp3").song).toBe("أغدًا ألقاك");
    expect(id("Al-Atlal.mp3").song).toBe("الأطلال");
    expect(id("019.iint_eumry.mp3").song).toBe("إنت عمري");
    expect(id("Studio-Daret El Ayam 2.mp3")).toMatchObject({ song: "ودارت الأيام", detail: "نسخة 2" });
    expect(id("Manet Chababy.mp3")).toMatchObject({ song: "Manet Chababy", arabic: false });
    expect(identify(f("Qur'an Kareem.mp3"), new Map())).toBeNull();
    expect(skeleton("Aghadan Alqak")).toBe(skeleton("aghdaan_alqak"));
  });
  it("distinctive Arabic metadata titles win; repeated placeholders are ignored", () => {
    const counts = new Map([["صدقة جارية", 30], ["اغدا القاك", 1]]);
    expect(identify(f("001.aghdaan_alqak.mp3", { title: "اغدا القاك" }), counts)!.song).toBe("أغدًا ألقاك");
    expect(identify(f("Leilet Hob.mp3", { title: "صدقة جارية" }), counts)!.song).toBe("ليلة حب");
  });
});

describe("library", () => {
  const lib = buildLibrary([
    { source: src("ward2u"), files: [f("001.aghdaan_alqak.mp3", { title: "اغدا القاك" }), f("003.alatilal.mp3", { title: "الاطلال" })] },
    { source: src("studio"), files: [f("Studio-Aghadan Alqak.mp3"), f("Al-Atlal.mp3"), f("Studio-Daret El Ayam.mp3"), f("intro.mp3", { length: "20" }), { name: "Al-Atlal.ogg", source: "derivative", format: "Ogg Vorbis" }] },
    { source: src("concerts"), files: [f("أراك عصي الدمع/أراك عصي الدمع 25 مارس 1965.mp3"), f("أراك عصي الدمع/أراك عصي الدمع 3 ديسمبر 1964.mp3"), f("إسأل روحك/إسأل روحك - حفله خيريه 30 أبريل 1970.mp3")] },
    { source: src("all"), files: null },
  ]);
  const song = (t: string) => lib.songs.find((s) => s.title === t)!;
  it("groups every version of a song together (studio first, then concerts by year)", () => {
    expect(song("أغدًا ألقاك").versions.map((v) => v.label)).toEqual(["تسجيل استوديو", "تسجيل"]);
    expect(song("الأطلال").versions).toHaveLength(2);
    expect(song("أراك عصي الدمع").versions.map((v) => v.label)).toEqual(["حفلة 3 ديسمبر 1964", "حفلة 25 مارس 1965"]);
    expect(song("اسأل روحك").versions[0]!.label).toBe("حفله خيريه 30 أبريل 1970");
  });
  it("versions have https archive URLs, ids, titles; fragments and derivatives skipped; sources reported", () => {
    const all = lib.songs.flatMap((s) => s.versions);
    expect(all).toHaveLength(8); // 2 + 3 (intro under 60 s skipped) + 3
    expect(all.every((v) => v.audioUrl.startsWith("https://archive.org/download/") && v.id.includes("/"))).toBe(true);
    expect(song("أراك عصي الدمع").versions[0]!.audioUrl).toBe("https://archive.org/download/51970/%D8%A3%D8%B1%D8%A7%D9%83%20%D8%B9%D8%B5%D9%8A%20%D8%A7%D9%84%D8%AF%D9%85%D8%B9/%D8%A3%D8%B1%D8%A7%D9%83%20%D8%B9%D8%B5%D9%8A%20%D8%A7%D9%84%D8%AF%D9%85%D8%B9%203%20%D8%AF%D9%8A%D8%B3%D9%85%D8%A8%D8%B1%201964.mp3");
    expect(song("أراك عصي الدمع").versions[0]!.title).toBe("أراك عصي الدمع — حفلة 3 ديسمبر 1964");
    expect(lib.sources.map((s) => s.ok)).toEqual([true, true, true, false]);
  });
});
