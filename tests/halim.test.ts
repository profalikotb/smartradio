import { describe, expect, it } from "vitest";
import { buildLibrary, HALIM_PARSE, identify, playableFiles, type IaFile } from "@/lib/umm/parse";
import { ARTISTS, artistOf } from "@/lib/umm/artists";
import { catalogById } from "@/lib/catalog";
import { isCandidate } from "@/lib/match";
import type { DirectoryStation } from "@/lib/types";

const f = (name: string, extra: Partial<IaFile> = {}): IaFile => ({ name, source: "original", format: "VBR MP3", length: "300", ...extra });
const id = (n: string) => identify(f(n), new Map(), HALIM_PARSE);

describe("Abdel Halim file names (as on archive.org)", () => {
  it("splits song and concert details", () => {
    expect(id("اهواك حفل أضواء المدينة بالمنية 1957.mp3")).toMatchObject({ song: "أهواك", detail: "حفل أضواء المدينة بالمنية 1957" });
    expect(id("أى دمعة حزن لا - حفل سينما ريفولي 1975.mp3")).toMatchObject({ song: "أي دمعة حزن لا", detail: "حفل سينما ريفولي 1975" });
    expect(id("حليم قارئة الفنجان حفل 25 إبريل 1976 كاملة .mp3")!.song).toBe("قارئة الفنجان");
    expect(id("الهوى هوايا.تسجيل حفلة.mp3")).toMatchObject({ song: "الهوى هوايا", detail: "تسجيل حفلة" });
    expect(id("بتلومونى ليه .. حفلة عام 1957.mp3")!.song).toBe("بتلوموني ليه");
    expect(id("بد الحليم حافظ.الليل.توزيع قديم..mp3")!.song).toBe("الليل");
    expect(id("الفجر.mp3")).toMatchObject({ song: "الفجر", detail: "" });
  });
  it("skips interviews and programmes (not songs)", () => {
    expect(id("جزء من برنامج يحكى فيه عبد الحليم حافظ عن بداياته.mp3")).toBeNull();
    expect(id("حوار مع عبد الحليم.mp3")).toBeNull();
    expect(id("Abdel _Adil Imam.mp3")).toBeNull();
  });
  it("uses the archive's MP3 copy when the original is OGG/WMA (plays on iPhone)", () => {
    const files: IaFile[] = [
      { name: "سواح.ogg", source: "original", format: "Ogg Vorbis", length: "400" },
      { name: "سواح.mp3", source: "derivative", format: "VBR MP3", original: "سواح.ogg" },
      { name: "موعود.mp3", source: "original", format: "VBR MP3", length: "500" },
      { name: "موعود.ogg", source: "derivative", format: "Ogg Vorbis", original: "موعود.mp3" },
    ];
    expect(playableFiles(files).map((x) => x.name)).toEqual(["سواح.mp3", "موعود.mp3"]);
    expect(playableFiles(files)[0]!.length).toBe("400");
  });
  it("groups concert versions under one song", () => {
    const lib = buildLibrary(
      [{ source: ARTISTS.halim.sources[0]!, files: [f("صافيني مرة.mp3"), f("صافيني مرة حفل 1954 أو 1955.mp3"), f("تسجيل وهو يتعالح بالخارج.mp3"), f("اضرب.mp3", { length: "40" })] }],
      new Date(),
      HALIM_PARSE,
    );
    const s = lib.songs.find((x) => x.title === "صافيني مرة")!;
    expect(s.versions.map((v) => v.label)).toEqual(["تسجيل", "حفل 1954 أو 1955"]);
    expect(lib.songs).toHaveLength(1); // interview and the 40-second fragment skipped
  });
});

describe("Abdel Halim section", () => {
  it("has its own player prefix, page and live radio (section-only)", () => {
    expect(artistOf("halim:s:abc")?.slug).toBe("halim");
    expect(artistOf("umm:all")?.slug).toBe("umm");
    const live = catalogById.get("halim-live")!;
    expect(live.section).toBe(true);
    const rec = (p: Partial<DirectoryStation>): DirectoryStation => ({ uuid: "u", name: "", countrycode: "MA", country: "", language: "", tags: "", homepage: "", favicon: "", codec: "MP3", bitrate: 0, hls: false, url: "https://s/x", urlResolved: "https://s/x", lastcheckok: true, lastcheckoktime: "", votes: 0, clickcount: 0, ...p });
    expect(isCandidate(live, rec({ name: "Abdel Halim Hafez عبدالحليم حافظ", countrycode: "" }))).toBe(true);
    expect(isCandidate(live, rec({ name: "Radio Oum Kalthoum" }))).toBe(false);
  });
});
