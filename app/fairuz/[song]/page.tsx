"use client";
import { use } from "react";
import { ArtistSong } from "@/components/artist/ArtistSong";

export default function SongPage({ params }: { params: Promise<{ song: string }> }) {
  const { song } = use(params);
  return <ArtistSong slug="fairuz" songKey={song} />;
}
