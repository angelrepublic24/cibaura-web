import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { SettingsPageTitle } from "@/modules/account/components/settings-section";

export default function SecuritySettingsPage() {
  return <div><SettingsPageTitle title="Security" description="Keep your account protected." /><ChangePasswordForm className="w-full max-w-none" /></div>;
}
