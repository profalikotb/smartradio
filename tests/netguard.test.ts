import { describe, expect, it } from "vitest";
import { BlockedError, guardedGetText, isPrivateAddress, parsePlaylist, validateUrl } from "@/lib/server/netguard";

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "41.33.1.1", "2a00:1450:4001::1"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it.each([
    ["file:///etc/passwd", "protocol"],
    ["gopher://x/", "protocol"],
    ["https://user:pw@example.com/", "credentials"],
    ["http://example.com:22/", "port"],
    ["http://localhost/", "host"],
    ["http://metadata.internal/", "host"],
  ])("rejects %s", (u, reason) => {
    expect(() => validateUrl(u)).toThrowError(new BlockedError(reason));
  });

  it("blocks literal private IPs before connecting", async () => {
    await expect(guardedGetText("http://169.254.169.254/latest/meta-data")).rejects.toThrowError(new BlockedError("private-ip"));
    await expect(guardedGetText("http://[::1]:8000/")).rejects.toThrowError(new BlockedError("private-ip"));
  });
});

describe("playlist parsing", () => {
  it("parses .pls", () => {
    const r = parsePlaylist("[playlist]\nNumberOfEntries=2\nFile1=https://a.example/live\nTitle1=A\nFile2=http://b.example:8000/\nLength1=-1", "https://p.example/x.pls");
    expect(r).toEqual({ hls: false, urls: ["https://a.example/live", "http://b.example:8000/"] });
  });
  it("parses .m3u with comments and relative entries", () => {
    const r = parsePlaylist("#EXTM3U\n#EXTINF:-1,Radio\nstream.mp3\n\nhttps://c.example/aac", "https://p.example/dir/list.m3u");
    expect(r.urls).toEqual(["https://p.example/dir/stream.mp3", "https://c.example/aac"]);
  });
  it("recognizes HLS manifests and returns them unchanged", () => {
    const r = parsePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=64000\nlow.m3u8", "https://h.example/master.m3u8");
    expect(r).toEqual({ hls: true, urls: ["https://h.example/master.m3u8"] });
  });
  it("ignores non-http protocols", () => {
    expect(parsePlaylist("File1=javascript:alert(1)\nFile2=rtsp://x/y", "https://p/").urls).toEqual([]);
  });
});
