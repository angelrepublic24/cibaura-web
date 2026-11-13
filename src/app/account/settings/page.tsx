import { redirect } from "next/navigation";
import { settingsHrefWithQuery, type SettingsSearchParams } from "@/modules/account/helpers/settings-routes";

export default async function SettingsIndex({ searchParams }: { searchParams: Promise<SettingsSearchParams> }) {
  redirect(settingsHrefWithQuery("/account/settings/profile", await searchParams));
}
