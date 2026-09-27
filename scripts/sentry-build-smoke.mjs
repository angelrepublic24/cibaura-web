/** Policy/plugin wiring only. No real token, uploads or Sentry project. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { withSentryConfig } from "@sentry/nextjs/config";
const exports = {};
runInNewContext(
  ts.transpileModule(readFileSync("src/lib/sentry-build.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports, console },
);
const { sentryBuildOptions } = exports;
const base = {
  NODE_ENV: "production",
  SENTRY_AUTH_TOKEN: "synthetic-token-never-uploaded",
  SENTRY_ORG: "synthetic-org",
  SENTRY_PROJECT: "synthetic-project",
  NEXT_PUBLIC_BUILD_SHA: "a".repeat(40),
};
let checks = 0;
for (const name of ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) {
  assert.throws(
    () => sentryBuildOptions({ ...base, [name]: "" }, true),
    new RegExp(name),
  );
  checks++;
  assert.throws(
    () => sentryBuildOptions({ ...base, [name]: "   " }, true),
    new RegExp(name),
  );
  checks++;
}
const configured = sentryBuildOptions(base, true);
assert.equal(configured.authToken, base.SENTRY_AUTH_TOKEN);
checks++;
assert.equal(configured.release.name, base.NEXT_PUBLIC_BUILD_SHA);
checks++;
assert.equal(configured.sourcemaps.disable, false);
checks++;
assert.equal(configured.sourcemaps.deleteSourcemapsAfterUpload, true);
checks++;
assert.throws(
  () => configured.errorHandler(new Error(base.SENTRY_AUTH_TOKEN)),
  /upload failed; build aborted/,
);
checks++;
for (const env of [
  { NODE_ENV: "development" },
  { NODE_ENV: "production", NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: "true" },
]) {
  const warnings = [];
  const options = sentryBuildOptions(env, true, (message) =>
    warnings.push(message),
  );
  assert.equal(options.sourcemaps.disable, true);
  checks++;
  assert.equal(options.authToken, undefined);
  checks++;
  assert.match(warnings.join(), /will NOT be uploaded/);
  checks++;
}
assert.equal(sentryBuildOptions({}, false).sourcemaps.disable, true);
checks++;
// Invoke the installed SDK wrapper, not an imitation. Never run its upload hook.
const next = withSentryConfig({ output: "standalone" }, configured);
assert.equal(typeof next.compiler.runAfterProductionCompile, "function");
checks++;
assert(!JSON.stringify(next).includes(base.SENTRY_AUTH_TOKEN));
checks++;
const docker = readFileSync("Dockerfile", "utf8");
assert.match(
  docker,
  /--mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN/,
);
checks++;
assert.doesNotMatch(docker, /(?:ARG|ENV) SENTRY_AUTH_TOKEN/);
checks++;
const compose = readFileSync("compose.yml", "utf8");
assert.match(compose, /environment: SENTRY_AUTH_TOKEN/);
checks++;
console.log(
  `Sentry build: ${checks} checks passed; actual upload/symbolication requires real credentials.`,
);
