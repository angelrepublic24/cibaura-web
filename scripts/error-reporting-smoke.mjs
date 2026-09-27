/** Synthetic exceptions and in-memory transport only; never a real Sentry project. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const Sentry = createRequire(import.meta.url)("@sentry/nextjs");

function load(file, modules) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert(name in modules, name);
      return modules[name];
    },
  });
  return exports;
}
const config = {
  BUILD_SHA: "a".repeat(40),
  SENTRY_DSN:
    "https://0123456789abcdef0123456789abcdef@o123.ingest.sentry.io/123",
  STRIPE_PUBLISHABLE_KEY: "pk_test_SyntheticOnly",
};
const { sentryOptions, sanitizeErrorEvent } = load(
  "src/lib/sentry-options.ts",
  { "./config": config },
);
let checks = 0;
// Real prebuild entrypoint: no artifact or network, only synthetic configuration.
const buildEnv = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_API_URL: "https://api.cibaura.com",
  NEXT_PUBLIC_SITE_URL: "https://cibaura.com",
  NEXT_PUBLIC_MEDIA_URL: "",
  NEXT_PUBLIC_BUILD_SHA: "a".repeat(40),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_SyntheticOnly",
  NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "synthetic-only",
  NEXT_PUBLIC_LEGAL_COMPANY_NAME: "Synthetic Only",
  NEXT_PUBLIC_LEGAL_RNC: "synthetic-only",
  NEXT_PUBLIC_LEGAL_ADDRESS: "Synthetic Only",
  NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: "synthetic@fixture.invalid",
  BUILD_ENV_PROBE_API: "false",
};
const denied = spawnSync(process.execPath, ["scripts/verify-build-env.mjs"], {
  env: buildEnv,
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(denied.status, 1);
checks++;
assert(denied.stderr.includes("NEXT_PUBLIC_SENTRY_DSN is required"));
checks++;
const staging = spawnSync(process.execPath, ["scripts/verify-build-env.mjs"], {
  env: {
    ...buildEnv,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_SyntheticOnly",
    NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: "true",
  },
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(staging.status, 0, staging.stderr);
checks++;
assert(staging.stderr.includes("will NOT report errors"));
checks++;
const cleaned = sanitizeErrorEvent({
  exception: {
    values: [
      {
        value: "original diagnostic",
        stacktrace: { frames: [{ filename: "app.js", lineno: 42 }] },
      },
    ],
  },
  user: { email: "private@fixture.invalid" },
  breadcrumbs: [{ message: "private" }],
  extra: { token: "private" },
  request: {
    url: "https://web.fixture.invalid/page?token=private#private",
    method: "GET",
    headers: { Cookie: "private" },
    data: "private",
  },
});
assert(!JSON.stringify(cleaned).includes("private"));
checks++;
assert.equal(cleaned.exception.values[0].stacktrace.frames[0].lineno, 42);
checks++;

const envelopes = [];
Sentry.init({
  ...sentryOptions,
  defaultIntegrations: false,
  transport: () => ({
    send: async (envelope) => {
      envelopes.push(envelope);
      return { statusCode: 200 };
    },
    flush: async () => true,
  }),
});
Sentry.captureException(new Error("Synthetic reporting smoke"));
assert(await Sentry.flush(2000));
checks++;
const payload = JSON.stringify(envelopes);
assert(payload.includes("Synthetic reporting smoke"));
checks++;
assert(payload.includes(config.BUILD_SHA));
checks++;
await Sentry.close(2000);

for (const file of ["src/app/error.tsx", "src/app/global-error.tsx"]) {
  const error = new Error("Internal database password must not reach UI");
  let captured;
  let retries = 0;
  const effects = [];
  const component = load(file, {
    react: { ...React, useEffect: (callback) => effects.push(callback) },
    "react/jsx-runtime": jsx,
    "@sentry/nextjs": {
      captureException: (value) => {
        captured = value;
      },
    },
    "@/shared/components/states": {
      ErrorState: ({ title, message, onRetry }) =>
        React.createElement(
          "section",
          null,
          title,
          message,
          React.createElement("button", { onClick: onRetry }, "Try again"),
        ),
    },
  }).default;
  const tree = component({
    error,
    reset: () => {
      retries++;
    },
  });
  effects.forEach((effect) => effect());
  assert.equal(captured, error);
  checks++;
  const html = renderToStaticMarkup(tree);
  assert(!html.includes(error.message));
  checks++;
  assert(html.includes("Try again"));
  checks++;
  // Follow the rendered element tree to exercise the actual reset callback.
  function click(node) {
    if (!React.isValidElement(node)) return;
    if (node.props.onRetry) node.props.onRetry();
    if (node.type === "button") node.props.onClick();
    React.Children.forEach(node.props.children, click);
  }
  click(tree);
  assert.equal(retries, 1);
  checks++;
  if (file.includes("global-error")) {
    assert(html.includes('<html lang="en">'));
    checks++;
  }
}
console.log(
  `Error reporting: ${checks} checks passed (SDK in-memory transport, no real delivery claimed).`,
);
