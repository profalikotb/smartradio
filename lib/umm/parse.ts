import { normalize } from "../search/normalize";

/**
 * Umm Kulthum library, built from Internet Archive items. Every audio file becomes a *version* of a
 * song (studio recording or a dated concert); versions of the same song are grouped together.
 * Pure functions: shared by the API route and the tests.
 */

export interface UmmSource {
  key: string;
  item: string;
  name: string;
  url: string;
  /** How to label versions from this item when the file name says nothing more. */
  kind: "studio" | "concert" | "mixed";
}

export const UMM_SOURCES: UmmSource[] = [
  { key: "ward2u", item: "ward2u_06", name: "Internet Archive — جميع أغاني أم كلثوم", url: "https://archive.org/details/ward2u_06", kind: "mixed" },
  { key: "studio", item: "omkolthoum", name: "Internet Archive — أغاني أم كلثوم (تسجيلات استوديو)", url: "https://archive.org/details/omkolthoum", kind: "studio" },
  { key: "concerts", item: "51970", name: "Internet Archive — المجموعة الكاملة لأغاني أم كلثوم (حفلات)", url: "https://archive.org/details/51970", kind: "concert" },
  { key: "all", item: "Um-Kalthoum", name: "Internet Archive — Um Kalthoum, All Songs", url: "https://archive.org/details/Um-Kalthoum", kind: "mixed" },
];

export interface Version {
  /** Stable id "<item>/<file>" — saved listening progress is keyed by it. */
  id: string;
  songKey: string;
  songTitle: string;
  /** e.g. «تسجيل استوديو», «حفلة 25 مارس 1965» */
  label: string;
  /** Full display title for the player and lock screen. */
  title: string;
  audioUrl: string;
  duration: number;
  year?: number;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
}

export interface Song {
  key: string;
  title: string;
  /** true when the title is Arabic (false = only a Latin transliteration was available). */
  arabic: boolean;
  versions: Version[];
}

export interface Library {
  generatedAt: string;
  sources: { key: string; name: string; url: string; ok: boolean; files: number }[];
  songs: Song[];
}

export interface IaFile {
  name: string;
  source?: string;
  format?: string;
  title?: string;
  length?: string;
}

/** Latin transliterations seen in the archive items → Arabic song titles. */
const TRANSLIT: [string, string[]][] = [
  ["الأطلال", ["al atlal", "el atlal", "alatilal", "atlal", "al-atlal"]],
  ["ألف ليلة وليلة", ["alf layla", "alf lela we lela", "alf leila wa leila", "alf leila", "alf lela"]],
  ["أغدًا ألقاك", ["aghadan alqak", "aghad alqaq", "aghdaan alqak", "aghadan alqaak", "aghadan al2ak"]],
  ["أقبل الليل", ["aqbal ellayl", "aqbil allayl", "akbal el leil", "aqbal el layl"]],
  ["أمل حياتي", ["amal hayati", "amul hayati", "amal hayaty"]],
  ["أنساك", ["ansak"]],
  ["أراك عصي الدمع", ["arak assy al damey", "arak asy el dam3", "araka asiya al dam3"]],
  ["بعيد عنك", ["baeed annak", "baeid eank", "ba3id 3anak", "baeed anak"]],
  ["ودارت الأيام", ["daret el ayam", "wadarat al ayam", "w daret el ayam", "we daret el ayam"]],
  ["الحب كله", ["elhob koloh", "alhabu kulh", "el hob kollo", "elhob kolloh"]],
  ["إنت الحب", ["enta el hobb", "enta el hob", "inta el hob"]],
  ["إنت عمري", ["enta omry", "iint eumry", "enta omri", "inta omri"]],
  ["اسأل روحك", ["esaal ro7ak", "esal rohak", "isal rohak", "esaal rohak"]],
  ["فكروني", ["fakarouni", "fakruni", "fakarony", "fakaroni"]],
  ["فات الميعاد", ["fat el maad", "fat almiead", "fat el mi3ad", "fat el meaad"]],
  ["حكم علينا الهوى", ["hakam aleena el hawa", "hakam alina el hawa"]],
  ["هذه ليلتي", ["hathehi laylati", "hazihi laylati", "hazehi lailati"]],
  ["القلب يعشق كل جميل", ["alqalb ye3shaq kol gameel", "el alb ye3sha2 kol gamil", "alqalb yaashaq kol gameel"]],
  ["جددت حبك ليه", ["gaddet hobak", "gadet hobak", "gadedt hobak"]],
  ["حديث الروح", ["hadeeth el roh", "hadith alruwh", "hadith el roh"]],
  ["غريب على باب الرجاء", ["ghareeb ala bab al ragaa"]],
  ["حب إيه", ["hob eh", "hob eih"]],
  ["أغار من نسمة الجنوب", ["aghar men nesmat al janoub", "aghar men nesmet el ganoub"]],
  ["ليلة حب", ["leilet hob", "lelat hob", "laylat hob"]],
  ["للصبر حدود", ["lelsabr hedod", "lel sabr hedoud", "lilsabr hodood"]],
  ["لسه فاكر", ["lessa faker", "lisah fakir", "lessa fakir"]],
  ["من أجل عينيك", ["men agl aynik", "min agl aynayk"]],
  ["ظلموني الناس", ["zalamony el nas", "zalamouni el nas"]],
  ["ظلمنا الحب", ["zalmna el hob", "zalamna el hob"]],
  ["ذكريات", ["zekreat", "zekryat", "dhikriat", "zekrayat"]],
  ["ثورة الشك", ["thawrat alshaki", "thawret el shak", "sawret el shak"]],
  ["سيرة الحب", ["sirat alhab", "seret el hob", "sirat el hob"]],
  ["يا مسهرني", ["ya musaharni", "ya mesaharni", "ya msaharny"]],
  ["رباعيات الخيام", ["rubaeyat alkhiam", "robaiyat el khayam", "rubaiyat al khayyam"]],
  ["دليلي احتار", ["dalili iihtar", "dalili ehtar", "dalily ehtar"]],
  ["أقول لك إيه عن الشوق", ["aqwlk iyh ean alshuwq", "a2olak eh"]],
  ["هو صحيح الهوى غلاب", ["howa sahih el hawa ghalab"]],
  ["الأولة في الغرام", ["el awela fel gharam", "alawla fi algharam"]],
  ["رق الحبيب", ["raq el habib", "ra2 el habib"]],
  ["مصر التي في خاطري", ["masr elly fi khatry", "masr allati fi khatiri"]],
  ["يا ظالمني", ["ya zalemny", "ya zalemni"]],
  ["حيرت قلبي معاك", ["hayart albi maak", "hayart qalbi ma3ak"]],
  ["الآهات", ["el ahat", "al ahat"]],
  ["شمس الأصيل", ["shams el aseel", "shams al aseel"]],
  ["سهران لوحدي", ["sahran lewahdi", "sahran lwahdy"]],
  ["يا صباح الخير", ["ya sabah el kheir"]],
];

