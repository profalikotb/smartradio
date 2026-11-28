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
  /** For a derivative (e.g. "VBR MP3"), the original file it was made from. */
  original?: string;
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

/** Abdel Halim Hafez: known titles (help split «اهواك حفل أضواء المدينة 1957» into song + concert). */
const HALIM_TITLES: [string, string[]][] = [
  ["قارئة الفنجان", ["qareat el fengan", "kariat el fingan", "qariat al finjan"]],
  ["أي دمعة حزن لا", ["ay damet hozn la", "ay dam3et 7ozn la"]],
  ["الوطن الأكبر", ["el watan el akbar", "al watan al akbar"]],
  ["أسمر يا أسمراني", ["asmar ya asmarani"]],
  ["زي الهوا", ["zay el hawa", "zay al hawa"]],
  ["سواح", ["sawah", "sawwah"]],
  ["موعود", ["mawood", "maw3oud", "mawoud"]],
  ["جانا الهوى", ["gana el hawa", "gana al hawa"]],
  ["على حسب وداد قلبي", ["ala hesb wedad", "3ala 7asab wedad"]],
  ["أهواك", ["ahwak", "ahwaak"]],
  ["صافيني مرة", ["safini marra", "safeeni mara"]],
  ["بتلوموني ليه", ["betlomoni leh", "betloumouni leh"]],
  ["الهوى هوايا", ["el hawa hawaya"]],
  ["أول مرة تحب يا قلبي", ["awel mara t7eb ya alby", "awel marra tehib ya albi"]],
  ["بيني وبينك إيه", ["beny w beink eh"]],
  ["كفاية نورك عليا", ["kefaya nourek alaya"]],
  ["يا مولعين بالسهر", ["ya mewal3een bel sahar"]],
  ["الماء والخضرة", ["el maa wel khodra"]],
  ["في يوم في شهر في سنة", ["fi yom fi shahr fi sana"]],
  ["فاتت جنبنا", ["fatet ganbena", "fatet gambena"]],
  ["رسالة من تحت الماء", ["resala men taht el maa", "risala min taht al maa"]],
  ["مداح القمر", ["maddah el amar", "madah el amar"]],
  ["حاول تفتكرني", ["hawel tefteker ni", "hawel teftekerni"]],
  ["نبتدي منين الحكاية", ["nebtedi menein el hekaya"]],
  ["لا تكذبي", ["la takzeby", "la takdhibi"]],
  ["توبة", ["toba", "tooba"]],
  ["بتقولي بكره", ["betolly bokra"]],
  ["جبار", ["gabbar", "gabar"]],
  ["حبك نار", ["habak nar", "hobak nar"]],
  ["خسارة خسارة", ["khosara khosara"]],
  ["قولي حاجة", ["olly haga", "oulli haga"]],
  ["وحياة قلبي وأفراحه", ["we hayat alby", "wehyat albi"]],
  ["بالأحضان", ["bel ahdan"]],
  ["الحلوة", ["el helwa"]],
  ["على قد الشوق", ["ala ad el shoq", "ala add el shouk"]],
  ["ضحك ولعب وجد وحب", ["dehk we leab"]],
  ["نار يا حبيبي نار", ["nar ya habibi nar"]],
  ["بحلم بيك", ["bahlam bik"]],
  ["عدى النهار", ["adda el nahar", "ada el nahar"]],
  ["المسيح", ["el maseeh", "al masih"]],
  ["صورة", ["soura", "sura"]],
  ["تخونوه", ["tekhonoh", "takhounou"]],
  ["ظلموه", ["zalamooh", "zalamouh"]],
  ["أنا لك على طول", ["ana lak ala tool"]],
  ["في يوم من الأيام", ["fi yom men el ayam"]],
  ["ليه تشغل بالك", ["leh teshghel balak"]],
  ["يا خلي القلب", ["ya khaly el alb"]],
  ["تخونوه", ["takhonoh"]],
  ["الليل", ["el leil", "al layl"]],
];

