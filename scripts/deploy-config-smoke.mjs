/** Pure configuration regression tests, never a deployable build or real API call. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, env, modules = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    exports,
    URL,
    process: { env },
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return exports;
}
const urlHelpers = load("src/lib/public-url.ts", {});
const { assertSameSite } = load("src/lib/deployment-policy.ts", {});
const base = {
  NODE_ENV: "production",
  NEXT_PUBLIC_BUILD_SHA: "a".repeat(40),
  NEXT_PUBLIC_LEGAL_COMPANY_NAME: "Fixture Operator",
  NEXT_PUBLIC_LEGAL_RNC: "fixture-rnc",
  NEXT_PUBLIC_LEGAL_ADDRESS: "Fixture address",
  NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: "fixture@operator.invalid",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "fixture-maps",
  NEXT_PUBLIC_API_URL: "https://api.cibaura.com",
  NEXT_PUBLIC_SITE_URL: "https://cibaura.com",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_SyntheticValidationOnly",
};
const config = (env) => {
  const result = load("src/lib/config.ts", env, { "./public-url": urlHelpers });
  if (env.NODE_ENV === "production")
    result.assertRequiredFeatures(
      env.ALLOW_DEFAULT_LEGAL === "true",
      env.ALLOW_MISSING_MAPS === "true",
    );
  return result;
};
let checks = 0;
for (const [site, api, allowed] of [
  ["https://shop.rental.com", "https://api.rental.com", true],
  ["https://rental.com.do", "https://api.rental.com.do", true],
  ["https://rental.co.uk", "https://api.rental.co.uk", true],
  ["https://first.co.uk", "https://second.co.uk", false],
  ["https://first.com", "https://second.com", false],
  ["https://first.vercel.app", "https://second.vercel.app", true],
  ["https://first.github.io", "https://second.github.io", true],
  ["https://first.github.io", "https://api.first.github.io", true],
]) {
  const validate = () => assertSameSite(new URL(site), new URL(api));
  if (allowed) assert.doesNotThrow(validate);
  else assert.throws(validate, /do not share a registrable domain/);
  checks++;
}
for (const field of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_API_URL"]) {
  for (const value of [
    undefined,
    "",
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://127.1",
    "https://[::1]",
    "https://0x7f000001",
    "https://api.ci.invalid",
    "https://api.cibaura.example",
    "https://example.com",
    "https://sub.example.org",
    "https://api.local",
    "http://cibaura.com",
    "https://user:password@cibaura.com",
    "https://cibaura.com?secret=1",
    "https://cibaura.com#fragment",
    "https://replace-me.com",
  ]) {
    assert.throws(() => config({ ...base, [field]: value }), /\[config\]/);
    checks++;
  }
}
assert.throws(
  () =>
    config({ ...base, NEXT_PUBLIC_SITE_URL: "https://cibaura.com/subpath" }),
  /without a path/,
);
checks++;
for (const key of [
  undefined,
  "sk_live_notpublic",
  "pk_live_REPLACE_ME",
  "pk_test_ci_placeholder",
]) {
  assert.throws(
    () => config({ ...base, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: key }),
    /\[config\]/,
  );
  checks++;
}
assert.throws(
  () =>
    config({
      ...base,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_SyntheticValidationOnly",
    }),
  /TEST key/,
);
checks++;
const resolved = config({
  ...base,
  NEXT_PUBLIC_API_URL: "https://api.cibaura.com/api/",
  NEXT_PUBLIC_MEDIA_URL: "https://media.cibaura.com/public",
});
assert.equal(resolved.API_URL, "https://api.cibaura.com/api");
assert.equal(resolved.SITE_URL.href, "https://cibaura.com/");
assert.equal(resolved.MEDIA_URL.href, "https://media.cibaura.com/public/");
checks++;
assert.equal(
  config({ NODE_ENV: "development" }).API_URL,
  "http://localhost:4300/api",
);
checks++;
const media = load(
  "src/shared/config/media.ts",
  {},
  { "@/lib/config": resolved },
);
for (const [url, allowed] of [
  ["https://api.cibaura.com/api/cars/photos/123", true],
  ["https://api.cibaura.com/api/private/documents/123", false],
  ["https://media.cibaura.com/public/car.jpg?width=800", true],
  ["https://media.cibaura.com/private/car.jpg", false],
  ["https://media.cibaura.com.attacker.net/public/car.jpg", false],
  ["https://elsewhere.com/car.jpg", false],
]) {
  assert.equal(media.isOptimizableImage(url), allowed);
  checks++;
}
const { securityHeaders } = load("src/lib/security-headers.ts", {});
const policy = (maps, development) =>
  securityHeaders(new URL("https://api.policy.com"), maps, development)[0]
    .value;
assert(!policy(false, false).includes("'unsafe-eval'"));
checks++;
assert(policy(true, false).includes("'unsafe-eval'"));
checks++;
assert(policy(false, true).includes("'unsafe-eval'"));
checks++;
assert(
  policy(false, false).includes("connect-src 'self' https://api.policy.com"),
);
checks++;
assert(policy(true, false).includes("https://*.googleapis.com"));
checks++;
assert(policy(false, false).includes("https://hooks.stripe.com"));
checks++;
for (const field of [
  "NEXT_PUBLIC_LEGAL_COMPANY_NAME",
  "NEXT_PUBLIC_LEGAL_RNC",
  "NEXT_PUBLIC_LEGAL_ADDRESS",
  "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
]) {
  const flag = field.includes("LEGAL")
    ? "ALLOW_DEFAULT_LEGAL"
    : "ALLOW_MISSING_MAPS";
  for (const value of [undefined, "", "   "]) {
    assert.throws(() => config({ ...base, [field]: value }), /required/);
    checks++;
    assert.doesNotThrow(() =>
      config({ ...base, [field]: value, [flag]: "true" }),
    );
    checks++;
    assert.throws(
      () => config({ ...base, [field]: value, [flag]: "false" }),
      /required/,
    );
    checks++;
  }
}
for (const sha of [undefined, "", "main", "abc123", "g".repeat(40)]) {
  assert.throws(
    () => config({ ...base, NEXT_PUBLIC_BUILD_SHA: sha }),
    /40-hex/,
  );
  checks++;
}
console.log(
  `deploy-config: ${checks} checks passed (synthetic values, no build artifact)`,
);
