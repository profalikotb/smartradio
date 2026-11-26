import { ARTISTS } from "@/lib/umm/artists";
import { artistLibraryResponse } from "@/lib/server/artistLibrary";

/** GET /api/umm → the umm song library (songs → versions) from the Internet Archive. */
export const dynamic = "force-dynamic";

export async function GET() {
  return artistLibraryResponse(ARTISTS.umm);
}
