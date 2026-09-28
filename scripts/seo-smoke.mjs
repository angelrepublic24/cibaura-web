/**
 * CI-build SSR regression tests with SYNTHETIC contract fixtures.
 * This is NOT evidence of live inventory. No DB writes or backend startup.
 * Copies .next-ci/standalone (excluding its cache) to an OS temp directory: test responses
 * cannot contaminate the real build's data cache. Run after npm run build:ci:
 *   node scripts/seo-smoke.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
const root = process.cwd();
const apiUrl = new URL("https://api.ci.invalid");
const apiPrefix =
  apiUrl.pathname.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
const id = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const draftId = "55555555-5555-4555-8555-555555555555";
const pausedId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";
const city = {
  id: "city",
  countryId: "country",
  regionId: "region",
  slug: "fixture-city",
  name: "Fixture City",
};
const duplicateCities = [
  { ...city, id: "shared-do", slug: "shared-city", name: "Shared DO" },
  {
    ...city,
    id: "shared-us",
    countryId: "us",
    regionId: null,
    slug: "shared-city",
    name: "Shared US",
  },
];
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
  location: { city, region: null, countryCode: "DO" },
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
      data = [city, ...duplicateCities];
    else if (path === "/geo/countries")
      data = [
        { id: "country", code: "DO", name: "Fixture Country" },
        { id: "us", code: "US", name: "Other Country" },
      ];
    else if (path === "/geo/regions")
      data = [
        {
          id: "region",
          countryId: "country",
          slug: "fixture-region",
          name: "Fixture Region",
          kind: "province",
          code: null,
        },
      ];
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
    else if (path === `/cars/${draftId}`)
      data = { ...car, id: draftId, status: "draft" };
    else if (path === `/cars/${pausedId}`)
      data = { ...car, id: pausedId, status: "paused" };
    else if (path === "/cars/catalog") {
      assert(!url.searchParams.has("start") && !url.searchParams.has("end"));
      data = paginate([car]);
    } else if (path === "/cars/search") {
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
  await cp(join(root, ".next-ci/standalone"), dir, {
    recursive: true,
    filter: (source) => !source.includes(`${join(".next-ci", "cache")}`),
  });
  // Reserve a free local port, then hand it to the child.
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const reserved = reserve.address();
  assert.ok(reserved && typeof reserved === "object");
  const port = reserved.port;
  await new Promise((done) => reserve.close(done));
  const server = spawn(process.execPath, [join(dir, "server.js")], {
    cwd: dir,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_OPTIONS: `--require="${resolve("scripts/seo-fixture-fetch.cjs").replaceAll("\\", "/")}"`,
      SEO_SMOKE_SOURCE_ORIGIN: apiUrl.origin,
      SEO_SMOKE_FIXTURE_ORIGIN: `http://127.0.0.1:${address.port}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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
      const countryCatalog = await html("/cars/all?country=DO");
      check(
        text(countryCatalog).includes("Fixture Country"),
        "Country SSR uses API name",
      );
      check(
        /<p[^>]*>Fixture City(?:<!-- -->)?,(?:<!-- -->)? DO<\/p>/.test(
          visible(countryCatalog),
        ),
        "Nationwide cards show the car city and country",
      );
      check(
        visible(countryCatalog).includes(
          'rel="canonical" href="https://web.ci.invalid/cars/all?country=DO"',
        ),
        "Country has its own canonical",
      );
      const regionCatalog = await html(
        "/cars/all?country=DO&region=fixture-region&page=2",
      );
      check(
        text(regionCatalog).includes("Fixture Region, Fixture Country"),
        "Region SSR uses API names",
      );
      check(
        requests.some(
          (path) =>
            path.includes("/cars/catalog?") &&
            path.includes("country=DO") &&
            path.includes("region=fixture-region") &&
            path.includes("page=2"),
        ),
        "Region scope reaches paginated API request",
      );
      await html(
        "/cars/all?country=DO&region=fixture-region&from=2026-12-01&to=2026-12-03",
      );
      check(
        requests.some(
          (path) =>
            path.includes("/cars/search?") &&
            path.includes("country=DO") &&
            path.includes("region=fixture-region") &&
            path.includes("start=2026-12-01"),
        ),
        "Availability preserves country and region",
      );
      const scopedCity = await html(
        "/cars/fixture-city?country=DO&region=fixture-region",
      );
      check(
        visible(scopedCity).includes(
          'rel="canonical" href="https://web.ci.invalid/cars/fixture-city"',
        ),
        "Unique city keeps indexed canonical",
      );
      const collision = await html("/cars/shared-city?country=DO");
      check(
        visible(collision).includes(
          'rel="canonical" href="https://web.ci.invalid/cars/shared-city?country=DO"',
        ),
        "Colliding city keeps country in canonical",
      );
      check(
        (await fetch(base + "/cars/shared-city")).status === 404,
        "Ambiguous city never picks a country silently",
      );
      const directory = await html("/agencies");
      check(
        text(directory).includes(agency.name),
        "Agency name is in HTML outside scripts",
      );
      const profile = await html("/agencies/fixture-agency");
      check(
        visible(profile).includes('href="#agency-reviews"') &&
          visible(profile).indexOf("Toyota") <
            visible(profile).indexOf('id="agency-reviews"'),
        "Agency review anchor follows fleet, with rating link in header",
      );
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
      const beforeCity = requests.length;
      const cityHtml = await html("/cars/fixture-city");
      check(
        visible(cityHtml).includes("Toyota") &&
          visible(cityHtml).includes("Corolla"),
        "Date-free catalog cars are visible in SSR HTML",
      );
      check(
        text(cityHtml).includes("Fixture City") &&
          visible(cityHtml).includes('href="/agencies/fixture-agency"'),
        "Date-free city has real city name and internal agency links",
      );
      check(
        !requests
          .slice(beforeCity)
          .some((path) => path.startsWith(apiPrefix + "/cars/search")),
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
        paused.status === 200 &&
          schemas(pausedHtml).find((item) => item["@type"] === "Vehicle")
            ?.offers?.availability === "https://schema.org/OutOfStock",
        "Paused vehicle returns 200 with an OutOfStock offer",
      );
      check(
        visible(pausedHtml).includes("temporarily unavailable for booking"),
        "Paused vehicle visibly disables booking",
      );
      const draft = await fetch(
        `${base}/agencies/fixture-agency/cars/${draftId}`,
        { headers: { "User-Agent": "Twitterbot" } },
      );
      const draftHtml = await draft.text();
      check(
        draft.status === 404 &&
          !schemas(draftHtml).some((item) => item["@type"] === "Vehicle"),
        `Draft vehicle stays 404 without an offer (HTTP ${draft.status}, schemas ${schemas(
          draftHtml,
        )
          .map((item) => item["@type"])
          .join(",")})`,
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
    check(
      sitemap.includes("/cars/shared-city?country=DO") &&
        sitemap.includes("/cars/shared-city?country=US"),
      "Sitemap scopes colliding city URLs by country",
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
