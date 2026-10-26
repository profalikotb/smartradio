import { describe, expect, it } from "vitest";
import { CATALOG, catalogById, QURAN_CAIRO_ID, AL_AGHANI_ID, stationFromRow, type ChannelRow } from "@/lib/catalog";
import { isCandidate } from "@/lib/match";
import CHANNELS from "@/lib/channels.json";
import type { DirectoryStation } from "@/lib/types";

const rec = (p: Partial<DirectoryStation>): DirectoryStation => ({
  uuid: "u", name: "", countrycode: "EG", country: "Egypt", language: "", tags: "", homepage: "", favicon: "", codec: "MP3", bitrate: 0,
  hls: false, url: "https://s/x", urlResolved: "https://s/x", lastcheckok: true, lastcheckoktime: "", votes: 0, clickcount: 0, ...p,
});
const ROWS = CHANNELS as ChannelRow[];
// Al Aghani is hidden in the app (Show = No) but its row still exists; build it directly for rule tests.
const AGHANI = stationFromRow(ROWS.find((r) => r.name.includes("الأغاني"))!);
const row = (p: Partial<ChannelRow>): ChannelRow => ({
  no: null, name: "", nameEn: null, url: null, format: null, result: null, checkedOn: null, favourite: false, core: null, source: null, notes: null, frequency: null, category: null, ...p,
});

describe("catalog comes from the Excel list", () => {
  it("one station per shown Excel row, in Excel order, Quran first; Show = No rows are hidden", () => {
    expect(CATALOG.map((c) => c.nameAr)).toEqual(ROWS.filter((r) => r.show !== false).map((r) => r.name));
    expect(CATALOG[0]!.id).toBe(QURAN_CAIRO_ID);
    for (const id of [AL_AGHANI_ID, "eg-general-program", "eg-sout-el-arab", "eg-middle-east", "eg-cultural"]) expect(catalogById.has(id), id).toBe(false);
  });
  it("every Excel link becomes the station's stream; no Dailymotion player anywhere", () => {
    for (const r of ROWS.filter((x) => x.show !== false)) {
      const c = CATALOG.find((x) => x.nameAr === r.name)!;
      if (c.archive) expect(r.url).toContain(c.archive.ids[0]);
      else expect(c.directStreams?.[0]?.url ?? c.playlist?.base ?? null).toBe(r.url);
      expect(c.officialPlayer).toBeUndefined();
      expect(c.radioBrowserUuid).toBeUndefined();
    }
  });
  it("new reciter radios have their own ids", () => {
    for (const id of ["husary", "husary-mojawwad", "mustafa-ismail", "minshawi", "minshawi-mojawwad", "sharawy"]) expect(catalogById.has(id), id).toBe(true);
    expect(catalogById.get("minshawi")!.directStreams!.map((d) => d.url)).toEqual(["https://backup.qurango.net/radio/mohammed_siddiq_alminshawi", "https://serverkw.quran-uni.com:8074/;*.mp3"]);
  });
  it("known stations keep their stable ids (favorites survive link edits)", () => {
    for (const id of ["eg-9090", "eg-nagham", "eg-mega", "eg-shaaby", "eg-nile-fm", "eg-nogoum", "eg-radio-hits-882", "eg-on-sport"])
      expect(catalogById.has(id), id).toBe(true);
  });
  it("‘verified’ only when the sheet says the link returned audio", () => {
    expect(catalogById.get(QURAN_CAIRO_ID)!.identity.status).toBe("catalog-verified");
    expect(AGHANI.identity.status).toBe("unverified");
  });
  it("an unknown new row still works, with a stable id from its name", () => {
    const a = stationFromRow(row({ name: "إذاعة جديدة", url: "https://n.example/live" }));
    const b = stationFromRow(row({ name: "إذاعة جديدة", url: "https://other.example/x" }));
    expect(a.id).toMatch(/^xl-/);
    expect(a.id).toBe(b.id);
    expect(a.directStreams).toEqual([{ url: "https://n.example/live", codec: undefined }]);
  });
  it("a row with no link is shown but has no stream", () => {
    expect(stationFromRow(row({ name: "إذاعة الإسكندرية" })).directStreams).toBeUndefined();
  });
});

describe("strict candidate rules (stations without a link)", () => {
  it("Al Aghani: Egypt + name; never another country's Aghani or a generic music stream", () => {
    const aghani = AGHANI;
    expect(isCandidate(aghani, rec({ name: "ERTU - اذاعه الاغاني" }))).toBe(true);
    expect(isCandidate(aghani, rec({ name: "Aghani Aghani", countrycode: "LB" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Arabic Hits" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Nogoum FM" }))).toBe(false);
  });
});

