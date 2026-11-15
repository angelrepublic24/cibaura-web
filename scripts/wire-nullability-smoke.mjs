import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      const target = [base + ".ts", path.join(base, "index.ts")].find(existsSync);
      assert(target, `Missing schema dependency ${name}`);
      return load(target);
    },
  });
  return exports;
}

const agency = load("src/modules/agencies/schema/agencies.schema.ts");
const host = load("src/modules/agency/schema/agency.schema.ts");
const bookings = load("src/modules/bookings/schema/bookings.schema.ts");

// Canonical real-API cases that source fixtures previously failed to represent.
for (const schema of [agency.agencyPublicProfileWireSchema, host.agencyWireSchema]) {
  const identity = schema.pick({ description: true, logoUrl: true });
  assert.equal(identity.safeParse({ description: null, logoUrl: null }).success, true);
  assert.equal(identity.safeParse({ description: "Host", logoUrl: "https://media.invalid/logo.png" }).success, true);
  assert.equal(identity.safeParse({}).success, false);
}
const city = { id: "city", countryId: "country", name: "Santiago", slug: "santiago" };
assert.equal(agency.availableAgencyCityListWireSchema.safeParse([city]).success, true);
assert.equal(agency.availableAgencyCityListWireSchema.safeParse([{ ...city, countryId: undefined }]).success, false);
assert.equal(bookings.bookingPickupWireSchema.safeParse({ type: "branch_pickup", hostDeliveryFeeCents: 0 }).success, true);
assert.equal(bookings.bookingPickupWireSchema.safeParse({ type: "delivery", hostDeliveryFeeCents: 1000 }).success, true);
assert.equal(bookings.bookingPickupWireSchema.safeParse({ type: "branch_pickup", deliveryFeeCents: 0 }).success, false);
console.log("Wire nullability: 11 canonical response cases passed (public/host identities, compact city facets, pickup fee snapshots).");
