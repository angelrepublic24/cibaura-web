/** Contract regressions against the real API adapter with a synthetic transport.
 * No authenticated API writes. Run: node scripts/platform-config-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
  });
  return exports;
}

const contract = load("src/features/admin/platform-config-contract.ts", {});
const policy = {
  freeCancellationHours: 48,
  lateCancellationRetentionPct: 20,
  earlyReturnPenaltyDays: 1,
};
let stored = { commissionPct: 15, cancellationPolicy: { ...policy } };
let flat = false;
let responseMode = "normal";
const calls = [];
const transport = {
  async get(path) {
    calls.push({ method: "GET", path });
    return {
      data: flat
        ? { commissionPct: stored.commissionPct, ...stored.cancellationPolicy }
        : stored,
    };
  },
  async patch(path, body) {
    calls.push({ method: "PATCH", path, body });
    if (responseMode === "http-error") throw new Error("HTTP 403");
    if (responseMode === "empty") return { data: {} };
    if (path === "/admin/config/commission") {
      if (responseMode !== "ignored") stored.commissionPct = body.commissionPct;
      return { data: { commissionPct: stored.commissionPct } };
    }
    assert.equal(path, "/admin/config/cancellation-policy");
    if (responseMode !== "ignored")
      stored.cancellationPolicy = { ...stored.cancellationPolicy, ...body };
    return { data: { ...stored.cancellationPolicy } };
  },
};
const { platformConfigApi: api } = load(
  "src/features/admin/platform-config-api.ts",
  {
    "@/shared/api/client": { Api: transport },
    "./platform-config-contract": contract,
  },
);
const plain = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

await test("Reads nested deployed GET without invented defaults", async () => {
  assert.deepEqual(plain(await api.getConfig()), stored);
});
await test("Reads announced flat GET through the same normalization", async () => {
  flat = true;
  assert.deepEqual(plain(await api.getConfig()), stored);
  flat = false;
});
await test("Rejects missing fields, wrong types and unknown-only configs", () => {
  for (const data of [
    {},
    { commissionPct: 15 },
    { commissionPct: "15", cancellationPolicy: policy },
    { defaultDepositCents: 20000 },
  ]) {
    assert.equal(contract.platformConfigSchema.safeParse(data).success, false);
  }
});
await test("Commission uses its existing endpoint and preserves policy", async () => {
  await api.updateCommission({ commissionPct: 12.5 });
  assert.deepEqual(plain(calls.at(-1)), {
    method: "PATCH",
    path: "/admin/config/commission",
    body: { commissionPct: 12.5 },
  });
  assert.deepEqual(stored.cancellationPolicy, policy);
});
await test("Partial policy save preserves other settings and accepts 30 days", async () => {
  await api.updateCancellationPolicy({ earlyReturnPenaltyDays: 30 });
  assert.deepEqual(plain(calls.at(-1)), {
    method: "PATCH",
    path: "/admin/config/cancellation-policy",
    body: { earlyReturnPenaltyDays: 30 },
  });
  assert.deepEqual(stored, {
    commissionPct: 12.5,
    cancellationPolicy: { ...policy, earlyReturnPenaltyDays: 30 },
  });
});
await test("Invalid policy is rejected before sending a request", async () => {
  const before = calls.length;
  await assert.rejects(
    api.updateCancellationPolicy({ earlyReturnPenaltyDays: 31 }),
  );
  assert.equal(calls.length, before);
});
await test("Ignored commission and policy values never report success", async () => {
  responseMode = "ignored";
  await assert.rejects(
    api.updateCommission({ commissionPct: 25 }),
    /did not confirm/,
  );
  await assert.rejects(
    api.updateCancellationPolicy({ freeCancellationHours: 72 }),
    /did not confirm/,
  );
});
await test("Empty 2xx response is unconfirmed for both saves", async () => {
  responseMode = "empty";
  await assert.rejects(
    api.updateCommission({ commissionPct: 25 }),
    /did not confirm/,
  );
  await assert.rejects(
    api.updateCancellationPolicy({ freeCancellationHours: 72 }),
    /did not confirm/,
  );
});
await test("HTTP failure stays an error; no fallback writes", async () => {
  responseMode = "http-error";
  const before = calls.length;
  await assert.rejects(api.updateCommission({ commissionPct: 25 }), /HTTP 403/);
  assert.equal(calls.length, before + 1);
});
await test("Forms retain 0..7 pending resolution of backend 0..30", () => {
  assert.equal(
    contract.commissionFormSchema.safeParse({ commissionPct: "" }).success,
    false,
  );
  assert.equal(
    contract.commissionFormSchema.safeParse({ commissionPct: "100.01" })
      .success,
    false,
  );
  assert.equal(
    contract.cancellationFormSchema.safeParse({
      freeCancellationHours: "48",
      lateCancellationRetentionPct: "20",
      earlyReturnPenaltyDays: "30",
    }).success,
    false,
  );
  assert.equal(
    contract.cancellationFormSchema.safeParse({
      freeCancellationHours: "48",
      lateCancellationRetentionPct: "20",
      earlyReturnPenaltyDays: "7",
    }).success,
    true,
  );
});
await test("Optional advance survives nested and flat normalization, including zero", () => {
  for (const value of [0, 40, 80]) {
    for (const data of [
      {
        commissionPct: 15,
        cancellationPolicy: policy,
        checkinAdvancePct: value,
      },
      { commissionPct: 15, ...policy, checkinAdvancePct: value },
    ])
      assert.equal(
        contract.platformConfigSchema.parse(data).checkinAdvancePct,
        value,
      );
  }
  assert.equal(
    contract.platformConfigSchema.parse({
      commissionPct: 15,
      cancellationPolicy: policy,
    }).checkinAdvancePct,
    undefined,
  );
});
await test("Advance remains validated and never leaks into supported PATCH bodies", async () => {
  assert.equal(
    contract.platformConfigSchema.safeParse({
      commissionPct: 15,
      ...policy,
      checkinAdvancePct: 81,
    }).success,
    false,
  );
  responseMode = "normal";
  await api.updateCommission({ commissionPct: 10, checkinAdvancePct: 40 });
  assert.equal(Object.hasOwn(calls.at(-1).body, "checkinAdvancePct"), false);
  await api.updateCancellationPolicy({
    freeCancellationHours: 24,
    checkinAdvancePct: 40,
  });
  assert.equal(Object.hasOwn(calls.at(-1).body, "checkinAdvancePct"), false);
});
await test("No request targets nonexistent PATCH /admin/config", () => {
  assert.equal(
    calls.some(
      ({ method, path }) => method === "PATCH" && path === "/admin/config",
    ),
    false,
  );
});
console.log(
  `platform-config: ${checks} contract checks passed (synthetic transport)`,
);
