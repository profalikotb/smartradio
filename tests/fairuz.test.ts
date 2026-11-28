import { describe, expect, it } from "vitest";
import { buildLibrary, FAIRUZ_PARSE, identify, type IaFile } from "@/lib/umm/parse";
import { ARTISTS, artistOf } from "@/lib/umm/artists";
import { catalogById } from "@/lib/catalog";

const f = (name: string, extra: Partial<IaFile> = {}): IaFile => ({ name, source: "original", format: "VBR MP3", length: "240", ...extra });
const id = (n: string) => identify(f(n), new Map(), FAIRUZ_PARSE);

describe("Fairuz file names (as on archive.org)", () => {
  it("strips the singer name and album tags", () => {
    expect(id("فيروز - احترف الحزن والإنتظار أغاني الحنين ( Fairuz ).mp3")!.song).not.toMatch(/فيروز|الحنين|Fairuz/i);
    expect(id("فيروز - احترف الحزن والإنتظار أغاني الحنين ( Fairuz ).mp3")!.song).toContain("الحزن");
    expect(id("سكن الليل.mp3")!.song).toBe("سكن الليل");
  });
  it("maps CamelCase transliterations to Arabic titles", () => {
    expect(id("Fairouz-BhebakMaBaarif.mp3")!.song).toBe("بحبك ما بعرف");
    expect(id("Fairouz-AatenyElNayWaGhany.mp3")!.song).toBe("أعطني الناي وغنِّ");
  });
  it("skips medleys", () => {
    expect(id("The Best Of Fairuz.mp3")).toBeNull();
  });
  it("builds a library and wires the section", () => {
    const lib = buildLibrary([{ source: ARTISTS.fairuz.sources[0]!, files: [f("شادي.mp3"), f("Fairouz-Shady.mp3")] }], new Date(), FAIRUZ_PARSE);
    expect(lib.songs.length).toBeGreaterThan(0);
    expect(artistOf("fairuz:s:x")?.slug).toBe("fairuz");
    expect(catalogById.get("fairuz-live")).toBeTruthy();
  });
});
