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
const base = {
  NODE_ENV: "production",
  NEXT_PUBLIC_API_URL: "https://api.cibaura.com",
  NEXT_PUBLIC_SITE_URL: "https://cibaura.com",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_SyntheticValidationOnly",
};
const config = (env) =>
  load("src/lib/config.ts", env, { "./public-url": urlHelpers });
let checks = 0;
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
console.log(
  `deploy-config: ${checks} checks passed (synthetic values, no build artifact)`,
);
