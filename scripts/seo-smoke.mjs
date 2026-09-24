/**
 * Production-build SSR regression tests with SYNTHETIC contract fixtures.
 * This is NOT evidence of live inventory. No DB writes or backend startup.
 * Copies .next (excluding its cache) to an OS temp directory: test responses
 * cannot contaminate the real build's data cache. Run after npm run build:
 *   node scripts/seo-smoke.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cp, copyFile, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const root = process.cwd();
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4300",
);
const apiPrefix =
  apiUrl.pathname.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
const id = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const pausedId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";
const city = {
  id: "city",
  countryId: "country",
  slug: "fixture-city",
  name: "Fixture City",
};
const agency = {
  id: "agency",
  slug: "fixture-agency",
  name: "SEO Fixture Agency",
  kind: "business",
  description: "Synthetic SSR test data",
  verificationStatus: "verified",
  cities: [city],
  branches: [{ id: "branch", name: "Fixture Branch", city }],
  branchCount: 1,
  carCount: 2,
  ratingAvg: 4.5,
  reviewCount: 2,
  rentalConditions: "Test rental conditions",
  minDriverAge: 21,
  depositNote: null,
};
const emptyAgency = {
  ...agency,
  id: "empty",
  slug: "fixture-empty",
  name: "Unrated Fixture Agency",
  ratingAvg: 0,
  reviewCount: 0,
  carCount: 0,
};
const car = {
  id,
  branchId: "branch",
  agency,
  make: { id: "make", name: "Toyota" },
  model: { id: "model", name: "Corolla" },
  year: 2024,
  color: "white",
  transmission: "automatic",
  fuel: "gasoline",
  seats: 5,
  category: "sedan",
  pricePerDayCents: 8500,
  primaryPhoto: `/cars/photos/${photoId}`,
  photos: [`/cars/photos/${photoId}`],
  status: "active",
  branch: {
    id: "branch",
    name: "Fixture Branch",
    city,
    deliveryEnabled: false,
    deliveryBaseFeeCents: 0,
    deliveryPerKmCents: 0,
    deliveryMaxKm: null,
  },
  deliveryZones: [],
  depositCents: 10000,
};
const secondCar = {
  ...car,
  id: secondId,
  model: { id: "model-2", name: "RAV4" },
};
const review = {
  id: "review",
  rating: 5,
  comment: "Fixture review </script><script>unsafe</script>",
  reviewerName: "Fixture",
  createdAt: "2026-01-01T12:00:00.000Z",
};
const paginate = (items, total = items.length, page = 1, pageSize = 1) => ({
  items,
  total,
  page,
  pageSize,
});
const photo = await readFile(join(root, "public/brand/isotype.png"));
const logs = [];
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}

async function runScenario(partial) {
  const requests = [];
  const api = createServer((req, res) => {
    const url = new URL(req.url, "http://fixture.invalid");
    requests.push(url.pathname + url.search);
    const path = url.pathname.slice(apiPrefix.length);
    const page = Number(url.searchParams.get("page") || 1);
    let data;
    if (path === `/cars/photos/${photoId}`) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(photo);
      return;
    }
    if (path === "/agencies/available-cities" || path === "/geo/cities")
      data = [city];
    else if (path === "/agencies")
      data = paginate(page === 1 ? [agency] : [emptyAgency], 2, page);
    else if (path === "/agencies/fixture-agency") data = agency;
    else if (path === "/agencies/fixture-empty") data = emptyAgency;
    else if (path === "/agencies/fixture-agency/reviews")
      data = paginate([review], 2, page, 20);
    else if (
      path === "/agencies/fixture-empty/reviews" ||
      path === "/agencies/fixture-empty/cars"
    )
      data = paginate([], 0, page);
    else if (path === "/agencies/fixture-agency/cars") {
      if (partial && page === 2) {
        res.writeHead(429);
        res.end("fixture throttle");
        return;
      }
      data = paginate(page === 1 ? [car] : [secondCar], 2, page);
    } else if (path === `/cars/${id}`) data = car;
    else if (path === `/cars/${pausedId}`)
      data = { ...car, id: pausedId, status: "paused" };
    else if (path === "/cars/search") {
      if (!url.searchParams.has("start") || !url.searchParams.has("end")) {
        res.writeHead(400);
        res.end();
        return;
      }
      data = paginate([car]);
    } else {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address === "object");

  const dir = await mkdtemp(join(tmpdir(), "cibaura-seo-smoke-"));
  // Keep artifacts for inspection. No recursive deletion is performed.
  logs.push(`isolated build: ${dir}`);
  await cp(join(root, ".next"), join(dir, ".next"), {
    recursive: true,
    filter: (source) => source !== join(root, ".next/cache"),
  });
  await Promise.all([
    copyFile(join(root, "package.json"), join(dir, "package.json")),
    copyFile(join(root, "next.config.ts"), join(dir, "next.config.ts")),
    symlink(join(root, "node_modules"), join(dir, "node_modules"), "junction"),
  ]);
  // Reserve a free local port, then hand it to the child.
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const reserved = reserve.address();
  assert.ok(reserved && typeof reserved === "object");
  const port = reserved.port;
  await new Promise((done) => reserve.close(done));
  const server = spawn(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "start",
      dir,
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: dir,
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: "true",
        NODE_OPTIONS: `--require="${resolve("scripts/seo-fixture-fetch.cjs").replaceAll("\\", "/")}"`,
        SEO_SMOKE_SOURCE_ORIGIN: apiUrl.origin,
        SEO_SMOKE_FIXTURE_ORIGIN: `http://127.0.0.1:${address.port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk;
  });
  server.stderr.on("data", (chunk) => {
    output += chunk;
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        ready = (await fetch(base + "/robots.txt")).ok;
      } catch {
        /* Starting. */
      }
      if (ready) break;
      await new Promise((done) => setTimeout(done, 250));
    }
    check(ready, "Next production server starts");
    async function html(path) {
      const response = await fetch(base + path, {
        headers: { "User-Agent": "Twitterbot" },
      });
      const body = await response.text();
      check(
        response.ok,
        `${path} HTTP ${response.status}: ${body.slice(0, 100)}`,
      );
      return body;
    }
    function visible(body) {
      return body.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    }
    function text(body) {
      return visible(body).replace(/<[^>]*>/g, "");
    }
    function schemas(body) {
      return [
        ...body.matchAll(
          /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
        ),
      ].map((match) => JSON.parse(match[1]));
    }
    if (!partial) {
      const directory = await html("/agencies");
      check(
        text(directory).includes(agency.name),
        "Agency name is in HTML outside scripts",
      );
      const profile = await html("/agencies/fixture-agency");
      check(
        text(profile).includes(agency.name) &&
          text(profile).includes("Toyota Corolla"),
        "Agency profile and car grid are SSR",
      );
      const org = schemas(profile).find((item) =>
        item["@id"]?.endsWith("#agency"),
      );
      check(
        org?.aggregateRating?.reviewCount === 2 &&
          org.aggregateRating.ratingValue === 4.5,
        "Real contract aggregate values emitted",
      );
      check(
        org.review[0].reviewBody === review.comment &&
          !profile.includes("<script>unsafe</script>"),
        "Review script terminator escaped safely",
      );
      const detailPath = `/agencies/fixture-agency/cars/${id}`;
      const detail = await html(detailPath);
      check(
        text(detail).includes("Toyota Corolla 2024"),
        "Car name is in visible HTML, not only metadata or hydration data",
      );
      check(
        requests.filter((path) => path === `${apiPrefix}/cars/${id}`).length ===
          1,
        "Metadata and SSR reuse a single car fetch",
      );
      const vehicle = schemas(detail).find(
        (item) => item["@type"] === "Vehicle",
      );
      check(
        !vehicle.aggregateRating &&
          vehicle.offers.seller.aggregateRating.reviewCount === 2,
        "Agency rating stays on seller, never vehicle",
      );
      check(
        text(detail).includes("Reviews of") &&
          text(detail).includes(agency.name),
        "Agency review attribution is visible on car page",
      );
      const zero = schemas(await html("/agencies/fixture-empty")).find((item) =>
        item["@id"]?.endsWith("#agency"),
      );
      check(
        !zero.aggregateRating && !zero.review,
        "Zero-review entity omits all rating/review blocks",
      );
      const cityHtml = await html("/cars/fixture-city");
      check(
        text(cityHtml).includes("Fixture City") &&
          visible(cityHtml).includes('href="/agencies/fixture-agency"'),
        "Date-free city has real city name and internal agency links",
      );
      check(
        !requests.some((path) => path.startsWith(apiPrefix + "/cars/search")),
        "Date-free city never calls availability search",
      );
      const dated = await html(
        "/cars/fixture-city?from=2026-12-01&to=2026-12-03&make=toyota&price_min=12",
      );
      check(
        text(dated).includes("Toyota Corolla"),
        "Dated search has SSR car results",
      );
      check(
        requests.some(
          (path) =>
            path.includes("priceMinCents=1200") &&
            path.includes("start=2026-12-01"),
        ),
        "SSR shares client filter mapping and cents conversion",
      );
      check(
        detail.includes("/_next/image?") && detail.includes("srcSet="),
        "API photo has optimized responsive markup",
      );
      const photoUrl = new URL(
        apiPrefix + `/cars/photos/${photoId}`,
        apiUrl.origin,
      ).href;
      const optimized = await fetch(
        `${base}/_next/image?url=${encodeURIComponent(photoUrl)}&w=640&q=75`,
        { headers: { Accept: "image/webp" } },
      );
      check(
        optimized.ok &&
          optimized.headers.get("content-type")?.startsWith("image/"),
        "Image optimizer serves the public API photo",
      );
      const paused = await fetch(
        `${base}/agencies/fixture-agency/cars/${pausedId}`,
        { headers: { "User-Agent": "Twitterbot" } },
      );
      const pausedHtml = await paused.text();
      check(
        !schemas(pausedHtml).some((item) => item["@type"] === "Vehicle"),
        "Paused vehicle emits no rental offer",
      );
      logs.push(
        `FIXTURE HTML: ${visible(detail).match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0]}`,
      );
      logs.push(
        `FIXTURE HTML: ${visible(profile).match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0]}`,
      );
    }
    const sitemap = await html("/sitemap.xml");
    check(
      sitemap.includes(`/cars/${id}`),
      "Sitemap retains successfully loaded car pages",
    );
    check(
      partial
        ? !sitemap.includes(`/cars/${secondId}`)
        : sitemap.includes(`/cars/${secondId}`),
      "Full sitemap visits page 2; partial sitemap excludes failed page",
    );
    const before = requests.length;
    await html("/sitemap.xml");
    check(
      requests.length === before,
      "Sitemap result (including 429 fallback) is cached; no repeated API storm",
    );
    logs.push(
      `${partial ? "429 fallback" : "complete"} sitemap URLs: ${[...sitemap.matchAll(/<loc>/g)].length}`,
    );
  } catch (error) {
    console.error(output);
    throw error;
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, "exit").catch(() => {});
    }
    await new Promise((done) => api.close(done));
  }
}

await runScenario(false);
await runScenario(true);
console.log(logs.join("\n"));
console.log(
  `SEO fixture smoke: ${checks} checks passed. Live inventory verification remains separate.`,
);
