import type { Category } from "../types";
import { normalize, tokens } from "./normalize";

export interface ParsedQuery {
  raw: string;
  text: string; // normalized
  terms: string[]; // meaningful tokens (filters removed)
  country?: string; // ISO code inferred from words like "المصرية" / "egypt"
  category?: Category;
}

const COUNTRY_WORDS: Record<string, string> = {
  مصر: "EG", مصريه: "EG", المصريه: "EG", مصري: "EG", egypt: "EG", egyptian: "EG", masr: "EG", misr: "EG", القاهره: "EG", قاهره: "EG", cairo: "EG",
};

const CATEGORY_WORDS: Record<string, Category> = {
  قران: "quran", القران: "quran", quran: "quran", koran: "quran", كريم: "quran",
  دين: "religious", دينيه: "religious", religious: "religious", islamic: "religious",
  اخبار: "news", news: "news",
  ثقافي: "culture", ثقافه: "culture", culture: "culture", cultural: "culture",
  رياضه: "sports", sport: "sports", sports: "sports",
  موسيقي: "music", اغاني: "music", music: "music", songs: "music",
  اقليميه: "regional", اقليمي: "regional", regional: "regional",
};

/** Words that carry identity (kept as search terms) even though they also imply a filter. */
const IDENTITY_WORDS = new Set(["قران", "القران", "quran", "اغاني", "كريم", "القاهره", "قاهره", "cairo"]);

export function parseQuery(raw: string): ParsedQuery {
  const text = normalize(raw);
  const out: ParsedQuery = { raw, text, terms: [] };
  for (const t of tokens(raw)) {
    const country = COUNTRY_WORDS[t] ?? COUNTRY_WORDS["ال" + t];
    const cat = CATEGORY_WORDS[t] ?? CATEGORY_WORDS["ال" + t];
    if (country) out.country = country;
    if (cat && !out.category) out.category = cat;
    if ((!country && !cat) || IDENTITY_WORDS.has(t)) out.terms.push(t);
  }
  return out;
}
