import { pathToFileURL } from "node:url";

/** Production publication only. Staging intentionally keeps the existing test-key path. */
export function assertReleaseStripe(env) {
  if (env.NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY?.trim()) {
    throw new Error(
      "Production release forbids NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY; remove it entirely (even false is rejected).",
    );
  }
  const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (
    !/^pk_live_[A-Za-z0-9]+$/.test(key) ||
    /placeholder|replace|changeme/i.test(key)
  ) {
    throw new Error(
      "Production release requires a real pk_live_ publishable key. Test keys are staging-only.",
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    assertReleaseStripe(process.env);
    console.log("Release Stripe policy: valid (live key, no test flag).");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
