import type { Category, CatalogStation } from "./types";
import CHANNELS from "./channels.json";
import { normalize } from "./search/normalize";

/**
 * Station list = data/radio-channels.xlsx (converted to lib/channels.json by scripts/import-channels.mjs
 * before every build). To add, remove or change a station: edit the Excel file and upload it to GitHub.
 *
 * KNOWN below only adds app metadata (stable id, English name, category, frequency, search aliases)
 * for stations whose Arabic name it recognises. Unknown rows still work, with a generic id/category.
 * Stable ids keep favorites/core/history when a URL changes.
 */
export const CATALOG_VERSION = 2;
export const CATALOG_REVIEWED_ON = "21/10/2026";

export const QURAN_CAIRO_ID = "eg-quran-cairo";
export const AL_AGHANI_ID = "eg-al-aghani";
export const GENERAL_PROGRAM_ID = "eg-general-program";
export const CORE_IDS = [QURAN_CAIRO_ID, AL_AGHANI_ID] as const;

export interface ChannelRow {
  no: number | null;
  name: string;
  nameEn: string | null;
  url: string | null;
  /** All links in the cell (first = url); older JSON may lack it. */
  urls?: string[];
  format: string | null;
  result: string | null;
  checkedOn: string | null;
  favourite: boolean;
  core: boolean | null;
  source: string | null;
  notes: string | null;
  frequency: string | null;
  category: string | null;
  /** false = hidden via the Excel "Show" column. Older JSON may lack it (= shown). */
  show?: boolean;
}

interface Meta {
  id: string;
  /** Tribute/online stations not based in Egypt: the in-app stream finder searches every country. */
  anyCountry?: boolean;
  matchNames?: string[];
  nameEn: string;
  category: Category;
  frequency?: string;
  website?: string;
  aliases: string[];
}