/** Fairuz: known titles + transliterations used by the archive uploads (e.g. "Fairouz-BhebakMaBaarif"). */
const FAIRUZ_TITLES: [string, string[]][] = [
  ["أعطني الناي وغنِّ", ["aateny el nay wa ghany", "aatini al nay", "aateni el nay"]],
  ["أحترف الحزن والانتظار", ["ahtarifou al houzna", "ahtarif el hozn"]],
  ["الله معك يا هوانا", ["alah maak ya hawana", "allah maak ya hawana"]],
  ["على جسر اللوزية", ["ala jisr el laouzieh", "ala jesr el lawzieh"]],
  ["بعدك على بالي", ["baadak ala bali", "ba3dak 3ala bali"]],
  ["بحبك ما بعرف", ["bhebak ma baarif", "b7ebak ma ba3ref"]],
  ["بكوخنا يا ابني", ["bkoukhna yabni", "bkokhna ya ebni"]],
  ["درج الورد", ["daraj el ward"]],
  ["بقطفلك بس", ["bakteflek bas", "ba2tefellak bass"]],
  ["بكرا بيجي نيسان", ["bokra byeji nisan"]],
  ["سألوني الناس", ["saalouni el nas", "sa2alouni el nas"]],
  ["شادي", ["shady", "shadi"]],
  ["زهرة المدائن", ["zahrat al madaen", "zahret el madayen"]],
  ["نسم علينا الهوى", ["nassam alayna el hawa", "nasam 3alayna el hawa"]],
  ["كيفك إنت", ["kifak enta", "keefak inta"]],
  ["سهار بعد سهار", ["sahar baad sahar"]],
  ["حبيتك بالصيف", ["habbaytak bel sayf", "7abaytak bel seif"]],
  ["قديش كان في ناس", ["addesh kan fi nas", "adeish kan fi nas"]],
  ["أنا لحبيبي", ["ana la habibi", "ana lahabibi"]],
  ["يا دارة دوري فينا", ["ya dara douri fina"]],
  ["نحنا والقمر جيران", ["nehna wel amar jiran", "nehna wel 2amar jiran"]],
  ["سكن الليل", ["sakana el layl", "sakan el leil"]],
  ["سنرجع يومًا", ["sanarjeou yawman", "sanarja3 yawman"]],
  ["شط إسكندرية", ["shatt eskendereya"]],
  ["يا أنا يا أنا", ["ya ana ya ana"]],
  ["ليالي الشمال الحزينة", ["layali el shamal el hazina"]],
  ["بيروت هل ذرفت", ["bairut hal zarafat", "beirut hal tharafat"]],
  ["الكويت", ["al kuwait", "el kuwait"]],
  ["دبكة لبنان", ["debka lebonan", "dabke lebnan"]],
];

/** How one artist's archive files are read: titles, name prefixes to strip, files that are not songs. */
export interface ParseOpts {
  translit: [string, string[]][];
  stripPrefix: RegExp;
  exclude: RegExp;
  /** Extra text removed anywhere in a name (album tags like «أغاني الحنين», "( Fairuz )"). */
  cleanup?: RegExp;
}
export const UMM_PARSE: ParseOpts = { translit: TRANSLIT, stripPrefix: /^أم كلثوم\s*[-–—]\s*/, exclude: /qur'?an|quran|قرآن|قران/i };
export const HALIM_PARSE: ParseOpts = {
  translit: HALIM_TITLES,
  stripPrefix: /^(?:عبد\s*ال?حليم\s*حافظ|بد\s*الحليم\s*حافظ|العندليب|حليم|حافظ)\s*[.\-–—_:]*\s*/,
  // Interviews, talks and programmes are not songs.
  exclude: /حوار|برنامج|لقاء|يحكى|يحكي|يتعالج|يتعالح|مقابلة|حديث مع|حديث عن|interview|adil imam|qur'?an|قرآن/i,
};

export const FAIRUZ_PARSE: ParseOpts = {
  translit: FAIRUZ_TITLES,
  stripPrefix: /^(?:السيدة\s+)?(?:فيروز|fairou?z|fayrouz|feyrouz)\s*[.\-–—_:]*\s*/i,
  exclude: /the best of|تشكيلة|أجمل اغاني|اجمل اغاني|من جميع الألبومات|interview|حوار|لقاء/i,
  cleanup: /\(\s*fairou?z\s*\)|[اأ]غاني الحنين|\s+[-–—]?\s*فيروز\s*$/gi,
};

interface Compiled {
  bySkeleton: Map<string, string>;
  known: string[];
}
const compiled = new WeakMap<ParseOpts, Compiled>();
function compile(o: ParseOpts): Compiled {
  let c = compiled.get(o);
  if (!c) {
    const bySkeleton = new Map<string, string>();
    for (const [ar, variants] of o.translit) for (const v of variants) bySkeleton.set(skeleton(v), ar);
    const known = [...new Set(o.translit.map(([ar]) => ar))].sort((a, b) => normalize(b).length - normalize(a).length);
    compiled.set(o, (c = { bySkeleton, known }));
  }
  return c;
}

/** Consonant skeleton of a Latin transliteration: tolerant of vowel and spacing variants. */
export function skeleton(latin: string): string {
  return latin
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiouy]/g, "")
    .replace(/(.)\1+/g, "$1");
}


