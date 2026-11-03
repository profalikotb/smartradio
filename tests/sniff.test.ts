import { describe, expect, it } from "vitest";
import { sniffBytes, whyNotPlayable } from "@/lib/umm/sniff";

const bytes = (...parts: (string | number[])[]) => {
  const out: number[] = [];
  for (const p of parts) typeof p === "string" ? out.push(...[...p].map((c) => c.charCodeAt(0))) : out.push(...p);
  while (out.length < 64) out.push(0);
  return new Uint8Array(out);
};

describe("audio format by content", () => {
  it("recognises playable formats", () => {
    expect(sniffBytes(bytes("ID3", [3, 0]))).toMatchObject({ format: "MP3", mime: "audio/mpeg", playable: true });
    expect(sniffBytes(bytes([0, 0, 0xff, 0xfb, 0x90]))).toMatchObject({ format: "MP3", playable: true }); // no ID3, frame sync
    expect(sniffBytes(bytes([0xff, 0xf1, 0x50]))).toMatchObject({ format: "AAC" });
    expect(sniffBytes(bytes("fLaC"))).toMatchObject({ format: "FLAC", mime: "audio/flac" });
    expect(sniffBytes(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toMatchObject({ format: "WAV" });
    expect(sniffBytes(bytes([0, 0, 0, 0x20], "ftypM4A "))).toMatchObject({ format: "M4A", mime: "audio/mp4" });
  });
  it("catches renamed files the browser can't play (RealAudio, WMA, web page, zip)", () => {
    expect(sniffBytes(bytes(".RMF"))).toMatchObject({ format: "RealAudio", playable: false });
    expect(sniffBytes(bytes([0x30, 0x26, 0xb2, 0x75]))).toMatchObject({ format: "WMA", playable: false });
    expect(sniffBytes(bytes("  <!DOCTYPE html><html>"))).toMatchObject({ format: "HTML", playable: false });
    expect(sniffBytes(bytes("PK", [3, 4]))).toMatchObject({ format: "ZIP", playable: false });
    expect(whyNotPlayable(sniffBytes(bytes(".RMF")))).toContain("RealAudio");
    expect(whyNotPlayable(sniffBytes(bytes("<html>")))).toContain("صفحة ويب");
  });
});
