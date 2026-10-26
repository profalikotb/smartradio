const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];

/** 3 → «الحلقة الثالثة», 14 → «الحلقة 14». */
export function episodeOrdinal(n: number, lang: "ar" | "en" = "ar"): string {
  if (lang === "en") return `Episode ${n}`;
  return `الحلقة ${ORD[n - 1] ?? n}`;
}

/** 1115 → "18:35" (minutes:seconds; hours when needed). */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** epoch ms → dd/MM/yyyy */
export function ddmmyyyy(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Arabic count of episodes: حلقة واحدة · حلقتان · 3 حلقات · 11 حلقة */
export function episodesCount(n: number, lang: "ar" | "en" = "ar"): string {
  if (lang === "en") return `${n} episode${n === 1 ? "" : "s"}`;
  if (n === 1) return "حلقة واحدة";
  if (n === 2) return "حلقتان";
  if (n >= 3 && n <= 10) return `${n} حلقات`;
  return `${n} حلقة`;
}
