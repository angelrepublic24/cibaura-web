import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import ts from "typescript";

function load(file, modules, fetchImpl = fetch) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    exports,
    Response,
    AbortSignal,
    fetch: fetchImpl,
    require: (name) => {
      assert(name in modules);
      return modules[name];
    },
  });
  return exports;
}
let checks = 0;
for (const prefix of ["pk_live_", "pk_test_"]) {
  const key = `${prefix}DoNotExposeThisKey`;
  const route = load("src/app/health/route.ts", {
    "@/lib/config": {
      API_URL: "https://api.fixture.invalid/api",
      SITE_URL: new URL("https://site.fixture.invalid"),
      STRIPE_PUBLISHABLE_KEY: key,
      LEGAL_CONFIGURED: false,
      MAPS_CONFIGURED: false,
      BUILD_SHA: "a".repeat(40),
    },
    "@/lib/upstream-health": {
      probeUpstream: async () => ({
        ok: false,
        status: null,
        corsMatched: false,
      }),
    },
  });
  const response = await route.GET();
  const text = await response.text();
  assert(!text.includes(key));
  checks++;
  assert.equal(JSON.parse(text).baked.stripeKeyPrefix, prefix);
  checks++;
  assert.equal(response.status, 200);
  checks++;
}
const site = "https://site.fixture.invalid";
for (const [status, cors, ok] of [
  [200, site, true],
  [200, site + "/", false],
  [200, "*", false],
  [200, "", false],
  [503, site, false],
]) {
  const { probeUpstream } = load(
    "src/lib/upstream-health.ts",
    {},
    async (url, init) => {
      assert.equal(url, "https://api.fixture.invalid/api/health");
      assert.equal(init.headers.Origin, site);
      assert.equal(init.redirect, "error");
      return new Response("private response ignored", {
        status,
        headers: { "access-control-allow-origin": cors },
      });
    },
  );
  assert.equal(
    (await probeUpstream("https://api.fixture.invalid/api", site)).ok,
    ok,
  );
  checks++;
}
const { probeUpstream } = load("src/lib/upstream-health.ts", {}, async () => {
  throw new Error("secret upstream error");
});
assert.equal(
  JSON.stringify(await probeUpstream("unused", site)),
  '{"ok":false,"status":null,"corsMatched":false}',
);
checks++;

// Exercise optional build preflight with actual HTTP and exact Origin matching.
let corsSuffix = "";
const api = createServer((req, res) => {
  assert.equal(req.url, "/api/health");
  res.setHeader(
    "access-control-allow-origin",
    String(req.headers.origin) + corsSuffix,
  );
  res.end("ok");
});
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const address = api.address();
assert(address && typeof address !== "string");
try {
  for (const [suffix, expected] of [
    ["", 0],
    ["/", 1],
  ]) {
    corsSuffix = suffix;
    const child = spawn(process.execPath, ["scripts/verify-build-env.mjs"], {
      windowsHide: true,
      stdio: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${address.port}/api`,
        NEXT_PUBLIC_SITE_URL: site,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
        BUILD_ENV_PROBE_API: "true",
      },
    });
    child.stdout.resume();
    child.stderr.resume();
    const code = await new Promise((resolve) => child.on("exit", resolve));
    assert.equal(code, expected);
    checks++;
  }
} finally {
  api.close();
}
console.log(
  `Health/config: ${checks} checks passed (redaction, upstream status/CORS, real HTTP build probe).`,
);
