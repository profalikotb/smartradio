import { describe, expect, it } from "vitest";
import { AL_AGHANI_ID, QURAN_CAIRO_ID } from "@/lib/catalog";
import { SEEDS } from "@/lib/state";
const SEED2 = SEEDS[2]!.favorites; // Excel "Favourite = Yes" rows that are shown (none beyond Quran/Aghani right now)
import { CURRENT_SEED, ImportError, addCustomStation, addRecent, applySeeds, deleteStation, emptyState, exportState, hydrate, importState, moveCore, moveFavorite, toggleCore, toggleFavorite, type AppState } from "@/lib/state";

const reload = (s: AppState) => hydrate(JSON.stringify(s)); // simulates app restart / update

describe("one-time default seeding", () => {
  it("first run: Quran first, Al Aghani second (both pinned), then the Excel favourites", () => {
    const s = hydrate(null);
    expect(s.favorites).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID, ...SEED2]);
    expect(s.pinned.slice(0, 2)).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(s.seedVersion).toBe(CURRENT_SEED);
  });

  it("a removed core station stays removed across reloads and updates", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, AL_AGHANI_ID);
    expect(reload(reload(s)).favorites).toEqual([QURAN_CAIRO_ID, ...SEED2]);
  });

  it("user order is never re-sorted", () => {
    let s = hydrate(null);
    s = toggleFavorite(s, "rb:x");
    for (let i = 0; i < 5; i++) s = moveFavorite(s, "rb:x", -1);
    expect(reload(s).favorites).toEqual(["rb:x", QURAN_CAIRO_ID, AL_AGHANI_ID, ...SEED2]);
  });

  it("a future seed version appends only missing ids at the end", () => {
    const s: AppState = { ...emptyState(), seedVersion: 1, favorites: [AL_AGHANI_ID] }; // user removed Quran after seed 1
    const seeds = {
      1: { favorites: [QURAN_CAIRO_ID, AL_AGHANI_ID], pinned: [], groups: [] },
      2: { favorites: [AL_AGHANI_ID, "eg-new"], pinned: [], groups: [] },
    };
    const next = applySeeds(s, seeds);
    expect(next.favorites).toEqual([AL_AGHANI_ID, "eg-new"]); // Quran NOT re-added, Aghani not duplicated
    expect(applySeeds(next, seeds)).toBe(next); // idempotent
  });

  it("corrupt storage never crashes", () => {
    expect(hydrate("{not json").favorites).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID, ...SEED2]);
    expect(hydrate(JSON.stringify({ favorites: "oops", seedVersion: 1 })).favorites).toEqual([...SEED2]); // only the newer seed
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

import { restoreStation } from "@/lib/state";
describe("delete / add / restore stations", () => {
  it("deleting a catalog station removes it everywhere and survives reload; restore brings it back", () => {
    let s = hydrate(null);
    s = deleteStation(s, AL_AGHANI_ID);
    expect(s.favorites).not.toContain(AL_AGHANI_ID);
    expect(s.pinned).not.toContain(AL_AGHANI_ID);
    expect(s.groups.every((g) => !g.stationIds.includes(AL_AGHANI_ID))).toBe(true);
    s = reload(s);
    expect(s.hidden).toContain(AL_AGHANI_ID);
    expect(s.favorites).not.toContain(AL_AGHANI_ID); // seeds never re-add it
    s = restoreStation(s, AL_AGHANI_ID);
    expect(s.hidden).not.toContain(AL_AGHANI_ID);
  });
  it("adding then deleting a custom station erases it completely", () => {
    let s = addCustomStation(hydrate(null), "My Station", "https://x.example/live", "abc");
    expect(s.favorites).toContain("custom:abc");
    s = deleteStation(reload(s), "custom:abc");
    expect(s.custom).toHaveLength(0);
    expect(s.favorites).not.toContain("custom:abc");
    expect(s.hidden).not.toContain("custom:abc");
  });
  it("deleted list is included in export/import", () => {
    const s = deleteStation(hydrate(null), "eg-mega");
    const r = importState(emptyState(), JSON.parse(JSON.stringify(exportState(s))));
    expect(r.hidden).toEqual(["eg-mega"]);
  });
});

describe("editable core stations", () => {
  it("defaults to Quran then Aghani, also for old saved state", () => {
    expect(emptyState().core).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(hydrate(JSON.stringify({ favorites: [] })).core).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
  });
  it("keeps the user's edited list (even empty) across reloads", () => {
    const s = toggleCore(toggleCore(emptyState(), QURAN_CAIRO_ID), AL_AGHANI_ID);
    expect(s.core).toEqual([]);
    expect(hydrate(JSON.stringify(s)).core).toEqual([]);
  });
  it("adds, reorders, and drops on delete", () => {
    let s = toggleCore(emptyState(), "eg-nogoum");
    expect(s.core).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID, "eg-nogoum"]);
    s = moveCore(s, "eg-nogoum", -1);
    expect(s.core).toEqual([QURAN_CAIRO_ID, "eg-nogoum", AL_AGHANI_ID]);
    expect(moveCore(s, QURAN_CAIRO_ID, -1)).toBe(s);
    s = deleteStation(s, "eg-nogoum");
    expect(s.core).toEqual([QURAN_CAIRO_ID, AL_AGHANI_ID]);
    expect(s.hidden).toContain("eg-nogoum");
    s = toggleCore(s, "eg-nogoum"); // re-adding un-hides
    expect(s.hidden).not.toContain("eg-nogoum");
  });
  it("adds a new custom station straight into core and survives export/import", () => {
    const s = addCustomStation(emptyState(), "X", "https://x.example/live", "abc", true);
    expect(s.core.at(-1)).toBe("custom:abc");
    expect(importState(emptyState(), exportState(s)).core).toEqual(s.core);
  });
});

describe("stream link replaced on this device", () => {
  it("sets, survives reload and export/import, and resets", async () => {
    const { setStreamOverride } = await import("@/lib/state");
    let s = setStreamOverride(hydrate(null), AL_AGHANI_ID, " https://fresh.example/live.m3u8 ");
    expect(s.streamOverrides[AL_AGHANI_ID]).toBe("https://fresh.example/live.m3u8");
    expect(hydrate(JSON.stringify(s)).streamOverrides[AL_AGHANI_ID]).toBe("https://fresh.example/live.m3u8");
    expect(importState(emptyState(), exportState(s)).streamOverrides[AL_AGHANI_ID]).toBe("https://fresh.example/live.m3u8");
    s = setStreamOverride(s, AL_AGHANI_ID, "");
    expect(s.streamOverrides).toEqual({});
  });
});
