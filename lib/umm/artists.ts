import { FAIRUZ_PARSE, HALIM_PARSE, UMM_PARSE, UMM_SOURCES, type ParseOpts, type UmmSource } from "./parse";

/**
 * Singer sections (Umm Kulthum, Abdel Halim Hafez…). Each has its own song library from the Internet
 * Archive, its own listening history and favorites, «ملفاتي», continuous play and a live radio.
 * Umm Kulthum keeps the ids/keys it had before this was generalised, so saved progress carries over.
 */
export type ArtistSlug = "umm" | "halim" | "fairuz";

export interface Artist {
  slug: ArtistSlug;
  /** Player-id prefix: "<prefix>s:<song>", "<prefix>all", "<prefix>my". */
  prefix: string;
  route: string;
  api: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  mark: string;
  /** Catalog id of the live radio (Excel row, Show = Section), found in the radio directory at play time. */
  liveId: string;
  liveTitleAr: string;
  liveDescAr: string;
  sources: UmmSource[];
  parse: ParseOpts;
  storeKeys: [string, string];
  libKey: string;
}

export const HALIM_SOURCES: UmmSource[] = [
  { key: "z1", item: "halim-tessgilette-zemene", name: "Internet Archive — عبد الحليم حافظ، تسجيلات زمان (1)", url: "https://archive.org/details/halim-tessgilette-zemene", kind: "mixed" },
  { key: "z2", item: "halim-tessgilette-zemene_201508", name: "Internet Archive — عبد الحليم حافظ (2)", url: "https://archive.org/details/halim-tessgilette-zemene_201508", kind: "mixed" },
  { key: "z3", item: "halim-tessgilette-zemene_20150815", name: "Internet Archive — عبد الحليم حافظ (3)", url: "https://archive.org/details/halim-tessgilette-zemene_20150815", kind: "mixed" },
  { key: "z4", item: "halim-tessgilette-zemene_20150817", name: "Internet Archive — عبد الحليم حافظ (4)", url: "https://archive.org/details/halim-tessgilette-zemene_20150817", kind: "mixed" },
  { key: "z6", item: "7alim6-tessgilette_zemene", name: "Internet Archive — عبد الحليم حافظ (6)", url: "https://archive.org/details/7alim6-tessgilette_zemene", kind: "mixed" },
  { key: "film", item: "halim_maabodat_eljamahir", name: "Internet Archive — أغاني فيلم معبودة الجماهير (صوت الفن)", url: "https://archive.org/details/halim_maabodat_eljamahir", kind: "studio" },
  { key: "adeya", item: "halim_aladeyaaa", name: "Internet Archive — الأدعية (صوت الفن)", url: "https://archive.org/details/halim_aladeyaaa", kind: "studio" },
];

export const FAIRUZ_SOURCES: UmmSource[] = [
  { key: "hanin", item: "Fairuz_201802", name: "Internet Archive — فيروز، أغاني الحنين", url: "https://archive.org/details/Fairuz_201802", kind: "mixed" },
  { key: "f1", item: "moharram1965_gmail_20171102", name: "Internet Archive — فيروزيات", url: "https://archive.org/details/moharram1965_gmail_20171102", kind: "mixed" },
  { key: "f3", item: "moharram1965_gmail_20171102_1234", name: "Internet Archive — فيروزيات (3)", url: "https://archive.org/details/moharram1965_gmail_20171102_1234", kind: "mixed" },
  { key: "bouquet", item: "AghaniFeyrouz", name: "Internet Archive — باقة من أغاني السيدة فيروز", url: "https://archive.org/details/AghaniFeyrouz", kind: "mixed" },
];

export const ARTISTS: Record<ArtistSlug, Artist> = {
  umm: {
    slug: "umm",
    prefix: "umm:",
    route: "/umm",
    api: "/api/umm",
    nameAr: "أم كلثوم",
    nameEn: "Umm Kulthum",
    titleAr: "كوكب الشرق – أم كلثوم",
    titleEn: "Umm Kulthum",
    subtitleAr: "الأغاني والحفلات كاملة",
    subtitleEn: "Songs and full concerts",
    mark: "🎵",
    liveId: "umm-kulthum",
    liveTitleAr: "إذاعة أم كلثوم – بث مباشر",
    liveDescAr: "إذاعة مخصصة لأم كلثوم على مدار الساعة، يختارها التطبيق تلقائيًا من دليل الإذاعات (مثل إذاعة أم كلثوم الرسمية التابعة لوكالة المغرب العربي للأنباء). بث حي: لا تقديم ولا استكمال.",
    sources: UMM_SOURCES,
    parse: UMM_PARSE,
    storeKeys: ["smart-radio:umm-progress:v1", "umm-progress"],
    libKey: "smart-radio:umm-library:v1",
  },
  halim: {
    slug: "halim",
    prefix: "halim:",
    route: "/halim",
    api: "/api/halim",
    nameAr: "عبد الحليم حافظ",
    nameEn: "Abdel Halim Hafez",
    titleAr: "العندليب الأسمر – عبد الحليم حافظ",
    titleEn: "Abdel Halim Hafez",
    subtitleAr: "الأغاني والحفلات والتسجيلات النادرة",
    subtitleEn: "Songs, concerts and rare recordings",
    mark: "🎙️",
    liveId: "halim-live",
    liveTitleAr: "إذاعة عبد الحليم حافظ – بث مباشر",
    liveDescAr: "إذاعة مخصصة لعبد الحليم على مدار الساعة، يختارها التطبيق تلقائيًا من دليل الإذاعات العالمي. بث حي: لا تقديم ولا استكمال، وقد تتضمن إعلانات المحطة نفسها.",
    sources: HALIM_SOURCES,
    parse: HALIM_PARSE,
    storeKeys: ["smart-radio:halim-progress:v1", "halim-progress"],
    libKey: "smart-radio:halim-library:v1",
  },
  fairuz: {
    slug: "fairuz",
    prefix: "fairuz:",
    route: "/fairuz",
    api: "/api/fairuz",
    nameAr: "فيروز",
    nameEn: "Fairuz",
    titleAr: "جارة القمر – فيروز",
    titleEn: "Fairuz",
    subtitleAr: "أغاني الصباح والحنين",
    subtitleEn: "Morning songs and classics",
    mark: "🌙",
    liveId: "fairuz-live",
    liveTitleAr: "إذاعة فيروز – بث مباشر",
    liveDescAr: "إذاعة مخصصة لفيروز على مدار الساعة، يختارها التطبيق تلقائيًا من دليل الإذاعات العالمي. بث حي: لا تقديم ولا استكمال، وقد تتضمن إعلانات المحطة نفسها.",
    sources: FAIRUZ_SOURCES,
    parse: FAIRUZ_PARSE,
    storeKeys: ["smart-radio:fairuz-progress:v1", "fairuz-progress"],
    libKey: "smart-radio:fairuz-library:v1",
  },
};

export const ARTIST_LIST = Object.values(ARTISTS);

export function artistOf(id?: string): Artist | undefined {
  return id ? ARTIST_LIST.find((a) => id.startsWith(a.prefix)) : undefined;
}
