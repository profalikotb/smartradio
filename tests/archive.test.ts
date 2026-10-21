import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/archive/route";

const META = {
  files: [
    { name: "Mustafa_Ismaiil_ReDa_MoHamMeD (10).mp3", source: "original", format: "VBR MP3", title: "صدقة جارية", length: "612.4" },
    { name: "Mustafa_Ismaiil_ReDa_MoHamMeD (2).mp3", source: "original", format: "VBR MP3", title: "صدقة جارية", length: "1200" },
    { name: "Mustafa_Ismaiil_ReDa_MoHamMeD (3).mp3", source: "original", format: "VBR MP3", title: "صدقة جارية", length: "05:00" },
    { name: "Mustafa_Ismaiil_ReDa_MoHamMeD (2).ogg", source: "derivative", format: "Ogg Vorbis" },
    { name: "سورة يوسف - حفلة 1965.mp3", source: "original", format: "VBR MP3", length: "900" },
    { name: "intro.mp3", source: "original", format: "VBR MP3", length: "8" },
    { name: "cover.jpg", source: "original", format: "JPEG" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("/api/archive", () => {
  it("returns original MP3s only, natural order, readable labels, no short fragments", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(META), { status: 200 })));
    const r = await GET(new NextRequest("http://x/api/archive?ids=Torath_Mustafa_Ismaiil_By_ReDa_MoHamMeD"));
    const { tracks } = (await r.json()) as { tracks: { url: string; label: string }[] };
    expect(tracks.map((t) => t.label)).toEqual(["تلاوة رقم 2", "تلاوة رقم 3", "تلاوة رقم 10", "سورة يوسف - حفلة 1965"]);
    expect(tracks[0]!.url).toBe("https://archive.org/download/Torath_Mustafa_Ismaiil_By_ReDa_MoHamMeD/Mustafa_Ismaiil_ReDa_MoHamMeD%20(2).mp3");
  });
  it("rejects bad ids and reports an unreachable archive", async () => {
    expect((await GET(new NextRequest("http://x/api/archive?ids=../etc"))).status).toBe(400);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 502 })));
    expect((await GET(new NextRequest("http://x/api/archive?ids=abc_1"))).status).toBe(503);
  });
});