describe("added 21/10/2026: Al-Sha'rawi, Al-Minshawi, Umm Kulthum", () => {
  it("get their own ids; a multi-line cell gives fallback links", () => {
    expect(catalogById.get("sharawy")!.directStreams!.map((d) => d.url)).toEqual(["https://serverkw.quran-uni.com:8202/;*.mp3", "https://server03.quran-uni.com:7148/;*.mp3"]);
    expect(catalogById.get("minshawi")!.directStreams![0]!.url).toMatch(/alminshawi$/);
    expect(catalogById.get("minshawi-mojawwad")!.directStreams![0]!.url).toMatch(/alminshawi_mojawwad$/);
    expect(catalogById.get("umm-kulthum")!.directStreams).toBeUndefined();
  });
  it("Umm Kulthum finder accepts tribute stations from any country, but only Umm Kulthum ones", () => {
    const uk = catalogById.get("umm-kulthum")!;
    expect(isCandidate(uk, rec({ name: "Radio Oum Kalthoum", countrycode: "MA" }))).toBe(true);
    expect(isCandidate(uk, rec({ name: "راديو ام كلثوم كوكب الشرق", countrycode: "AL" }))).toBe(true);
    expect(isCandidate(uk, rec({ name: "Arabic Hits", countrycode: "MA" }))).toBe(false);
  });
  it("Egyptian stations stay Egypt-only", () => {
    expect(isCandidate(AGHANI, rec({ name: "Al Aghani", countrycode: "MA" }))).toBe(false);
  });
});

describe("automatic listing choice for tribute stations", () => {
  it("prefers healthy, then HTTPS, then popular listings", async () => {
    const { rankListings } = await import("@/lib/stations");
    const r = rankListings([
      rec({ uuid: "dead", lastcheckok: false, url: "https://a/x", urlResolved: "https://a/x", votes: 999 }),
      rec({ uuid: "http", lastcheckok: true, url: "http://b/x", urlResolved: "http://b/x", votes: 50 }),
      rec({ uuid: "best", lastcheckok: true, url: "https://c/x", urlResolved: "https://c/x", votes: 10 }),
    ]);
    expect(r.map((x) => x.uuid)).toEqual(["best", "http", "dead"]);
  });
});

describe("Mustafa Ismail tajweed: surah-by-surah playlist", () => {
  it("is a playlist station over the mujawwad folder, separate from his live radio", () => {
    const c = catalogById.get("mustafa-ismail-mojawwad")!;
    expect(c.playlist).toEqual({ base: "https://cdn.mp3quran.net/audio/mustafa-ismail/r2/", count: 114 });
    expect(c.directStreams).toBeUndefined();
    expect(catalogById.get("mustafa-ismail")!.directStreams![0]!.url).toBe("https://backup.qurango.net/radio/mustafa_ismail");
  });
});

describe("Internet Archive stations (rare recordings)", () => {
  it("Mustafa Ismail rare recordings: two archive items, shuffled", () => {
    const c = catalogById.get("mustafa-ismail-rare")!;
    expect(c.archive).toEqual({ ids: ["Torath_Mustafa_Ismaiil_By_ReDa_MoHamMeD", "way2sona_20160405_2121"], shuffle: true });
    expect(c.directStreams).toBeUndefined();
  });
  it("'Archive ordered' keeps order; a normal link is not treated as an archive", () => {
    expect(stationFromRow(row({ name: "x", url: "https://archive.org/details/abc_1", format: "Archive ordered" })).archive).toEqual({ ids: ["abc_1"], shuffle: false });
    expect(stationFromRow(row({ name: "y", url: "https://s.example/live" })).archive).toBeUndefined();
  });
});

describe("section-only stations (Excel Show = Section)", () => {
  it("stay available to their section page but are not listed", async () => {
    const { LISTED } = await import("@/lib/catalog");
    expect(catalogById.get("sharawy")?.section).toBe(true);
    expect(catalogById.get("umm-kulthum")?.section).toBe(true);
    expect(LISTED.map((c) => c.id)).not.toContain("sharawy");
    expect(LISTED.map((c) => c.id)).not.toContain("umm-kulthum");
    expect(LISTED.map((c) => c.id)).toContain("husary");
  });
});