/** Matched on the Excel "Channel" name (any listed spelling). */
const KNOWN: { match: string[]; meta: Meta }[] = [
  { match: ["القرآن الكريم", "القران الكريم"], meta: { id: QURAN_CAIRO_ID, nameEn: "Holy Quran Radio — Cairo", category: "quran", frequency: "98.2 FM", website: "https://misrquran.gov.eg/", aliases: ["اذاعة القران الكريم", "قران القاهرة", "quran cairo", "holy quran radio", "misr quran"] } },
  { match: ["الأغاني", "الاغاني"], meta: { id: AL_AGHANI_ID, nameEn: "Al Aghani Radio", category: "music", frequency: "105.8 FM", aliases: ["اذاعة الاغاني", "الاغاني", "al aghani", "aghani", "elaghany"] } },
  { match: ["البرنامج العام"], meta: { id: GENERAL_PROGRAM_ID, nameEn: "General Program", category: "general", frequency: "107.4 FM", aliases: ["البرنامج العام", "general program", "el bernameg el aam"] } },
  { match: ["9090"], meta: { id: "eg-9090", nameEn: "Radio 9090", category: "music", frequency: "90.9 FM", website: "https://www.9090.fm/", aliases: ["9090", "راديو 9090", "radio 9090"] } },
  { match: ["نغم"], meta: { id: "eg-nagham", nameEn: "Nagham FM", category: "music", frequency: "105.3 FM", aliases: ["نغم اف ام", "nagham fm"] } },
  { match: ["ميجا"], meta: { id: "eg-mega", nameEn: "Mega FM", category: "music", frequency: "92.7 FM", aliases: ["ميجا اف ام", "mega fm"] } },
  { match: ["شعبي"], meta: { id: "eg-shaaby", nameEn: "Shaabi FM 95", category: "music", frequency: "95.0 FM", aliases: ["شعبي اف ام", "shaaby fm", "sha3by fm", "shaabi"] } },
  { match: ["نايل"], meta: { id: "eg-nile-fm", nameEn: "Nile FM", category: "music", frequency: "104.2 FM", aliases: ["نايل اف ام", "nile fm"] } },
  { match: ["صوت العرب"], meta: { id: "eg-sout-el-arab", nameEn: "Sout El Arab", category: "news", frequency: "106.3 FM", aliases: ["صوت العرب", "sout el arab", "voice of the arabs"] } },
  { match: ["الشرق الأوسط", "الشرق الاوسط"], meta: { id: "eg-middle-east", nameEn: "Middle East Radio", category: "general", frequency: "89.5 FM", aliases: ["الشرق الاوسط", "middle east radio"] } },
  { match: ["الثقافي"], meta: { id: "eg-cultural", nameEn: "Cultural Program", category: "culture", frequency: "91.5 FM", aliases: ["البرنامج الثقافي", "cultural program"] } },
  { match: ["الموسيقي"], meta: { id: "eg-music-program", nameEn: "Music Program", category: "music", frequency: "98.8 FM", aliases: ["البرنامج الموسيقي", "music program"] } },
  { match: ["الشباب"], meta: { id: "eg-youth-sports", nameEn: "Youth & Sports Radio", category: "sports", frequency: "108 FM", aliases: ["الشباب والرياضة", "youth and sports"] } },
  { match: ["راديو مصر"], meta: { id: "eg-radio-masr", nameEn: "Radio Masr", category: "news", frequency: "88.7 FM", aliases: ["راديو مصر", "radio masr"] } },
  { match: ["القاهرة الكبرى"], meta: { id: "eg-greater-cairo", nameEn: "Greater Cairo Radio", category: "regional", frequency: "102.2 FM", aliases: ["القاهرة الكبرى", "greater cairo"] } },
  { match: ["نجوم"], meta: { id: "eg-nogoum", nameEn: "Nogoum FM", category: "music", frequency: "100.6 FM", website: "https://www.nogoumfm.net/", aliases: ["نجوم اف ام", "nogoum fm", "nogoom"] } },
  { match: ["هيتس", "hits"], meta: { id: "eg-radio-hits-882", nameEn: "Radio Hits 88.2", category: "music", frequency: "88.2 FM", website: "https://radiohits882.com/", aliases: ["راديو هيتس", "radio hits"] } },
  { match: ["أون سبورت", "اون سبورت", "on sport"], meta: { id: "eg-on-sport", nameEn: "ON Sport FM", category: "sports", frequency: "93.7 FM", website: "https://onsportfm.com/", aliases: ["اون سبورت", "on sport fm", "onsport"] } },
  { match: ["ميكس", "mix fm"], meta: { id: "eg-mix-fm", nameEn: "Mix FM 87.8", category: "music", frequency: "87.8 FM", aliases: ["ميكس اف ام", "mix fm"] } },
  { match: ["الشعراوي", "الشعراوى", "sharawy", "shaarawy"], meta: { id: "sharawy", nameEn: "Sheikh Al-Sha'rawi Radio", category: "religious", aliases: ["الشعراوي", "اذاعة الشعراوي", "تفسير الشعراوي", "sharawy", "shaarawy", "shaarawi"] } },
  { match: ["الحصري مجود", "الحصرى مجود", "hussary mujawwad"], meta: { id: "husary-mojawwad", nameEn: "Al-Husary Radio (Mujawwad)", category: "quran", aliases: ["الحصري مجود", "husary mujawwad"] } },
  { match: ["الحصري", "الحصرى", "hussary", "husary"], meta: { id: "husary", nameEn: "Al-Husary Radio", category: "quran", aliases: ["الحصري", "محمود خليل الحصري", "husary", "hussary", "hosary"] } },
  { match: ["مصطفى إسماعيل تسجيلات نادرة", "مصطفى اسماعيل تسجيلات نادرة", "مصطفى إسماعيل نادر", "تسجيلات نادرة", "mustafa ismail rare"], meta: { id: "mustafa-ismail-rare", nameEn: "Mustafa Ismail — Rare Recordings", category: "quran", aliases: ["مصطفى اسماعيل نادره", "تسجيلات نادره", "تلاوات نادره", "حفلات مصطفى اسماعيل", "mustafa ismail rare", "mustafa ismail concerts"] } },
  { match: ["مصطفى إسماعيل تجويد", "مصطفى اسماعيل تجويد", "مصطفى إسماعيل مجود", "مصطفى اسماعيل مجود", "mustafa ismail mujawwad"], meta: { id: "mustafa-ismail-mojawwad", nameEn: "Mustafa Ismail — Tajweed (Mujawwad)", category: "quran", aliases: ["مصطفى اسماعيل تجويد", "مصطفى اسماعيل مجود", "mustafa ismail mujawwad", "mustafa ismail tajweed"] } },
  { match: ["مصطفى إسماعيل", "مصطفى اسماعيل", "mustafa ismail"], meta: { id: "mustafa-ismail", nameEn: "Mustafa Ismail Radio", category: "quran", aliases: ["مصطفى اسماعيل", "mustafa ismail", "mostafa ismail"] } },
  { match: ["المنشاوي مجود", "المنشاوى مجود", "minshawi mujawwad"], meta: { id: "minshawi-mojawwad", nameEn: "Al-Minshawi Radio (Mujawwad)", category: "quran", aliases: ["المنشاوي مجود", "minshawi mujawwad"] } },
  { match: ["المنشاوي", "المنشاوى", "minshawi"], meta: { id: "minshawi", nameEn: "Al-Minshawi Radio", category: "quran", aliases: ["المنشاوي", "محمد صديق المنشاوي", "minshawi", "menshawy"] } },
  { match: ["كلثوم", "kalthoum", "kolthoum", "kulthum"], meta: { id: "umm-kulthum", nameEn: "Umm Kulthum Radio", category: "music", anyCountry: true, matchNames: ["كلثوم", "kalthoum", "kolthoum", "kalthom", "kulthum", "koulthoum"], aliases: ["ام كلثوم", "كوكب الشرق", "umm kulthum", "oum kalthoum", "om kalthoum"] } },
  { match: ["الإسكندرية", "الاسكندرية"], meta: { id: "eg-alexandria", nameEn: "Alexandria Radio", category: "regional", aliases: ["اذاعة الاسكندرية", "alexandria radio"] } },
];

