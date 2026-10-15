import { HOST_SIGNUP_PATH } from "@/shared/config/supply";
import { pageMetadata } from "@/shared/seo/metadata";

export function generateMetadata() {
  return pageMetadata({ title: "Rent out your car", description: "Become a private host on Cibaura. List your car in the Dominican Republic, set your daily rate and manage rental requests.", path: HOST_SIGNUP_PATH });
}

export default function BecomeHostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