const isArabic = (s: string) => /[؀-ۿ]{2}/.test(s);
const MONTHS = /(يناير|جانفي|فبراير|فيفري|مارس|أبريل|ابريل|أفريل|افريل|مايو|ماي|يونيو|جوان|يوليو|جويلية|أغسطس|اغسطس|أوت|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/;

export function songKey(title: string): string {
  const n = normalize(title).replace(/\s+/g, " ").trim();
  let h = 5381;
  for (const ch of n) h = (Math.imul(h, 33) ^ ch.codePointAt(0)!) | 0;
  return (h >>> 0).toString(36);
}

/** Split an Arabic name like «أراك عصي الدمع 25 مارس 1965 الأزبكية» into song + version detail. */
export function splitArabic(name: string, opts: ParseOpts = UMM_PARSE): { song: string; detail: string } {
  const clean = name.replace(/\s+/g, " ").trim();
  const n = normalize(clean);
  for (const ar of compile(opts).known) {
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
    // «الهوى هوايا.تسجيل حفلة» → «الهوى هوايا - تسجيل حفلة»
    .replace(/(?<=[\u0600-\u06FF])\.+(?=[\u0600-\u06FF\s])/g, " - ")
    .replace(/^[-–—.\s]+|[-–—.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSeconds(len?: string): number {
  if (!len) return 0;
  const v = len.includes(":") ? len.split(":").reduce((a, x) => a * 60 + Number(x), 0) : Number(len);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** Title for one file: folder (Arabic) → distinctive Arabic metadata title → Arabic file name → known transliteration → Latin. */
export function identify(f: IaFile, titleCounts: Map<string, number>, opts: ParseOpts = UMM_PARSE): { song: string; arabic: boolean; detail: string } | null {
  const c = compile(opts);
  let base = cleanBase(f.name).replace(opts.stripPrefix, "").replace(opts.stripPrefix, "").trim();
  if (opts.cleanup) base = base.replace(opts.cleanup, " ").replace(/\s+/g, " ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
  // "BhebakMaBaarif" → "Bhebak Ma Baarif" (CamelCase transliterations)
  if (!/\s/.test(base) && /[a-z][A-Z]/.test(base)) base = base.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (opts.exclude.test(base) || opts.exclude.test(f.title ?? "")) return null; // not a song
  const folder = f.name.includes("/") ? f.name.split("/").slice(-2, -1)[0]!.trim() : "";
  if (folder && isArabic(folder)) {
    const s = splitArabic(folder.replace(opts.stripPrefix, ""), opts);
    const rest = isArabic(base) ? splitArabic(base, opts).detail || base.replace(folder, "").trim() : "";
    return { song: s.song, arabic: true, detail: rest };
  }
  const meta = f.title?.trim();
  if (meta && isArabic(meta) && (titleCounts.get(meta) ?? 0) <= 2) {
    const s = splitArabic(meta.replace(opts.stripPrefix, "").replace(/\(.*?\)/g, "").trim(), opts);
    return { song: s.song, arabic: true, detail: s.detail };
  }
  if (isArabic(base)) {
    const s = splitArabic(base, opts);
    return { song: s.song, arabic: true, detail: s.detail };
  }
  const versionNo = /\s*(\d+)\s*$/.exec(base)?.[1];
  const latin = base.replace(/\s*\d+\s*$/, "").trim();
  const ar = c.bySkeleton.get(skeleton(latin));
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

/**
 * Playable audio of an item: original MP3s, and for originals in other formats (WMA, OGG, WAV…)
 * the archive's own MP3 derivative of that file (plays on iPhone too).
 */
export function playableFiles(files: IaFile[]): IaFile[] {
  const out: IaFile[] = [];
  const audioExt = /\.(mp3|ogg|wma|wav|flac|m4a|aac|opus)$/i;
  for (const o of files) {
    if (o.source !== "original" || !audioExt.test(o.name)) continue;
    if (/\.mp3$/i.test(o.name)) {
      out.push(o);
      continue;
    }
    const d = files.find((x) => x.source === "derivative" && x.original === o.name && /\.mp3$/i.test(x.name) && /mp3/i.test(x.format ?? ""));
    if (d) out.push({ ...d, title: d.title ?? o.title, length: d.length ?? o.length });
  }
  return out;
}

export function buildLibrary(input: { source: UmmSource; files: IaFile[] | null }[], now = new Date(), opts: ParseOpts = UMM_PARSE): Library {
  const songs = new Map<string, Song>();
  const sources: Library["sources"] = [];
  for (const { source, files } of input) {
    const audio = playableFiles(files ?? []);
    sources.push({ key: source.key, name: source.name, url: source.url, ok: !!files, files: audio.length });
    const counts = new Map<string, number>();
    for (const f of audio) if (f.title) counts.set(f.title.trim(), (counts.get(f.title.trim()) ?? 0) + 1);
    for (const f of audio) {
      const seconds = parseSeconds(f.length);
      if (seconds && seconds < 60) continue; // fragments / intros
      const idn = identify(f, counts, opts);
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
    // Studio first, then a plain recording (no concert details — usually the original), then concerts by year.
    const rank = (v: Version) => (v.label === "تسجيل استوديو" ? 0 : v.label === "تسجيل" ? 0.5 : v.year ? 1 : 2);
    s.versions.sort((a, b) => rank(a) - rank(b) || (a.year ?? 0) - (b.year ?? 0) || coll.compare(a.label, b.label));
    for (const v of s.versions) v.title = `${s.title} — ${v.label}`;
  }
  list.sort((a, b) => Number(b.arabic) - Number(a.arabic) || coll.compare(a.title, b.title));
  return { generatedAt: now.toISOString(), sources, songs: list };
}

/** Display names for the player ids "<prefix>all" / "<prefix>my" / "<prefix>s:<key>" (songs registered at runtime). */
const names = new Map<string, string>();
const PREFIX_NAMES: Record<string, [string, string]> = { "umm:": ["أم كلثوم", "Umm Kulthum"], "halim:": ["عبد الحليم حافظ", "Abdel Halim Hafez"], "fairuz:": ["فيروز", "Fairuz"] };
export function registerSongNames(lib: Library, prefix = "umm:") {
  for (const s of lib.songs) names.set(prefix + s.key, s.title);
}
export function ummName(id: string): { nameAr: string; nameEn: string } | null {
  const prefix = Object.keys(PREFIX_NAMES).find((p) => id.startsWith(p));
  if (!prefix) return null;
  const [ar, en] = PREFIX_NAMES[prefix]!;
  const rest = id.slice(prefix.length);
  if (rest === "all") return { nameAr: `${ar} – الاستماع المتصل`, nameEn: `${en} — continuous` };
  if (rest === "my") return { nameAr: `${ar} – ملفاتي`, nameEn: `${en} — my files` };
  const t = names.get(prefix + rest.slice(2));
  return { nameAr: t ? `${ar} – ${t}` : ar, nameEn: t ? `${en} — ${t}` : en };
}
export const artistName = ummName;