/** Consonant skeleton of a Latin transliteration: tolerant of vowel and spacing variants. */
export function skeleton(latin: string): string {
  return latin
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiouy]/g, "")
    .replace(/(.)\1+/g, "$1");
}

const BY_SKELETON = new Map<string, string>();
for (const [ar, variants] of TRANSLIT) for (const v of variants) BY_SKELETON.set(skeleton(v), ar);
const KNOWN_AR = TRANSLIT.map(([ar]) => ar).sort((a, b) => normalize(b).length - normalize(a).length);

const isArabic = (s: string) => /[؀-ۿ]{2}/.test(s);
const MONTHS = /(يناير|جانفي|فبراير|فيفري|مارس|أبريل|ابريل|أفريل|افريل|مايو|ماي|يونيو|جوان|يوليو|جويلية|أغسطس|اغسطس|أوت|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/;

export function songKey(title: string): string {
  const n = normalize(title).replace(/\s+/g, " ").trim();
  let h = 5381;
  for (const ch of n) h = (Math.imul(h, 33) ^ ch.codePointAt(0)!) | 0;
  return (h >>> 0).toString(36);
}

/** Split an Arabic name like «أراك عصي الدمع 25 مارس 1965 الأزبكية» into song + version detail. */
export function splitArabic(name: string): { song: string; detail: string } {
  const clean = name.replace(/\s+/g, " ").trim();
  const n = normalize(clean);
  for (const ar of KNOWN_AR) {
    const k = normalize(ar);
    if (n.startsWith(k)) {
      // Cut the original string after the same number of words.
      const words = ar.split(" ").length;
      const parts = clean.split(" ");
      return { song: ar, detail: parts.slice(words).join(" ").replace(/^[-–—\s]+/, "").trim() };
    }
  }
  const m = /^(.*?)(?:\s*[-–—]\s*|\s+)(?=\d|حفل|حفله|حفلة|تسجيل|استوديو|ستوديو|نسخة|الوصلة)(.*)$/.exec(clean);
  if (m && m[1]!.trim().length >= 2) return { song: m[1]!.trim(), detail: m[2]!.trim() };
  return { song: clean, detail: "" };
}

function cleanBase(file: string): string {
  return file
    .split("/")
    .pop()!
    .replace(/\.mp3$/i, "")
    .replace(/^\s*\d{1,3}\s*[.\-_)]\s*/, "")
    .replace(/^(studio|ستوديو|استوديو)\s*[-_ ]\s*/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSeconds(len?: string): number {
  if (!len) return 0;
  const v = len.includes(":") ? len.split(":").reduce((a, x) => a * 60 + Number(x), 0) : Number(len);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** Title for one file: folder (Arabic) → distinctive Arabic metadata title → Arabic file name → known transliteration → Latin. */
export function identify(f: IaFile, titleCounts: Map<string, number>): { song: string; arabic: boolean; detail: string } | null {
  const base = cleanBase(f.name);
  if (/qur'?an|quran|قرآن|قران/i.test(base) || /qur'?an|قرآن/i.test(f.title ?? "")) return null; // not a song
  const folder = f.name.includes("/") ? f.name.split("/").slice(-2, -1)[0]!.trim() : "";
  if (folder && isArabic(folder)) {
    const s = splitArabic(folder);
    const rest = isArabic(base) ? splitArabic(base).detail || base.replace(folder, "").trim() : "";
    return { song: s.song, arabic: true, detail: rest };
  }
  const meta = f.title?.trim();
  if (meta && isArabic(meta) && (titleCounts.get(meta) ?? 0) <= 2) {
    const s = splitArabic(meta.replace(/^أم كلثوم\s*[-–—]\s*/, "").replace(/\(.*?\)/g, "").trim());
    return { song: s.song, arabic: true, detail: s.detail };
  }
  if (isArabic(base)) {
    const s = splitArabic(base.replace(/^أم كلثوم\s*[-–—]\s*/, ""));
    return { song: s.song, arabic: true, detail: s.detail };
  }
  const versionNo = /\s*(\d+)\s*$/.exec(base)?.[1];
  const latin = base.replace(/\s*\d+\s*$/, "").trim();
  const ar = BY_SKELETON.get(skeleton(latin));
  if (ar) return { song: ar, arabic: true, detail: versionNo ? `نسخة ${versionNo}` : "" };
  if (!latin) return null;
  return { song: latin.replace(/\b\w/g, (c) => c.toUpperCase()), arabic: false, detail: versionNo ? `نسخة ${versionNo}` : "" };
}

function versionLabel(src: UmmSource, detail: string): string {
  if (detail) {
    if (/^\d/.test(detail) && MONTHS.test(detail)) return `حفلة ${detail}`;
    return detail;
  }
  return src.kind === "studio" ? "تسجيل استوديو" : src.kind === "concert" ? "تسجيل حفلة" : "تسجيل";
}

export function buildLibrary(input: { source: UmmSource; files: IaFile[] | null }[], now = new Date()): Library {
  const songs = new Map<string, Song>();
  const sources: Library["sources"] = [];
  for (const { source, files } of input) {
    const audio = (files ?? []).filter((f) => f.source === "original" && /\.mp3$/i.test(f.name) && /mp3/i.test(f.format ?? "mp3"));
    sources.push({ key: source.key, name: source.name, url: source.url, ok: !!files, files: audio.length });
    const counts = new Map<string, number>();
    for (const f of audio) if (f.title) counts.set(f.title.trim(), (counts.get(f.title.trim()) ?? 0) + 1);
    for (const f of audio) {
      const seconds = parseSeconds(f.length);
      if (seconds && seconds < 60) continue; // fragments / intros
      const idn = identify(f, counts);
      if (!idn) continue;
      const key = songKey(idn.song);
      let song = songs.get(key);
      if (!song) songs.set(key, (song = { key, title: idn.song, arabic: idn.arabic, versions: [] }));
      else if (!song.arabic && idn.arabic) Object.assign(song, { title: idn.song, arabic: true });
      const label = versionLabel(source, idn.detail);
      const year = Number(/\b(19[2-7]\d)\b/.exec(idn.detail)?.[1]) || undefined;
      song.versions.push({
        id: `${source.item}/${f.name}`,
        songKey: key,
        songTitle: idn.song,
        label,
        title: "",
        audioUrl: `https://archive.org/download/${source.item}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
        duration: seconds,
        year,
        sourceKey: source.key,
        sourceName: source.name,
        sourceUrl: source.url,
      });
    }
  }
  const coll = new Intl.Collator("ar", { sensitivity: "base", numeric: true });
  const list = [...songs.values()];
  for (const s of list) {
    // Studio first, then concerts by year, then the rest.
    const rank = (v: Version) => (v.label === "تسجيل استوديو" ? 0 : v.year ? 1 : 2);
    s.versions.sort((a, b) => rank(a) - rank(b) || (a.year ?? 0) - (b.year ?? 0) || coll.compare(a.label, b.label));
    for (const v of s.versions) v.title = `${s.title} — ${v.label}`;
  }
  list.sort((a, b) => Number(b.arabic) - Number(a.arabic) || coll.compare(a.title, b.title));
  return { generatedAt: now.toISOString(), sources, songs: list };
}

/** Display names for the player ids "umm:all" / "umm:s:<key>" (song names registered at runtime). */
const names = new Map<string, string>();
export function registerSongNames(lib: Library) {
  for (const s of lib.songs) names.set(s.key, s.title);
}
export function ummName(id: string): { nameAr: string; nameEn: string } | null {
  if (!id.startsWith("umm:")) return null;
  if (id === "umm:all") return { nameAr: "أم كلثوم – الاستماع المتصل", nameEn: "Umm Kulthum — continuous" };
  const t = names.get(id.slice(6));
  return { nameAr: t ? `أم كلثوم – ${t}` : "أم كلثوم", nameEn: t ? `Umm Kulthum — ${t}` : "Umm Kulthum" };
}
