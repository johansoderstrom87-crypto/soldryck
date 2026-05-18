import { getPublicClaimedVenues } from "../../lib/claimed-venues-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const venues = await getPublicClaimedVenues();
  return Response.json(
    { venues },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
