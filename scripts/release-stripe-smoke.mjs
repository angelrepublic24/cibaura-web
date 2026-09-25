import assert from "node:assert/strict";
import { assertReleaseStripe } from "./check-release-stripe.mjs";
const live = "pk_live_SyntheticContractOnly";
let checks = 0;
for (const flag of ["true", "false", "0", "yes"]) {
  assert.throws(
    () =>
      assertReleaseStripe({
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: live,
        NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: flag,
      }),
    /forbids/,
  );
  checks++;
}
for (const key of [
  undefined,
  "",
  "pk_test_SyntheticContractOnly",
  "sk_live_secret",
  "pk_live_PLACEHOLDER",
]) {
  assert.throws(
    () => assertReleaseStripe({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: key }),
    /requires/,
  );
  checks++;
}
for (const flag of [undefined, ""]) {
  assert.doesNotThrow(() =>
    assertReleaseStripe({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: live,
      NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: flag,
    }),
  );
  checks++;
}
console.log(`Release Stripe: ${checks} checks passed; no real keys used.`);
