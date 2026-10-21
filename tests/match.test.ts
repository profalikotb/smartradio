import { describe, expect, it } from "vitest";
import { CATALOG, catalogById, QURAN_CAIRO_ID, AL_AGHANI_ID, stationFromRow, type ChannelRow } from "@/lib/catalog";
import { isCandidate } from "@/lib/match";
import CHANNELS from "@/lib/channels.json";
import type { DirectoryStation } from "@/lib/types";

const rec = (p: Partial<DirectoryStation>): DirectoryStation => ({
  uuid: "u", name: "", countrycode: "EG", country: "Egypt", language: "", tags: "", homepage: "", favicon: "", codec: "MP3", bitrate: 0,
  hls: false, url: "https://s/x", urlResolved: "https://s/x", lastcheckok: true, lastcheckoktime: "", votes: 0, clickcount: 0, ...p,
});
const row = (p: Partial<ChannelRow>): ChannelRow => ({
  no: null, name: "", nameEn: null, url: null, format: null, result: null, checkedOn: null, favourite: false, core: null, source: null, notes: null, frequency: null, category: null, ...p,
});

describe("catalog comes from the Excel list", () => {
  it("one station per Excel row, in Excel order, Quran first and Al Aghani second", () => {
    expect(CATALOG.map((c) => c.nameAr)).toEqual((CHANNELS as ChannelRow[]).map((r) => r.name));
    expect(CATALOG[0]!.id).toBe(QURAN_CAIRO_ID);
    expect(CATALOG[1]!.id).toBe(AL_AGHANI_ID);
  });
  it("every Excel link becomes the station's stream; no Dailymotion player anywhere", () => {
    for (const r of CHANNELS as ChannelRow[]) {
      const c = CATALOG.find((x) => x.nameAr === r.name)!;
      expect(c.directStreams?.[0]?.url ?? null).toBe(r.url);
      expect(c.officialPlayer).toBeUndefined();
      expect(c.radioBrowserUuid).toBeUndefined();
    }
  });
  it("known stations keep their stable ids (favorites survive link edits)", () => {
    for (const id of ["eg-general-program", "eg-9090", "eg-nagham", "eg-mega", "eg-shaaby", "eg-nile-fm", "eg-sout-el-arab", "eg-middle-east", "eg-cultural", "eg-nogoum", "eg-radio-hits-882", "eg-on-sport"])
      expect(catalogById.has(id), id).toBe(true);
  });
  it("‘verified’ only when the sheet says the link returned audio", () => {
    expect(catalogById.get(QURAN_CAIRO_ID)!.identity.status).toBe("catalog-verified");
    expect(catalogById.get(AL_AGHANI_ID)!.identity.status).toBe("unverified");
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
    const aghani = catalogById.get(AL_AGHANI_ID)!;
    expect(isCandidate(aghani, rec({ name: "ERTU - اذاعه الاغاني" }))).toBe(true);
    expect(isCandidate(aghani, rec({ name: "Aghani Aghani", countrycode: "LB" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Arabic Hits" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Nogoum FM" }))).toBe(false);
  });
});
