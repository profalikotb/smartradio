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
    // Second listing: same station, homepage maspero.eg/stream/7, HTTPS (Radio Browser, 20/10/2026).
    rbUuidPrefixes: ["5db41df8"],
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
    officialPlayer: { embedUrl: dm("x8n6dyz"), pageUrl: "https://www.maspero.eg/stream/13", provider: "Maspero" },
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
  ...verified({
    id: "eg-nogoum",
    nameAr: "نجوم إف إم",
    nameEn: "Nogoum FM",
    category: "music",
    frequency: "100.6 FM",
    aliases: ["نجوم اف ام", "nogoum fm", "nogoom fm", "nile radio productions"],
    names: ["نجوم", "nogoum", "nogoom"],
    host: "nogoumfm.net",
    website: "https://www.nogoumfm.net/",
    uuid: "047fcfb5-9e59-478e-9e6a-a006cc401868",
    note: "Radio Browser 047fcfb5-… — Egypt, homepage nogoumfm.net (official), 128 kbps MP3 over HTTPS (zeno.fm).",
  }),
  ...verified({
    id: "eg-9090",
    nameAr: "راديو 9090",
    nameEn: "Radio 9090 (90.9 FM)",
    category: "music",
    frequency: "90.9 FM",
    aliases: ["9090", "راديو ٩٠٩٠", "radio 9090", "الراديو 9090"],
    names: ["9090"],
    host: "9090.fm",
    website: "https://www.9090.fm/",
    uuid: "006d7922-ffce-4c74-85ab-55ff2ed60fcc",
    prefixes: ["961a5858"],
    note: "Radio Browser 006d7922-… (HTTPS) and 961a5858-… (same stream, HTTP) — Egypt, homepage 9090.fm (official), 64 kbps MP3 from the operator's own server.",
  }),
  ...verified({
    id: "eg-on-sport",
    nameAr: "أون سبورت إف إم",
    nameEn: "ON Sport FM",
    category: "sports",
    frequency: "93.7 FM",
    aliases: ["on sport fm", "onsport", "اون سبورت", "اون سبورت اف ام"],
    names: ["on sport"],
    host: "onsportfm.com",
    website: "https://onsportfm.com/",
    prefixes: ["79282606", "e25470de"],
    note: "Radio Browser 79282606-… and e25470de-… — Egypt, homepage onsportfm.com (official), HTTPS.",
  }),
  ...verified({
    id: "eg-shaaby",
    nameAr: "إف إم شعبي 95",
    nameEn: "FM Shaaby 95",
    category: "music",
    frequency: "95.0 FM",
    aliases: ["اف ام شعبي", "شعبي اف ام", "sha3by fm", "shaaby fm", "fm shaaby"],
    names: ["sha3by", "shaaby", "شعبي"],
    host: "95-fm.com",
    website: "https://95-fm.com/",
    prefixes: ["9346c66b"],
    note: "Radio Browser 9346c66b-… — Egypt, homepage 95-fm.com (the station's own site), HTTPS.",
  }),
  ...verified({
    id: "eg-mix-fm",
    nameAr: "ميكس إف إم 87.8",
    nameEn: "Mix FM 87.8",
    category: "music",
    frequency: "87.8 FM",
    aliases: ["mix fm", "ميكس اف ام", "mix fm egypt"],
    names: ["mix fm"],
    host: "mixfmegypt.com",
    website: "https://mixfmegypt.com/",
    prefixes: ["b8305209"],
    note: "Radio Browser b8305209-… — Egypt, homepage mixfmegypt.com (official), HTTPS.",
  }),
  // Egyptian state radio (Maspero) publishes these only as Dailymotion live players (IDs taken from
  // worldradiomap.com play pages, cross-checked: Al Aghani x8n6dyz matches maspero.eg/stream/13).
  // They play inside the app's player window.
  ...state("eg-general-program", "إذاعة البرنامج العام", "General Program", "general", "x8n6dt3", 10, ["البرنامج العام", "general program", "el bernameg el aam"], "107.4 FM"),
  ...state("eg-middle-east", "إذاعة الشرق الأوسط", "Middle East Radio", "general", "x8n6drt", 16, ["الشرق الاوسط", "middle east radio", "sharq al awsat"], "89.5 FM"),
  ...state("eg-sout-el-arab", "إذاعة صوت العرب", "Sout El Arab", "news", "x8n6dqq", 9, ["صوت العرب", "sout el arab", "voice of the arabs", "sawt al arab"], "106.3 FM"),
  ...state("eg-cultural", "إذاعة البرنامج الثقافي", "Cultural Program", "culture", "x8n6eci", 12, ["البرنامج الثقافي", "cultural program", "الثقافي"], "91.5 FM"),
  ...state("eg-music-program", "إذاعة البرنامج الموسيقي", "Music Program", "music", "x8n6ea6", undefined, ["البرنامج الموسيقي", "music program", "el bernameg el mosiqi"], "98.8 FM"),
  ...state("eg-youth-sports", "إذاعة الشباب والرياضة", "Youth & Sports Radio", "sports", "x8n6dzo", 11, ["الشباب والرياضة", "youth and sport", "youth & sports"], "108 FM"),
  ...state("eg-radio-masr", "راديو مصر", "Radio Masr", "news", "x8n6dpk", 8, ["راديو مصر", "radio masr", "radio misr"], "88.7 FM"),
  ...state("eg-greater-cairo", "إذاعة القاهرة الكبرى", "Greater Cairo Radio", "regional", "x8n6ebs", 14, ["القاهرة الكبرى", "greater cairo radio"], "102.2 FM"),
  ...direct({
    id: "eg-nagham",
    nameAr: "نغم إف إم",
    nameEn: "Nagham FM",
    frequency: "105.3 FM",
    aliases: ["نغم اف ام", "nagham fm", "راديو نغم"],
    url: "https://ahmsamir.radioca.st/stream",
    note: "Stream published on the World Radio Map Cairo listing (105.3 FM, checked 20/10/2026). HTTPS (radioca.st).",
    source: "https://worldradiomap.com/eg/play/nagham.htm",
  }),
  ...direct({
    id: "eg-mega",
    nameAr: "ميجا إف إم",
    nameEn: "Mega FM",
    frequency: "92.7 FM",
    aliases: ["ميجا اف ام", "mega fm", "mega fm 92.7"],
    url: "http://nebula.shoutca.st:8211/mp3",
    website: "http://megafm927.com/",
    note: "Stream published on the World Radio Map Cairo listing (92.7 FM, website megafm927.com, checked 20/10/2026). HTTP only — browsers may block it inside the secure app; the app tries HTTPS on the same server first.",
    source: "https://worldradiomap.com/eg/play/mega.htm",
  }),
  ...discovery("eg-alexandria", "إذاعة الإسكندرية", "Alexandria Radio", "regional", ["اذاعة الاسكندرية", "alexandria radio"], ["الاسكندرية", "اسكندرية", "alexandria"]),
];

