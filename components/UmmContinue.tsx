"use client";
import { ArtistContinue } from "./artist/ArtistContinue";

/** Kept for existing imports. */
export function UmmContinue({ compact = false }: { compact?: boolean }) {
  return <ArtistContinue slug="umm" compact={compact} />;
}
