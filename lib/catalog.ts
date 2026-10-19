import type { CatalogStation } from "./types";

/**
 * Curated Egyptian catalog.
 *
 * Rules:
 *  - No stream URL is hard-coded. Verified stations carry the Radio Browser UUID whose identity we
 *    checked; the current stream URL is resolved live from that record (URLs on radiojar & co. rotate).
 *  - "unverified" stations have NO stream until the user confirms a directory candidate that passes
 *    the strict `match` rules (Egypt + name pattern, optional homepage hint). Nothing is auto-substituted.
 *  - Dates are dd/MM/yyyy.
 */
export const CATALOG_VERSION = 1;
export const CATALOG_REVIEWED_ON = "19/10/2026";

export const QURAN_CAIRO_ID = "eg-quran-cairo";
export const AL_AGHANI_ID = "eg-al-aghani";
export const CORE_IDS = [QURAN_CAIRO_ID, AL_AGHANI_ID] as const;

export const CATALOG: CatalogStation[] = [
  {
    id: QURAN_CAIRO_ID,
    nameAr: "إذاعة القرآن الكريم من القاهرة",
    nameEn: "Holy Quran Radio — Cairo, Egypt",
    aliases: [
      "اذاعة القران الكريم",
      "اذاعة القران الكريم من القاهرة",
      "اذاعة القران المصرية",
      "قران القاهرة",
      "القران الكريم مصر",
      "quran cairo",
      "quran karim egypt",
      "holy quran radio cairo",
      "egyptian quran radio",
      "misr quran",
    ],
    category: "quran",
    country: "EG",
    city: "Cairo",
    website: "https://misrquran.gov.eg/",
    core: true,
    radioBrowserUuid: "8e63e8b6-4e70-4bc0-9f5d-07e8477a4480",
    match: { names: ["القران الكريم"], homepageHints: ["misrquran.gov.eg"] },
    identity: {
      status: "catalog-verified",
      verifiedOn: "19/10/2026",
      sources: [
        { label: "Official website (misrquran.gov.eg)", url: "https://misrquran.gov.eg/" },
        { label: "Radio Browser record (via dRadio mirror; directory check OK 18/10/2026)", url: "https://radio.dubbeh.net/stations/st-8e63e8b6-17" },
        { label: "Official Facebook page (quran.ertu)", url: "https://www.facebook.com/quran.ertu/" },
      ],
      note:
        "Radio Browser UUID 8e63e8b6-… is listed as Egypt / Cairo with homepage misrquran.gov.eg (the station's official government site); MP3 over HTTPS (radiojar). A separate Egyptian listing 'Radio Quran' (homepage surahquran.com) is a third-party stream and is deliberately NOT used. Iranian/Saudi listings with the same Arabic name are excluded by the Egypt + homepage rule.",
    },
  },
  {
    id: AL_AGHANI_ID,
    nameAr: "إذاعة الأغاني المصرية",
    nameEn: "Al Aghani Radio (Egypt)",
    aliases: ["اذاعة الاغاني", "الاغاني", "اغاني ماسبيرو", "al aghani", "aghani egypt", "elaghany", "el aghany", "aghani radio"],
    category: "music",
    country: "EG",
    city: "Cairo",
    frequency: "105.8 FM",
    core: true,
    match: { names: ["الاغاني", "الاغانى", "aghani", "aghany", "elaghany"] },
    // Embedded on Maspero's official Al Aghani page (maspero.eg/stream/13), seen 20/10/2026.
    officialPlayer: {
      embedUrl: "https://geo.dailymotion.com/player/xi5eg.html?video=x8n6dyz",
      pageUrl: "https://www.maspero.eg/stream/13",
      provider: "Maspero · Dailymotion",
    },
    identity: {
      status: "unverified",
      sources: [
        { label: "Wikipedia — Al Aghani Radio (Egyptian Radio, launched 17/06/2000, Cairo 105.8)", url: "https://en.wikipedia.org/wiki/Al_Aghani_Radio" },
        { label: "Wikipedia — List of radio stations in Egypt (105.8, إذاعة الأغانى)", url: "https://en.wikipedia.org/wiki/List_of_radio_stations_in_Egypt" },
        { label: "Masrawy, 19/08/2026 — station active on 105.8 FM (Maspero)", url: "https://www.masrawy.com/news/news_egypt/details/2026/8/19/3035553" },
        { label: "Maspero — official live page (embeds a Dailymotion live player, no direct audio stream)", url: "https://www.maspero.eg/stream/13" },
      ],
      note:
        "Station identity is confirmed (Egyptian national radio, Maspero, 105.8 FM). No official public HTTPS stream could be verified on 19/10/2026; the old official feed (elaghany.com) is defunct. The app searches the directory with strict Egypt + name rules and asks you to confirm a candidate — it never plays a look-alike automatically.",
    },
  },
  {
    id: "eg-radio-hits-882",
    nameAr: "راديو هيتس 88.2",
    nameEn: "Radio Hits 88.2 Cairo",
    aliases: ["radio hits", "راديو هيتس", "hits 88.2"],
    category: "music",
    country: "EG",
    city: "Cairo",
    frequency: "88.2 FM",
    website: "https://radiohits882.com/",
    radioBrowserUuid: "b1d17829-6522-481b-bb5c-839c3fd44353",
    match: { names: ["radio hits"], homepageHints: ["radiohits882.com"] },
    identity: {
      status: "catalog-verified",
      verifiedOn: "19/10/2026",
      sources: [
        { label: "Radio Browser record (via dRadio mirror)", url: "https://radio.dubbeh.net/stations/radio-hits-882-cairo-1028" },
        { label: "Wikipedia — List of radio stations in Egypt (88.2 Radio Hits)", url: "https://en.wikipedia.org/wiki/List_of_radio_stations_in_Egypt" },
      ],
      note: "Radio Browser UUID b1d17829-… lists Egypt, homepage radiohits882.com, 128 kbps MP3 (Shoutcast, HTTPS).",
    },
  },
  ...discovery("eg-general-program", "البرنامج العام", "General Program (Egypt)", "general", ["البرنامج العام", "general program", "el bernameg el aam"], ["البرنامج العام", "general program"]),
  ...discovery("eg-middle-east", "إذاعة الشرق الأوسط", "Middle East Radio (Egypt)", "general", ["الشرق الاوسط", "middle east radio", "sharq al awsat"], ["الشرق الاوسط", "middle east"], "89.5 FM"),
  ...discovery("eg-sout-el-arab", "صوت العرب", "Sout El Arab", "news", ["صوت العرب", "sout el arab", "voice of the arabs"], ["صوت العرب", "sout el arab", "sawt al arab"]),
  ...discovery("eg-cultural", "البرنامج الثقافي", "Cultural Program (Egypt)", "culture", ["البرنامج الثقافي", "cultural program"], ["الثقافي", "cultural"]),
  ...discovery("eg-music-program", "البرنامج الموسيقي", "Music Program (Egypt)", "music", ["البرنامج الموسيقي", "music program", "el bernameg el mosiqi"], ["البرنامج الموسيقي", "mosiqi", "music program"], "98.8 FM"),
  ...discovery("eg-youth-sports", "الشباب والرياضة", "Youth & Sports Radio", "sports", ["الشباب والرياضة", "youth and sport"], ["الشباب والرياضة", "الشباب و الرياضة", "youth"], "108 FM"),
  ...discovery("eg-radio-masr", "راديو مصر", "Radio Masr", "news", ["راديو مصر", "radio masr", "radio misr"], ["راديو مصر", "radio masr", "radio misr"]),
  ...discovery("eg-nogoum", "نجوم إف إم", "Nogoum FM", "music", ["نجوم اف ام", "nogoum fm", "nogoom fm", "nile radio productions"], ["نجوم", "nogoum", "nogoom"], "100.6 FM"),
  ...discovery("eg-mega", "ميجا إف إم", "Mega FM", "music", ["ميجا اف ام", "mega fm"], ["ميجا", "mega fm"], "92.7 FM"),
  ...discovery("eg-nagham", "نغم إف إم", "Nagham FM", "music", ["نغم اف ام", "nagham fm"], ["نغم", "nagham"], "105.3 FM"),
  ...discovery("eg-greater-cairo", "إذاعة القاهرة الكبرى", "Greater Cairo Radio", "regional", ["القاهرة الكبرى", "greater cairo radio"], ["القاهرة الكبرى", "greater cairo"], "102.2 FM"),
  ...discovery("eg-alexandria", "إذاعة الإسكندرية", "Alexandria Radio", "regional", ["اذاعة الاسكندرية", "alexandria radio"], ["الاسكندرية", "اسكندرية", "alexandria"]),
];

function discovery(
  id: string,
  nameAr: string,
  nameEn: string,
  category: CatalogStation["category"],
  aliases: string[],
  matchNames: string[],
  frequency?: string,
): CatalogStation[] {
  return [
    {
      id,
      nameAr,
      nameEn,
      aliases,
      category,
      country: "EG",
      frequency,
      match: { names: matchNames },
      identity: {
        status: "unverified",
        sources: [{ label: "Wikipedia — List of radio stations in Egypt", url: "https://en.wikipedia.org/wiki/List_of_radio_stations_in_Egypt" }],
        note: "Discovery entry: no stream verified on 19/10/2026. Use “Find stream” to review Egyptian directory candidates and confirm one yourself.",
      },
    },
  ];
}

export const catalogById = new Map(CATALOG.map((s) => [s.id, s]));
