import { describe, expect, it } from "vitest";
import { secureVariants, streamsFrom } from "@/lib/stations";
import type { DirectoryStation } from "@/lib/types";

describe("secure stream variants", () => {
  it("keeps https as-is", () => expect(secureVariants("https://a.example/live")).toEqual(["https://a.example/live"]));
  it("upgrades http and drops :80", () => expect(secureVariants("http://a.example:80/live")).toEqual(["https://a.example/live"]));
  it("radiojar nodes map to the HTTPS edge first", () =>
    expect(secureVariants("http://n08.radiojar.com/8s5u5tpdtwzuv?rj-ttl=5")).toEqual([
      "https://stream.radiojar.com/8s5u5tpdtwzuv?rj-ttl=5",
      "https://n08.radiojar.com/8s5u5tpdtwzuv?rj-ttl=5",
    ]));
  it("orders all https candidates before the original http urls", () => {
    const d = { url: "http://stream.radiojar.com/abc", urlResolved: "http://n08.radiojar.com/abc", codec: "MP3", bitrate: 0, hls: false, lastcheckok: true, lastcheckoktime: "" } as DirectoryStation;
    const urls = streamsFrom([d]).map((s) => s.url);
    expect(urls.filter((u) => u.startsWith("http:"))).toEqual(["http://n08.radiojar.com/abc", "http://stream.radiojar.com/abc"]);
    expect(urls.slice(0, urls.length - 2).every((u) => u.startsWith("https:"))).toBe(true);
    expect(urls[0]).toBe("https://stream.radiojar.com/abc");
  });
});
