/**
 * Identify an audio file by its content (first bytes), not its name. Files from download sites are
 * often renamed: an old RealAudio/WMA recording or even a web page saved as ".mp3".
 */
export interface Sniffed {
  format: string; // MP3, AAC, M4A, FLAC, WAV, OGG, AIFF, WMA, RealAudio, AMR, HTML, ZIP, Unknown
  mime: string;
  /** Browsers can normally play it (MP3/AAC/M4A/FLAC/WAV; OGG not on iPhone). */
  playable: boolean;
}

const KINDS: Record<string, Omit<Sniffed, "format">> = {
  MP3: { mime: "audio/mpeg", playable: true },
  AAC: { mime: "audio/aac", playable: true },
  M4A: { mime: "audio/mp4", playable: true },
  FLAC: { mime: "audio/flac", playable: true },
  WAV: { mime: "audio/wav", playable: true },
  OGG: { mime: "audio/ogg", playable: true },
  AIFF: { mime: "audio/aiff", playable: true },
  WMA: { mime: "audio/x-ms-wma", playable: false },
  RealAudio: { mime: "audio/vnd.rn-realaudio", playable: false },
  AMR: { mime: "audio/amr", playable: false },
  HTML: { mime: "text/html", playable: false },
  ZIP: { mime: "application/zip", playable: false },
  RAR: { mime: "application/vnd.rar", playable: false },
  Unknown: { mime: "application/octet-stream", playable: false },
};

const kind = (format: string): Sniffed => ({ format, ...KINDS[format]! });

export function sniffBytes(b: Uint8Array): Sniffed {
  const s = (o: number, t: string) => [...t].every((ch, i) => b[o + i] === ch.charCodeAt(0));
  if (s(0, "ID3")) return kind("MP3");
  if (s(0, "fLaC")) return kind("FLAC");
  if (s(0, "RIFF") && s(8, "WAVE")) return kind("WAV");
  if (s(0, "OggS")) return kind("OGG");
  if (s(4, "ftyp")) return kind("M4A");
  if (s(0, "FORM") && (s(8, "AIFF") || s(8, "AIFC"))) return kind("AIFF");
  if (s(0, ".RMF") || s(0, ".ra\xfd")) return kind("RealAudio");
  if (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xb2 && b[3] === 0x75) return kind("WMA");
  if (s(0, "#!AMR")) return kind("AMR");
  if (s(0, "PK\x03\x04")) return kind("ZIP");
  if (s(0, "Rar!")) return kind("RAR");
  // MPEG audio without an ID3 tag: frame sync somewhere near the start.
  for (let i = 0; i < Math.min(b.length - 1, 4096); i++) {
    if (b[i] === 0xff && (b[i + 1]! & 0xe0) === 0xe0) {
      if ((b[i + 1]! & 0xf6) === 0xf0) return kind("AAC"); // ADTS
      if ((b[i + 1]! & 0x06) !== 0) return kind("MP3"); // layer bits set
    }
  }
  const head = new TextDecoder("latin1").decode(b.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?xml") || head.startsWith("<head")) return kind("HTML");
  return kind("Unknown");
}

export async function sniff(blob: Blob): Promise<Sniffed> {
  try {
    return sniffBytes(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()));
  } catch {
    return kind("Unknown");
  }
}

/** Arabic explanation for a file the browser can't play. */
export function whyNotPlayable(x: Sniffed): string {
  switch (x.format) {
    case "RealAudio":
      return "هذا الملف ليس MP3 فعليًا بل RealAudio (صيغة قديمة). المتصفحات لا تشغّلها. حوّله إلى MP3 مجانًا ببرنامج VLC ثم أضفه.";
    case "WMA":
      return "هذا الملف بصيغة WMA (ويندوز ميديا) وإن كان اسمه mp3. المتصفحات لا تشغّلها. حوّله إلى MP3 مجانًا ببرنامج VLC ثم أضفه.";
    case "AMR":
      return "هذا الملف بصيغة AMR (تسجيل هاتف). حوّله إلى MP3 مجانًا ببرنامج VLC ثم أضفه.";
    case "HTML":
      return "هذا ليس ملفًا صوتيًا بل صفحة ويب حُفظت باسم mp3 (التحميل لم يكتمل من الموقع). احذفه وحمّل الملف الصوتي نفسه.";
    case "ZIP":
    case "RAR":
      return `هذا ملف مضغوط (${x.format}) وليس ملفًا صوتيًا. فك الضغط أولًا ثم أضف الملفات الصوتية التي بداخله.`;
    default:
      return "تعذّر التعرف على صيغة هذا الملف أو أنه تالف/غير مكتمل. جرّب تشغيله في برنامج VLC؛ إن عمل، حوّله إلى MP3 ثم أضفه.";
  }
}
