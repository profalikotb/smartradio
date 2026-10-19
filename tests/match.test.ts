import { describe, expect, it } from "vitest";
import { catalogById, QURAN_CAIRO_ID, AL_AGHANI_ID } from "@/lib/catalog";
import { identityStillMatches, isCandidate } from "@/lib/match";
import type { DirectoryStation } from "@/lib/types";

const rec = (p: Partial<DirectoryStation>): DirectoryStation => ({
  uuid: "u", name: "", countrycode: "EG", country: "Egypt", language: "", tags: "", homepage: "", favicon: "", codec: "MP3", bitrate: 0,
  hls: false, url: "https://s/x", urlResolved: "https://s/x", lastcheckok: true, lastcheckoktime: "", votes: 0, clickcount: 0, ...p,
});
const quran = catalogById.get(QURAN_CAIRO_ID)!;
const aghani = catalogById.get(AL_AGHANI_ID)!;

describe("strict candidate rules", () => {
  it("Quran: requires Egypt AND the official homepage", () => {
    expect(isCandidate(quran, rec({ name: "إذاعة القرآن الكريم من القاهرة", homepage: "https://misrquran.gov.eg/" }))).toBe(true);
    expect(isCandidate(quran, rec({ name: "Radio Quran - القرآن الكريم", homepage: "https://surahquran.com" }))).toBe(false); // 3rd-party EG stream
    expect(isCandidate(quran, rec({ name: "إذاعة القرآن الكريم", countrycode: "IR", homepage: "https://misrquran.gov.eg" }))).toBe(false);
  });
  it("Al Aghani: Egypt + name; never another country's Aghani or a generic music stream", () => {
    expect(isCandidate(aghani, rec({ name: "ERTU - اذاعه الاغاني" }))).toBe(true);
    expect(isCandidate(aghani, rec({ name: "Aghani Aghani", countrycode: "LB" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Arabic Hits" }))).toBe(false);
    expect(isCandidate(aghani, rec({ name: "Nogoum FM" }))).toBe(false);
  });
  it("verified UUID record: accepted on official homepage OR unchanged name; refused if repurposed", () => {
    expect(identityStillMatches(quran, rec({ name: "x", homepage: "https://misrquran.gov.eg/" }))).toBe(true);
    expect(identityStillMatches(quran, rec({ name: "إذاعة القرآن الكريم من القاهرة", homepage: "" }))).toBe(true);
    expect(identityStillMatches(quran, rec({ name: "إذاعة القرآن الكريم من القاهرة", homepage: "http://www.facebook.com/quran.ertu" }))).toBe(true);
    expect(identityStillMatches(quran, rec({ name: "Some Pop FM", homepage: "https://spam.example" }))).toBe(false);
    expect(identityStillMatches(quran, rec({ name: "إذاعة القرآن الكريم", countrycode: "IR" }))).toBe(false);
  });
});

describe("prefix-matched listings", () => {
  it("9090: accepted on official homepage or name; refused when repurposed", () => {
    const s = catalogById.get("eg-9090")!;
    expect(identityStillMatches(s, rec({ name: "Radio 9090 90.9", homepage: "http://www.9090.fm/" }))).toBe(true);
    expect(identityStillMatches(s, rec({ name: "Other", homepage: "https://spam.example" }))).toBe(false);
  });
  it("every verified catalog station has a UUID or prefix plus a homepage rule", () => {
    for (const c of [...catalogById.values()].filter((c) => c.identity.status === "catalog-verified")) {
      expect(c.radioBrowserUuid || c.rbUuidPrefixes?.length).toBeTruthy();
      expect(c.match?.homepageHints?.length).toBeGreaterThan(0);
    }
  });
});
