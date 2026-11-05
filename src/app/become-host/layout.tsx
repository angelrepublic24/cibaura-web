import { HOST_SIGNUP_PATH } from "@/shared/config/supply";
import { pageMetadata } from "@/shared/seo/metadata";

// Dominican Republic only — same reason as /become-agency: the market list is
// whatever `GET /geo/countries` returns (backend geo.service.ts), and the
// United States seed is not loaded in production.
export function generateMetadata() {
  return pageMetadata({ title: "Rent out your car", description: "Become a private host on Cibaura. List your car in the Dominican Republic, set your daily rate and manage rental requests.", path: HOST_SIGNUP_PATH });
}

export default function BecomeHostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