const CATEGORIES: Category[] = ["quran", "religious", "news", "culture", "sports", "music", "regional", "general"];

function metaFor(row: ChannelRow): Meta {
  const n = normalize(row.name);
  const hit = KNOWN.find((k) => k.match.some((m) => n.includes(normalize(m))));
  if (hit) return hit.meta;
  // Unknown station: stable id from its name, so favorites survive URL edits.
  let h = 0;
  for (const ch of row.name) h = (Math.imul(h, 31) + ch.codePointAt(0)!) | 0;
  return { id: `xl-${(h >>> 0).toString(36)}`, nameEn: row.nameEn || row.name, category: "general", aliases: [] };
}

export function stationFromRow(row: ChannelRow): CatalogStation {
  const m = metaFor(row);
  const checkedOk = !!row.url && /200|audio received/i.test(row.result ?? "");
  const category = CATEGORIES.includes(row.category as Category) ? (row.category as Category) : m.category;
  return {
    id: m.id,
    nameAr: row.name,
    nameEn: row.nameEn || m.nameEn,
    aliases: m.aliases,
    category,
    country: "EG",
    city: "Cairo",
    frequency: row.frequency || m.frequency,
    website: m.website,
    core: CORE_IDS.includes(m.id as (typeof CORE_IDS)[number]),
    archive: archiveOf(row),
    playlist: isPlaylist(row) ? { base: row.url!.replace(/\/?$/, "/"), count: 114 } : undefined,
    directStreams: isPlaylist(row) || archiveOf(row) ? undefined : row.url ? (row.urls?.length ? row.urls : [row.url]).map((url) => ({ url, codec: row.format ?? undefined })) : undefined,
    match: { names: m.matchNames ?? m.aliases.slice(0, 2), anyCountry: m.anyCountry },
    favourite: row.favourite,
    identity: {
      status: checkedOk ? "catalog-verified" : "unverified",
      verifiedOn: checkedOk ? row.checkedOn ?? undefined : undefined,
      sources: row.source ? [{ label: "Source page (from the Excel list)", url: row.source }] : [],
      note: [row.result, row.checkedOn ? `(${row.checkedOn})` : "", row.notes].filter(Boolean).join(" — ") || "From the Excel station list.",
    },
  };
}

/** Format column says "Playlist" (or قائمة/سور) and the link is a folder of 001.mp3…114.mp3 files. */
function isPlaylist(row: ChannelRow): boolean {
  return !!row.url && /playlist|قائمة|سور/i.test(row.format ?? "");
}

/**
 * Format "Archive" (or links to archive.org/details/…): plays every recording in those items.
 * Shuffled like a radio; write "Archive ordered" / "بالترتيب" to keep the item's order.
 */
function archiveOf(row: ChannelRow): CatalogStation["archive"] {
  const urls = row.urls?.length ? row.urls : row.url ? [row.url] : [];
  const ids = urls.map((u) => /archive\.org\/(?:details|download)\/([A-Za-z0-9._-]+)/.exec(u)?.[1]).filter((x): x is string => !!x);
  if (!ids.length || !(/archive|أرشيف|ارشيف/i.test(row.format ?? "") || ids.length === urls.length)) return undefined;
  return { ids, shuffle: !/order|ترتيب/i.test(row.format ?? "") };
}

function build(rows: ChannelRow[]): CatalogStation[] {
  const seen = new Set<string>();
  const out: CatalogStation[] = [];
  for (const r of rows) {
    if (r.show === false) continue;
    const s = stationFromRow(r);
    if (seen.has(s.id)) continue; // a duplicate row for the same station: first one wins
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

export const CATALOG: CatalogStation[] = build(CHANNELS as ChannelRow[]);
export const catalogById = new Map(CATALOG.map((s) => [s.id, s]));
