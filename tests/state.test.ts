import { describe, expect, it } from "vitest";
import { AL_AGHANI_ID, QURAN_CAIRO_ID } from "@/lib/catalog";
import {
  applySeeds, emptyState, exportState, hydrate, importState, ImportError, moveFavorite, toggleFavorite, addRecent, CURRENT_SEED, type AppState,
} from "@/lib/state";

const reload = (s: AppState) => hydrate(JSON.stringify(s)); // simulates app restart / update

describe("one-time default seeding", () => {
  it("first run: Quran first, Al Aghani second, both pinned", () => {
    const s = hydrate(null);
    expect(s.favorites).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(s.pinned.slice(0, 2)).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(s.seedVersion).toBe(CURRENT_SEED);
  });

  it("a removed core station stays removed across reloads and updates", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, AL_AGHANI_ID);
    expect(reload(reload(s)).favorites).toEqual([QURAN_CAIRO_ID]);
  });

  it("user order is never re-sorted", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, "rb:x");
    s = moveFavorite(s, "rb:x", -1);
    s = moveFavorite(s, "rb:x", -1);
    expect(reload(s).favorites).toEqual(["rb:x", QURAN_CAIRO_ID, AL_AGHANI_ID]);
  });

  it("a future seed version appends only missing ids at the end", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, QURAN_CAIRO_ID); // user removed Quran
    const seeds = {
      1: { favorites: [QURAN_CAIRO_ID, AL_AGHANI_ID], pinned: [], groups: [] },
      2: { favorites: [AL_AGHANI_ID, "eg-new"], pinned: [], groups: [] },
    };
    const next = applySeeds(s, seeds);
    expect(next.favorites).toEqual([AL_AGHANI_ID, "eg-new"]); // Quran NOT re-added, Aghani not duplicated
    expect(applySeeds(next, seeds)).toBe(next); // idempotent
  });

  it("corrupt storage never crashes", () => {
    expect(hydrate("{not json").favorites).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(hydrate(JSON.stringify({ favorites: "oops", seedVersion: 1 })).favorites).toEqual([]);
  });

  it("recent list is unique and capped", () => {
    let s = emptyState();
    for (let i = 0; i < 30; i++) s = addRecent(s, `id${i % 25}`, i);
    expect(s.recent).toHaveLength(20);
    expect(new Set(s.recent.map((r) => r.id)).size).toBe(20);
  });
});

describe("export / import", () => {
  it("round-trips favorites, order, nicknames, groups, custom stations and settings", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, "rb:abc");
    s = { ...s, nicknames: { [QURAN_CAIRO_ID]: "قرآن" }, custom: [{ id: "c1", name: "My", url: "https://x.example/live", createdAt: "" }] };
    s = { ...s, settings: { ...s.settings, lang: "en", lowData: true } };
    const file = JSON.parse(JSON.stringify(exportState(s)));
    const restored = importState(emptyState(), file);
    expect(restored.favorites).toEqual(s.favorites);
    expect(restored.nicknames).toEqual(s.nicknames);
    expect(restored.custom).toHaveLength(1);
    expect(restored.settings.lang).toBe("en");
    expect(restored.seedVersion).toBe(CURRENT_SEED); // import never triggers re-seeding
    expect(reload(restored).favorites).toEqual(s.favorites);
  });

  it.each([
    [null, "not-an-object"],
    [{ app: "other", schema: 1, data: {} }, "wrong-app"],
    [{ app: "prof-ali-kotb-smart-radio", schema: 99, data: {} }, "unsupported-schema"],
    [{ app: "prof-ali-kotb-smart-radio", schema: 1 }, "missing-data"],
    [{ app: "prof-ali-kotb-smart-radio", schema: 1, data: { favorites: [1, 2] } }, "bad-favorites"],
  ])("rejects invalid file %#", (raw, code) => {
    expect(() => importState(emptyState(), raw)).toThrowError(new ImportError(code));
  });

  it("drops custom stations with non-http(s) URLs and clamps settings", () => {
    const r = importState(emptyState(), {
      app: "prof-ali-kotb-smart-radio",
      schema: 1,
      data: {
        favorites: [],
        custom: [{ id: "x", name: "evil", url: "javascript:alert(1)" }, { id: "y", name: "ok", url: "https://ok.example/a" }],
        settings: { textScale: 99, volume: -3, lang: "fr" },
      },
    });
    expect(r.custom.map((c) => c.id)).toEqual(["y"]);
    expect(r.settings.textScale).toBe(1);
    expect(r.settings.volume).toBe(1);
    expect(r.settings.lang).toBe("ar");
  });
});
