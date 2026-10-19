import { describe, expect, it } from "vitest";
import { normalize, tokens, editDistance } from "@/lib/search/normalize";
import { parseQuery } from "@/lib/search/query";
import { runSearch } from "@/lib/search/index";
import { dedupe } from "@/lib/search/rank";
import { emptyState } from "@/lib/state";
import { AL_AGHANI_ID, QURAN_CAIRO_ID } from "@/lib/catalog";
import type { DirectoryStation } from "@/lib/types";

const s = emptyState();
const top = (q: string, dir: DirectoryStation[] = []) => runSearch(q, {}, s, dir)[0]?.entry.key;

function rec(p: Partial<DirectoryStation>): DirectoryStation {
  return {
    uuid: "00000000-0000-0000-0000-000000000000", name: "x", countrycode: "EG", country: "Egypt", language: "arabic", tags: "",
    homepage: "", favicon: "", codec: "MP3", bitrate: 128, hls: false, url: "https://a.example/s", urlResolved: "https://a.example/s",
    lastcheckok: true, lastcheckoktime: "2026-10-18T00:00:00Z", votes: 1, clickcount: 1, ...p,
  };
}

describe("Arabic normalization", () => {
  it("folds alef forms, ى/ي, ة/ه and strips diacritics + tatweel", () => {
    expect(normalize("إذاعةُ القُرْآنِ الكريـــم")).toBe(normalize("اذاعه القران الكريم"));
    expect(normalize("الأغانى")).toBe("الاغاني");
    expect(normalize("أ.د. على")).toBe(normalize("ا د علي"));
  });
  it("drops the definite article and filler words in tokens", () => {
    expect(tokens("إذاعة القرآن الكريم من القاهرة")).toEqual(["قران", "كريم", "قاهره"]);
  });
  it("edit distance handles transpositions", () => {
    expect(editDistance("quran", "qruan")).toBe(1);
  });
});

describe("natural-language query parsing", () => {
  it("«إذاعة القرآن المصرية» → Egypt + Quran", () => {
    const q = parseQuery("إذاعة القرآن المصرية");
    expect(q.country).toBe("EG");
    expect(q.category).toBe("quran");
    expect(q.terms).toContain("قران");
  });
  it("«إذاعة الأغاني المصرية» → Egypt + music, keeps identity term", () => {
    const q = parseQuery("إذاعة الأغاني المصرية");
    expect(q.country).toBe("EG");
    expect(q.terms).toEqual(["اغاني"]);
  });
});

describe("catalog search ranking", () => {
  it.each([
    ["Quran Cairo", QURAN_CAIRO_ID],
    ["quran karim egypt", QURAN_CAIRO_ID],
    ["إذاعة القرآن الكريم", QURAN_CAIRO_ID],
    ["اذاعة القران المصرية", QURAN_CAIRO_ID],
    ["قرأن", QURAN_CAIRO_ID],
    ["Qruan Cairo", QURAN_CAIRO_ID], // typo
    ["Al Aghani", AL_AGHANI_ID],
    ["Aghani Egypt", AL_AGHANI_ID],
    ["إذاعة الأغاني", AL_AGHANI_ID],
    ["الاغانى", AL_AGHANI_ID],
    ["إذاعة الأغاني المصرية", AL_AGHANI_ID],
    ["اغني", AL_AGHANI_ID], // typo
  ])("%s → %s", (q, id) => expect(top(q)).toBe(id));

  it("partial names work", () => expect(top("صوت الع")).toBe("eg-sout-el-arab"));

  it("core catalog station outranks same-name directory look-alikes from other countries", () => {
    const iran = rec({ uuid: "11111111-1111-1111-1111-111111111111", name: "إذاعة القرآن الكريم", countrycode: "IR", country: "Iran" });
    const saudi = rec({ uuid: "22222222-2222-2222-2222-222222222222", name: "إذاعة القرآن الكريم من القاهرة", countrycode: "SA" });
    const r = runSearch("إذاعة القرآن الكريم", {}, s, [iran, saudi]);
    expect(r[0]!.entry.key).toBe(QURAN_CAIRO_ID);
  });

  it("a directory record that IS the verified catalog station is folded, not duplicated", () => {
    const own = rec({ uuid: "8e63e8b6-4e70-4bc0-9f5d-07e8477a4480", name: "إذاعة القرآن الكريم من القاهرة" });
    const keys = runSearch("القرآن الكريم القاهرة", {}, s, [own]).map((x) => x.entry.key);
    expect(keys.filter((k) => k === QURAN_CAIRO_ID)).toHaveLength(1);
    expect(keys).not.toContain(`rb:${own.uuid}`);
  });

  it("country filter excludes other countries", () => {
    const iran = rec({ uuid: "11111111-1111-1111-1111-111111111111", name: "Quran Radio", countrycode: "IR" });
    const r = runSearch("quran", { country: "EG" }, s, [iran]);
    expect(r.every((x) => x.entry.country === "EG")).toBe(true);
  });
});

describe("dedupe", () => {
  it("groups duplicate listings and keeps distinct streams as alternatives", () => {
    const a = rec({ uuid: "a", name: "Nogoum FM", homepage: "https://nogoumfm.net", urlResolved: "https://s1/x" });
    const b = rec({ uuid: "b", name: "NOGOUM  FM", homepage: "https://www.nogoumfm.net", urlResolved: "https://s2/x", bitrate: 64 });
    const c = rec({ uuid: "c", name: "Nogoum FM", homepage: "https://nogoumfm.net", urlResolved: "https://s1/x" }); // exact dup stream
    const g = dedupe([a, b, c]);
    expect(g).toHaveLength(1);
    expect(g[0]!.map((x) => x.urlResolved)).toEqual(["https://s1/x", "https://s2/x"]);
  });
});

describe("directory noise control", () => {
  it("prefix-verified catalog stations swallow their own directory listings", () => {
    const shaaby = rec({ uuid: "9346c66b-0000-0000-0000-000000000000", name: "SHA3BY FM", homepage: "https://95-fm.com/en" });
    const keys = runSearch("sha3by", {}, s, [shaaby]).map((r) => r.entry.key);
    expect(keys).toContain("eg-shaaby");
    expect(keys).not.toContain(`rb:${shaaby.uuid}`);
  });
  it("directory results must match the query and are capped at 20", () => {
    const spam = Array.from({ length: 40 }, (_, i) =>
      rec({ uuid: `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, "0")}`, name: `OmniRadio - Sheikh Reciter ${i}`, homepage: `https://r${i}.example`, urlResolved: `https://r${i}.example/s` }),
    );
    const unrelated = rec({ uuid: "bbbbbbbb-0000-0000-0000-000000000000", name: "Totally Different", urlResolved: "https://z.example/s" });
    const r = runSearch("sheikh", {}, s, [...spam, unrelated]);
    const dir = r.filter((x) => x.entry.source === "directory");
    expect(dir.length).toBe(20);
    expect(dir.some((x) => x.entry.key.startsWith("rb:bbbbbbbb"))).toBe(false);
  });
});
