import type { CatalogStation, DirectoryStation } from "./types";
import { normalize } from "./search/normalize";
import { hostOf } from "./search/rank";

/**
 * Strict identity rule for offering a directory record as a candidate stream for a catalog station.
 * Egypt only; the name must contain one of the station's match patterns; when homepage hints exist,
 * the record's homepage host must match one. Candidates are only ever *offered* — the user confirms.
 */
export function isCandidate(station: CatalogStation, d: DirectoryStation): boolean {
  if (d.countrycode !== "EG" || !station.match) return false;
  const name = normalize(d.name);
  const nameOk = station.match.names.some((p) => name.includes(normalize(p)));
  if (!nameOk) return false;
  const hints = station.match.homepageHints;
  if (hints?.length) {
    const host = hostOf(d.homepage);
    if (!hints.some((h) => host === h || host.endsWith("." + h))) return false;
  }
  return true;
}

/** Checks that the live record behind a verified UUID still looks like the station we verified. */
export function identityStillMatches(station: CatalogStation, d: DirectoryStation): boolean {
  if (d.countrycode !== "EG") return false;
  const hints = station.match?.homepageHints;
  if (hints?.length) {
    const host = hostOf(d.homepage);
    return hints.some((h) => host === h || host.endsWith("." + h));
  }
  return true;
}
