import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { request } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

// Native Caddy test; no Docker daemon, public DNS or ACME certificates needed.
const stub = createServer((_req, response) => response.end("upstream-ok"));
await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
const upstream = stub.address();
assert(upstream && typeof upstream !== "string");
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const address = reservation.address();
assert(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve) => reservation.close(resolve));
const directory = await mkdtemp(path.join(tmpdir(), "web-edge-smoke-"));
const source = await readFile("Caddyfile", "utf8");
await writeFile(
  path.join(directory, "Caddyfile"),
  `{
  admin off
  auto_https disable_redirects
  skip_install_trust
}
${source.replace("reverse_proxy web:", "reverse_proxy 127.0.0.1:")}`,
);
const child = spawn(
  process.env.CADDY_BINARY || "caddy",
  [
    "run",
    "--config",
    path.join(directory, "Caddyfile"),
    "--adapter",
    "caddyfile",
  ],
  {
    env: {
      ...process.env,
      XDG_DATA_HOME: directory,
      XDG_CONFIG_HOME: directory,
      NEXT_PUBLIC_SITE_URL: `https://canonical.localhost:${port}`,
      WEB_REDIRECT_HOST: `alternate.localhost:${port}`,
      PORT: String(upstream.port),
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.on("error", (error) => {
  logs += error.message;
});
child.stdout.on("data", (data) => {
  logs += data;
});
child.stderr.on("data", (data) => {
  logs += data;
});
function get(host, route) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path: route,
        servername: host,
        headers: { host: `${host}:${port}` },
        rejectUnauthorized: false,
      },
      (response) => {
        let body = "";
        response.on("data", (data) => {
          body += data;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
      },
    );
    req.setTimeout(2000, () => req.destroy(new Error("edge timeout")));
    req.on("error", reject);
    req.end();
  });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await get("canonical.localhost", "/");
      ready = true;
      break;
    } catch {
      await setTimeout(250);
    }
  }
  assert(ready, logs);
  const canonical = await get("canonical.localhost", "/");
  assert.equal(canonical.status, 200);
  assert.equal(canonical.body, "upstream-ok");
  assert.equal(
    canonical.headers["strict-transport-security"],
    "max-age=31536000",
  );
  const alternate = await get("alternate.localhost", "/cars/city?q=a%20b&x=1");
  assert.equal(alternate.status, 301);
  assert.equal(
    alternate.headers.location,
    `https://canonical.localhost:${port}/cars/city?q=a%20b&x=1`,
  );
  assert.equal(
    alternate.headers["strict-transport-security"],
    "max-age=31536000",
  );
  console.log(
    "Edge: 6 checks passed (canonical upstream, HSTS, 301, path/query). Local test TLS only.",
  );
} finally {
  child.kill();
  stub.close();
}