function dm(video: string) {
  return `https://geo.dailymotion.com/player/xi5eg.html?video=${video}`;
}

function state(
  id: string,
  nameAr: string,
  nameEn: string,
  category: CatalogStation["category"],
  video: string,
  masperoStream: number | undefined,
  aliases: string[],
  frequency?: string,
): CatalogStation[] {
  const page = masperoStream ? `https://www.maspero.eg/stream/${masperoStream}` : "https://www.maspero.eg/stream";
  return [
    {
      id,
      nameAr,
      nameEn,
      aliases,
      category,
      country: "EG",
      city: "Cairo",
      frequency,
      match: { names: aliases.slice(0, 2) },
      officialPlayer: { embedUrl: dm(video), pageUrl: page, provider: "Maspero" },
      identity: {
        status: "unverified",
        sources: [
          { label: "Maspero — live page", url: page },
          { label: "World Radio Map — Cairo stations", url: "https://worldradiomap.com/eg/al-qahirah" },
        ],
        note: `Egyptian state radio (National Media Authority). Published only as a Dailymotion live player (video ${video}); plays in the in-app player window while it is open.`,
      },
    },
  ];
}

function direct(o: { id: string; nameAr: string; nameEn: string; frequency: string; aliases: string[]; url: string; website?: string; note: string; source: string }): CatalogStation[] {
  return [
    {
      id: o.id,
      nameAr: o.nameAr,
      nameEn: o.nameEn,
      aliases: o.aliases,
      category: "music",
      country: "EG",
      city: "Cairo",
      frequency: o.frequency,
      website: o.website,
      directStreams: [{ url: o.url, codec: "MP3" }],
      identity: {
        status: "catalog-verified",
        verifiedOn: "20/10/2026",
        sources: [{ label: "World Radio Map — station page", url: o.source }],
        note: o.note,
      },
    },
  ];
}

function verified(o: {
  id: string;
  nameAr: string;
  nameEn: string;
  category: CatalogStation["category"];
  frequency?: string;
  aliases: string[];
  names: string[];
  host: string;
  website: string;
  uuid?: string;
  prefixes?: string[];
  note: string;
}): CatalogStation[] {
  return [
    {
      id: o.id,
      nameAr: o.nameAr,
      nameEn: o.nameEn,
      aliases: o.aliases,
      category: o.category,
      country: "EG",
      city: "Cairo",
      frequency: o.frequency,
      website: o.website,
      radioBrowserUuid: o.uuid,
      rbUuidPrefixes: o.prefixes,
      match: { names: o.names, homepageHints: [o.host] },
      identity: {
        status: "catalog-verified",
        verifiedOn: "20/10/2026",
        sources: [
          { label: `Official website (${o.host})`, url: o.website },
          { label: "Radio Browser — Egypt listing (checked 20/10/2026)", url: "https://www.radio-browser.info/" },
        ],
        note: o.note,
      },
    },
  ];
}

function discovery(
  id: string,
  nameAr: string,
  nameEn: string,
  category: CatalogStation["category"],
  aliases: string[],
  matchNames: string[],
  frequency?: string,
  masperoStream?: number,
): CatalogStation[] {
  const page = masperoStream ? `https://www.maspero.eg/stream/${masperoStream}` : undefined;
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
      officialPlayer: page ? { pageUrl: page, provider: "Maspero" } : undefined,
      identity: {
        status: "unverified",
        sources: [
          { label: "Wikipedia — List of radio stations in Egypt", url: "https://en.wikipedia.org/wiki/List_of_radio_stations_in_Egypt" },
          ...(page ? [{ label: "Maspero — official live page", url: page }] : []),
        ],
        note: page
          ? "No public audio stream for this station in the Radio Browser Egypt listing (checked 20/10/2026). Maspero publishes it on its official live page (video player). “Find stream” re-checks the directory."
          : "Not in the Radio Browser Egypt listing (checked 20/10/2026) and no official web stream found. Shown as unavailable; nothing is substituted.",
      },
    },
  ];
}

export const catalogById = new Map(CATALOG.map((s) => [s.id, s]));
