const required = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_BUILD_SHA",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_LEGAL_COMPANY_NAME",
  "NEXT_PUBLIC_LEGAL_RNC",
  "NEXT_PUBLIC_LEGAL_ADDRESS",
  "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  for (const name of missing)
    console.error(`Missing GitHub Actions variable: ${name}`);
  process.exit(1);
}
console.log(
  "Required production variables are present; the build validates their values.",
);
