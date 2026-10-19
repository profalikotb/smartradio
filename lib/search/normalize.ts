/** Arabic + Latin normalization used for both indexing and querying. */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // harakat, Quranic marks, tatweel
const AR_DIGITS = /[٠-٩]/g;
const FA_DIGITS = /[۰-۹]/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(/[آأإٱٲٳ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(/ک/g, "ك") // Persian kaf
    .replace(/ی/g, "ي") // Persian yeh
    .replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(FA_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalize(input: string): string {
  return normalizeArabic(input.normalize("NFKC").toLowerCase())
    .replace(/[‌-‏‪-‮]/g, "") // bidi/zero-width marks
    .replace(/[.\-_'’"«»(),:;!?/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Arabic definite article and filler words that should not decide a match. */
const STOP = new Set([
  "اذاعه", "راديو", "محطه", "اف", "ام", "fm", "am", "radio", "station", "the", "el", "al", "من", "في", "على", "علي", "live", "بث", "مباشر",
]);

export function tokens(input: string): string[] {
  return normalize(input)
    .split(" ")
    .map((t) => (t.length > 3 && t.startsWith("ال") ? t.slice(2) : t))
    .filter((t) => t && !STOP.has(t));
}

/** Optimal string alignment distance, capped for speed. */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]!;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Score how well query token q matches candidate token c (0..1). */
export function tokenScore(q: string, c: string): number {
  if (q === c) return 1;
  if (c.startsWith(q) && q.length >= 2) return 0.85;
  if (c.includes(q) && q.length >= 3) return 0.7;
  const allowed = q.length <= 4 ? 1 : 2;
  const d = editDistance(q, c, allowed);
  return d <= allowed ? 0.6 - d * 0.1 : 0;
}
