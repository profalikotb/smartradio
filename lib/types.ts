export type Lang = "ar" | "en";
export type Category = "quran" | "religious" | "news" | "culture" | "sports" | "music" | "regional" | "general";

/** How confident we are that a stream belongs to the named station. */
export type IdentityStatus =
  | "catalog-verified" // identity checked against an authoritative source and recorded in the catalog
  | "user-confirmed" // the user confirmed a directory candidate on this device
  | "unverified"; // no stream bound to this station yet

export interface StreamRef {
  /** Resolved, playable URL. Only ever comes from the directory, a playlist resolver, or the user. */
  url: string;
  codec?: string;
  bitrate?: number; // kbps, from directory metadata
  hls?: boolean;
  /** Directory health (Radio Browser lastcheckok). NOT the same as playback success. */
  directoryOk?: boolean;
  directoryCheckedAt?: string;
  source: "radio-browser" | "custom" | "playlist";
}

export interface CatalogStation {
  id: string;
  nameAr: string;
  nameEn: string;
  aliases: string[];
  category: Category;
  country: "EG";
  city?: string;
  frequency?: string;
  website?: string;
  core?: boolean;
  /** Radio Browser station UUID whose identity we verified. Stream URL is resolved live from it. */
  radioBrowserUuid?: string;
  /** Rules a directory record must satisfy to be offered as a candidate for this station. */
  match?: { names: string[]; homepageHints?: string[] };
  identity: {
    status: "catalog-verified" | "unverified";
    sources: { label: string; url: string }[];
    verifiedOn?: string; // dd/MM/yyyy
    note: string;
  };
}

export interface DirectoryStation {
  uuid: string;
  name: string;
  countrycode: string;
  country: string;
  language: string;
  tags: string;
  homepage: string;
  favicon: string;
  codec: string;
  bitrate: number;
  hls: boolean;
  url: string;
  urlResolved: string;
  lastcheckok: boolean;
  lastcheckoktime: string;
  votes: number;
  clickcount: number;
}

/** What the player works with: a station plus every legitimate stream for it. */
export interface PlayableStation {
  id: string; // catalog id, "rb:<uuid>" or "custom:<id>"
  nameAr: string;
  nameEn: string;
  country: string;
  category: Category;
  logo?: string;
  website?: string;
  identity: IdentityStatus;
  streams: StreamRef[];
}

export interface CustomStation {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export type PlayerStatus = "idle" | "connecting" | "playing" | "paused" | "buffering" | "offline" | "unavailable";
