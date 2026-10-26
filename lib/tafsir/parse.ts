import { SURAHS } from "../surahs";

/**
 * Tafsir Al-Sha'rawi episode manifest, built from Internet Archive item metadata (file names carry
 * the surah number and the verse range). Pure functions: shared by the API route and the tests.
 */

export interface TafsirSource {
  key: "primary" | "fallback";
  item: string; // archive.org identifier
  name: string;
  url: string;
}

export const SOURCES: TafsirSource[] = [
  {
    key: "primary",
    item: "sharawee-complete-tafseer",
    name: "Internet Archive — Tafseer Quran Sharawi (islamicbulletin.org)",
    url: "https://archive.org/details/sharawee-complete-tafseer",
  },
  {
    key: "fallback",
    item: "tafseer__quran--by-alsha3rawy-sound-vocal--full",
    name: "Internet Archive — تفسير الشعراوي صوتي كامل (ملف لكل سورة)",
    url: "https://archive.org/details/tafseer__quran--by-alsha3rawy-sound-vocal--full",
  },
];

export interface Episode {
  /** Stable id: "<item>/<file name>". Saved progress is keyed by it. */
  id: string;
  surahNumber: number; // 0 = introductions
  surahName: string;
  /** 1-based position within the surah's list. */
  part: number;
  title: string;
  audioUrl: string;
  /** Seconds, from the archive's metadata (0 = unknown until the file loads). */
  duration: number;
  verseStart?: number;
  verseEnd?: number;
  /** For a fallback file that covers several surahs (e.g. 51–60). */
  coversSurahs?: [number, number];
  sourceKey: TafsirSource["key"];
  sourceName: string;
  sourceUrl: string;
  /** "listed" = present in the source's file list; actual playback is confirmed per device at runtime. */
  availabilityStatus: "listed";
}

export interface Manifest {
  generatedAt: string;
  sources: { key: TafsirSource["key"]; name: string; url: string; ok: boolean; files: number }[];
  intro: Episode[];
  /** surah number (1–114) → episodes, in reading order. Missing key = no recording in the sources. */
  surahs: Record<number, Episode[]>;
}

export interface IaFile {
  name: string;
  source?: string;
  format?: string;
  length?: string;
  size?: string;
}

