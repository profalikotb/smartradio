import { ARTISTS } from "@/lib/umm/artists";
import { artistLibraryResponse } from "@/lib/server/artistLibrary";

/** GET /api/halim → the halim song library (songs → versions) from the Internet Archive. */
export const dynamic = "force-dynamic";

export async function GET() {
  return artistLibraryResponse(ARTISTS.halim);
}
