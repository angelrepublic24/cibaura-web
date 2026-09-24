import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

// Exercise the generated server unchanged. This is a CI artifact, not production data.
const dist = path.resolve(".next-ci");
const standalone = path.join(dist, "standalone");
await cp("public", path.join(standalone, "public"), { recursive: true });
await cp(path.join(dist, "static"), path.join(standalone, ".next-ci/static"), {
  recursive: true,
});
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const address = reservation.address();
assert(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve) => reservation.close(resolve));
const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
  cwd: standalone,
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (chunk) => {
  logs += chunk;
});
server.stderr.on("data", (chunk) => {
  logs += chunk;
});
const origin = `http://127.0.0.1:${port}`;
async function get(route) {
  const response = await fetch(origin + route, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, route);
  return response;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await get("/health");
      ready = true;
      break;
    } catch {
      await setTimeout(500);
    }
  }
  assert(ready, "standalone must become healthy");
  assert.deepEqual(await (await get("/health")).json(), { status: "ok" });
  await get("/brand/og.png");
  const optimized = await get("/_next/image?url=%2Fbrand%2Fog.png&w=640&q=75");
  assert.match(optimized.headers.get("content-type"), /^image\//);
  assert.match(
    await (await get("/robots.txt")).text(),
    /https:\/\/web\.ci\.invalid\/sitemap\.xml/,
  );
  const page = await get("/legal/privacy");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    page.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.match(page.headers.get("permissions-policy"), /microphone=\(\)/);
  assert.match(
    page.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.match(
    page.headers.get("content-security-policy"),
    /https:\/\/api\.ci\.invalid/,
  );
  const html = await page.text();
  assert.match(html, /https:\/\/web\.ci\.invalid\/legal\/privacy/);
  const chunks = await readdir(path.join(dist, "static/chunks"));
  const css = chunks.find((file) => file.endsWith(".css"));
  assert(css, "CSS bundle exists");
  await get(`/_next/static/chunks/${css}`);
  console.log(
    "Standalone: 6 HTTP checks + 5 security header checks passed. CI values only.",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill();
}