export function surahName(n: number): string {
  return n === 0 ? "مقدمة" : SURAHS[n - 1] ?? String(n);
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function parseSeconds(len?: string): number {
  if (!len) return 0;
  const v = len.includes(":") ? len.split(":").reduce((a, x) => a * 60 + Number(x), 0) : Number(len);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** "002_Al-Baqarah(030_034).mp3" → { surah: 2, verses: [30, 34] }; "001_Al-Fatihah_003.mp3" → part 3; "051_a_060.mp3" → covers 51–60. */
export function parseName(file: string): { surah: number; verseStart?: number; verseEnd?: number; part?: number; covers?: [number, number] } | null {
  const base = file.split("/").pop()!.replace(/\.mp3$/i, "");
  const m = /^(\d{1,3})(?=[_\s.-]|$)/.exec(base);
  if (!m) return null;
  const surah = Number(m[1]);
  if (surah < 0 || surah > 114) return null;
  const range = /^\d{1,3}_a_(\d{1,3})$/i.exec(base);
  if (range) {
    const to = Number(range[1]);
    return to > surah && to <= 114 ? { surah, covers: [surah, to] } : null;
  }
  const v = /\((\d{1,3})\s*[_-]\s*(\d{1,3})\)/.exec(base);
  const part = /_(\d{1,3})$/.exec(base.replace(/\([^)]*\)/g, ""));
  return {
    surah,
    verseStart: v ? Number(v[1]) : undefined,
    verseEnd: v ? Number(v[2]) : undefined,
    part: part && !v ? Number(part[1]) : undefined,
  };
}

function originals(files: IaFile[]): IaFile[] {
  return files.filter((f) => f.source === "original" && /\.mp3$/i.test(f.name));
}

export function episodeTitle(e: Pick<Episode, "surahNumber" | "part" | "verseStart" | "verseEnd" | "coversSurahs">): string {
  if (e.coversSurahs) return `السور ${e.coversSurahs[0]}–${e.coversSurahs[1]} (ملف واحد)`;
  if (e.surahNumber === 0) return `مقدمة التفسير ${e.part}`;
  const verses = e.verseStart ? (e.verseEnd && e.verseEnd !== e.verseStart ? ` · الآيات ${e.verseStart}–${e.verseEnd}` : ` · الآية ${e.verseStart}`) : "";
  return `سورة ${surahName(e.surahNumber)} – الحلقة ${e.part}${verses}`;
}

export function buildManifest(input: { source: TafsirSource; files: IaFile[] | null }[], now = new Date()): Manifest {
  const surahs: Record<number, Episode[]> = {};
  const intro: Episode[] = [];
  const sources: Manifest["sources"] = [];

  for (const { source, files } of input) {
    const list = files ? originals(files) : [];
    sources.push({ key: source.key, name: source.name, url: source.url, ok: !!files, files: list.length });
    if (source.key === "primary") {
      const bySurah = new Map<number, { f: IaFile; p: NonNullable<ReturnType<typeof parseName>> }[]>();
      for (const f of list) {
        const p = parseName(f.name);
        if (!p || p.covers) continue;
        (bySurah.get(p.surah) ?? bySurah.set(p.surah, []).get(p.surah)!).push({ f, p });
      }
      for (const [n, arr] of bySurah) {
        arr.sort((a, b) => (a.p.verseStart ?? 0) - (b.p.verseStart ?? 0) || (a.p.verseEnd ?? 0) - (b.p.verseEnd ?? 0) || (a.p.part ?? 0) - (b.p.part ?? 0) || collator.compare(a.f.name, b.f.name));
        const eps = arr.map(({ f, p }, i) => {
          const e: Episode = {
            id: `${source.item}/${f.name}`,
            surahNumber: n,
            surahName: surahName(n),
            part: i + 1,
            title: "",
            audioUrl: downloadUrl(source.item, f.name),
            duration: parseSeconds(f.length),
            verseStart: p.verseStart,
            verseEnd: p.verseEnd,
            sourceKey: source.key,
            sourceName: source.name,
            sourceUrl: source.url,
            availabilityStatus: "listed",
          };
          e.title = episodeTitle(e);
          return e;
        });
        if (n === 0) intro.push(...eps);
        else surahs[n] = eps;
      }
    } else {
      // Fallback: one long file per surah (and a few multi-surah files). Used only where the primary
      // source has nothing for that surah.
      for (const f of list) {
        const p = parseName(f.name);
        if (!p || p.surah === 0) continue;
        const [from, to] = p.covers ?? [p.surah, p.surah];
        for (let n = from; n <= to; n++) {
          if (surahs[n]?.length) continue;
          const e: Episode = {
            id: `${source.item}/${f.name}`,
            surahNumber: n,
            surahName: surahName(n),
            part: 1,
            title: "",
            audioUrl: downloadUrl(source.item, f.name),
            duration: parseSeconds(f.length),
            coversSurahs: p.covers,
            sourceKey: source.key,
            sourceName: source.name,
            sourceUrl: source.url,
            availabilityStatus: "listed",
          };
          e.title = p.covers ? episodeTitle(e) : `سورة ${surahName(n)} – التفسير كاملًا (ملف واحد)`;
          surahs[n] = [e];
        }
      }
    }
  }
  return { generatedAt: now.toISOString(), sources, intro, surahs };
}

export function downloadUrl(item: string, file: string): string {
  return `https://archive.org/download/${item}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

/** Display names for the player ids "tafsir:<surah>" / "tafsir:all". */
export function tafsirName(id: string): { nameAr: string; nameEn: string } | null {
  if (!id.startsWith("tafsir:")) return null;
  if (id === "tafsir:all") return { nameAr: "تفسير الشعراوي – الاستماع المتصل", nameEn: "Al-Sha'rawi Tafsir — continuous" };
  const n = Number(id.slice(7));
  if (!Number.isInteger(n) || n < 0 || n > 114) return null;
  return { nameAr: `تفسير الشعراوي – سورة ${surahName(n)}`, nameEn: `Al-Sha'rawi Tafsir — Surah ${n}` };
}
