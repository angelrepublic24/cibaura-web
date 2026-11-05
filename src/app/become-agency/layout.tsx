import { AGENCY_SIGNUP_PATH } from "@/shared/config/supply";
import { pageMetadata } from "@/shared/seo/metadata";

// Dominican Republic only. Verified against the backend geo module: the
// catalogue a renter can browse comes from `GET /geo/countries`
// (geo.service.ts), and the United States reference data
// (modules/geo/data/united-states.seed.ts) exists in code but is not seeded in
// production — so a recruitment page must not advertise that market.
export function generateMetadata() {
  return pageMetadata({ title: "List your rental agency", description: "Join Cibaura as a rental agency in the Dominican Republic. List your fleet, manage bookings and reach renters.", path: AGENCY_SIGNUP_PATH });
}

export default function BecomeAgencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
