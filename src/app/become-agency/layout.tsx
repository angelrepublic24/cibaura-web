import { AGENCY_SIGNUP_PATH } from "@/shared/config/supply";
import { pageMetadata } from "@/shared/seo/metadata";

export function generateMetadata() {
  return pageMetadata({ title: "List your rental agency", description: "Join Cibaura as a rental agency in the Dominican Republic. List your fleet, manage bookings and reach renters.", path: AGENCY_SIGNUP_PATH });
}

export default function BecomeAgencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
