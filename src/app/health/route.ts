import {
  API_URL,
  SITE_URL,
  STRIPE_PUBLISHABLE_KEY,
  LEGAL_CONFIGURED,
  MAPS_CONFIGURED,
  BUILD_SHA,
} from "@/lib/config";
import { probeUpstream } from "@/lib/upstream-health";
/** HTTP 200 is process liveness; upstream.ok reports dependency health separately. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      baked: {
        apiUrl: API_URL,
        siteUrl: SITE_URL.origin,
        stripeKeyPrefix: STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")
          ? "pk_live_"
          : STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
            ? "pk_test_"
            : null,
        legalConfigured: LEGAL_CONFIGURED,
        mapsConfigured: MAPS_CONFIGURED,
        buildSha: BUILD_SHA,
      },
      upstream: await probeUpstream(API_URL, SITE_URL.origin),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
