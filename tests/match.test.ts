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
  it("verified UUID record must still match identity (homepage drift → refuse)", () => {
    expect(identityStillMatches(quran, rec({ homepage: "https://misrquran.gov.eg/" }))).toBe(true);
    expect(identityStillMatches(quran, rec({ homepage: "https://spam.example" }))).toBe(false);
  });
});
