/** Contract regressions against the real API adapter with a synthetic transport.
 * No authenticated API writes. Run: node scripts/platform-config-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, dependencies, jsx = false) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    console,
    require: (name) => dependencies[name] ?? require(name),
  });
  return exports;
}

const contract = load("src/features/admin/platform-config-contract.ts", {
  "@/shared/utils/money": {
    wholeUnitsToCents: (units) => Math.round(units * 100),
  },
});

/** Every one of the fifteen settings, at its backend default. */
const DEFAULTS = {
  commissionPct: 15,
  freeCancellationHours: 48,
  lateCancellationRetentionPct: 20,
  earlyReturnPenaltyDays: 1,
  disputeWindowHours: 48,
  claimResponseHours: 48,
  defaultDepositCents: 20_000,
  taxRatePct: 0,
  taxBase: "commission",
  checkinAdvancePct: 0,
  depositReauthLeadHours: 24,
  inspectionsRequired: true,
  inspectionMinPhotos: 4,
  inspectionMediaRetentionMonths: 12,
  stripePayoutsEnabled: false,
};

let stored = { ...DEFAULTS };
let responseMode = "normal";
const calls = [];
const transport = {
  async get(path) {
    calls.push({ method: "GET", path });
    return { data: { ...stored } };
  },
  async patch(path, body) {
    calls.push({ method: "PATCH", path, body });
    if (responseMode === "http-error") throw new Error("HTTP 403");
    if (responseMode === "empty") return { data: {} };
    assert.equal(path, "/admin/config");
    if (responseMode !== "ignored") stored = { ...stored, ...body };
    // The real endpoint always answers with the COMPLETE config.
    return { data: { ...stored } };
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

await test("Reads the flat fifteen-setting config", async () => {
  assert.deepEqual(plain(await api.getConfig()), DEFAULTS);
  assert.equal(Object.keys(DEFAULTS).length, 15);
});

await test("Rejects a config missing any setting, or with a wrong type", () => {
  assert.equal(contract.platformConfigSchema.safeParse({}).success, false);
  for (const field of Object.keys(DEFAULTS)) {
    const rest = Object.fromEntries(
      Object.entries(DEFAULTS).filter(([key]) => key !== field),
    );
    assert.equal(
      contract.platformConfigSchema.safeParse(rest).success,
      false,
      `${field} must be required`,
    );
  }
  for (const wrong of [
    { ...DEFAULTS, commissionPct: "15" },
    { ...DEFAULTS, inspectionsRequired: "true" },
    { ...DEFAULTS, taxBase: "profit" },
  ]) {
    assert.equal(contract.platformConfigSchema.safeParse(wrong).success, false);
  }
});

await test("Read accepts a stored value the console cannot write", () => {
  // DEFAULT_COMMISSION_PCT=15.125 passes the backend's env check (0..100, no
  // decimal cap) and lands here. The console must still load.
  assert.equal(
    contract.platformConfigSchema.safeParse({
      ...DEFAULTS,
      commissionPct: 15.125,
    }).success,
    true,
  );
  // ...while the FORM still refuses to write three decimals, which is what
  // `patchConfig` enforces.
  assert.equal(
    contract.platformConfigFormSchema.shape.commissionPct.safeParse("15.125")
      .success,
    false,
  );
  assert.equal(
    contract.platformConfigFormSchema.shape.commissionPct.safeParse("15.12")
      .success,
    true,
  );
});

await test("Form bounds mirror the server, not the old console", () => {
  const field = (name) => contract.platformConfigFormSchema.shape[name];
  const accepts = (name, value) => field(name).safeParse(value).success;
  // The bound that started this: the API has always taken 30.
  assert.equal(accepts("earlyReturnPenaltyDays", "30"), true);
  assert.equal(accepts("earlyReturnPenaltyDays", "31"), false);
  // Three settings have a non-zero minimum; a 0 default would be rejected.
  assert.equal(accepts("claimResponseHours", "11"), false);
  assert.equal(accepts("claimResponseHours", "12"), true);
  assert.equal(accepts("depositReauthLeadHours", "5"), false);
  assert.equal(accepts("depositReauthLeadHours", "6"), true);
  assert.equal(accepts("inspectionMediaRetentionMonths", "2"), false);
  assert.equal(accepts("inspectionMediaRetentionMonths", "3"), true);
  // The rest of the ranges.
  assert.equal(accepts("commissionPct", "100.01"), false);
  assert.equal(accepts("taxRatePct", "50"), true);
  assert.equal(accepts("taxRatePct", "50.01"), false);
  assert.equal(accepts("disputeWindowHours", "168"), true);
  assert.equal(accepts("disputeWindowHours", "169"), false);
  assert.equal(accepts("checkinAdvancePct", "80"), true);
  assert.equal(accepts("checkinAdvancePct", "81"), false);
  assert.equal(accepts("inspectionMinPhotos", "30"), true);
  assert.equal(accepts("inspectionMinPhotos", "31"), false);
  assert.equal(accepts("freeCancellationHours", "720"), true);
  assert.equal(accepts("lateCancellationRetentionPct", "101"), false);
  // Blank and non-numeric never pass as zero.
  for (const value of ["", "   ", "abc", "-1", "1e3"]) {
    assert.equal(accepts("disputeWindowHours", value), false);
  }
  // The deposit is typed in whole units and bounded in cents.
  assert.equal(accepts("defaultDepositUnits", "5000"), true);
  assert.equal(accepts("defaultDepositUnits", "5000.01"), false);
  assert.equal(accepts("defaultDepositUnits", "200.50"), true);
  assert.equal(accepts("defaultDepositUnits", "200.505"), false);
});

await test("Every limit matches the backend table", () => {
  // Mirrored from backend PLATFORM_CONFIG_LIMITS; drift here is the bug class
  // that left eleven settings editable only in psql.
  assert.deepEqual(plain(contract.PLATFORM_CONFIG_LIMITS), {
    commissionPct: { min: 0, max: 100, decimals: 2 },
    freeCancellationHours: { min: 0, max: 720 },
    lateCancellationRetentionPct: { min: 0, max: 100 },
    earlyReturnPenaltyDays: { min: 0, max: 30 },
    disputeWindowHours: { min: 0, max: 168 },
    claimResponseHours: { min: 12, max: 168 },
    defaultDepositCents: { min: 0, max: 500000 },
    taxRatePct: { min: 0, max: 50, decimals: 2 },
    checkinAdvancePct: { min: 0, max: 80 },
    depositReauthLeadHours: { min: 6, max: 72 },
    inspectionMinPhotos: { min: 0, max: 30 },
    inspectionMediaRetentionMonths: { min: 3, max: 60 },
  });
});

await test("Seeding and diffing round-trip through the form", () => {
  const values = contract.configToFormValues({
    ...DEFAULTS,
    defaultDepositCents: 20_050,
  });
  assert.equal(values.defaultDepositUnits, "200.5");
  assert.equal(values.inspectionsRequired, true);
  assert.equal(values.taxBase, "commission");
  assert.equal(
    contract.platformConfigFormSchema.safeParse(values).success,
    true,
  );
  // Nothing touched → nothing sent.
  assert.deepEqual(plain(contract.formValuesToPatch(values, {})), {});
  // Only the dirty fields travel, in wire units.
  assert.deepEqual(
    plain(
      contract.formValuesToPatch(
        { ...values, defaultDepositUnits: "350", disputeWindowHours: "72" },
        { defaultDepositUnits: true, disputeWindowHours: true },
      ),
    ),
    { defaultDepositCents: 35_000, disputeWindowHours: 72 },
  );
  // Booleans and the enum survive the diff, including turning one OFF.
  assert.deepEqual(
    plain(
      contract.formValuesToPatch(
        { ...values, inspectionsRequired: false, taxBase: "subtotal" },
        { inspectionsRequired: true, taxBase: true },
      ),
    ),
    { inspectionsRequired: false, taxBase: "subtotal" },
  );
});

await test("One PATCH carries the whole diff to /admin/config", async () => {
  responseMode = "normal";
  const next = await api.updateConfig({
    disputeWindowHours: 72,
    earlyReturnPenaltyDays: 30,
    taxBase: "subtotal",
    stripePayoutsEnabled: true,
  });
  assert.deepEqual(plain(calls.at(-1)), {
    method: "PATCH",
    path: "/admin/config",
    body: {
      disputeWindowHours: 72,
      earlyReturnPenaltyDays: 30,
      taxBase: "subtotal",
      stripePayoutsEnabled: true,
    },
  });
  // The response is the complete config, and untouched settings are intact.
  assert.equal(Object.keys(next).length, 15);
  assert.equal(next.commissionPct, DEFAULTS.commissionPct);
  assert.equal(next.disputeWindowHours, 72);
  assert.equal(next.stripePayoutsEnabled, true);
});

await test("Unknown fields never reach the wire", async () => {
  await api.updateConfig({ disputeWindowHours: 24, notASetting: 1 });
  assert.equal(Object.hasOwn(calls.at(-1).body, "notASetting"), false);
  assert.equal(calls.at(-1).body.disputeWindowHours, 24);
});

await test("A value the server ignored never reports success", async () => {
  responseMode = "ignored";
  await assert.rejects(
    api.updateConfig({ disputeWindowHours: 96 }),
    /did not confirm/,
  );
});

await test("An empty 2xx body is unsupported, not success", async () => {
  responseMode = "empty";
  await assert.rejects(
    api.updateConfig({ disputeWindowHours: 96 }),
    /unsupported configuration/,
  );
});

await test("HTTP failure stays an error; nothing is written", async () => {
  responseMode = "http-error";
  const before = calls.length;
  await assert.rejects(api.updateConfig({ commissionPct: 25 }), /HTTP 403/);
  assert.equal(calls.length, before + 1);
});

await test("No request targets the superseded single-purpose routes", () => {
  assert.equal(
    calls.some(({ path }) => path.startsWith("/admin/config/")),
    false,
  );
});

await test("The console renders an input for every one of the fifteen", () => {
  // The regression this guards: the form used to expose four settings while
  // the contract described more, and nothing failed when they diverged.
  const cn = (...values) =>
    values
      .flat(Infinity)
      .filter((value) => typeof value === "string")
      .join(" ");
  const ui = (file) =>
    load(`src/shared/components/ui/${file}.tsx`, { "@/lib/utils": { cn } }, true);
  const { PlatformConfigForm } = load(
    "src/features/admin/components/platform-config-form.tsx",
    {
      "@/features/admin/api": {
        AdminApi: { updateConfig: async () => ({}) },
        adminKeys: { config: () => ["admin", "config"] },
      },
      "@/features/admin/platform-config-contract": contract,
      "@/features/legal/api": { legalKeys: { all: ["legal"] } },
      "@/shared/api/errors": { getErrorMessage: (_error, fallback) => fallback },
      "@/lib/utils": { cn },
      "@hookform/resolvers/zod": { zodResolver: () => undefined },
      "react-hook-form": {
        useForm: () => ({
          register: (name) => ({ name }),
          handleSubmit: () => () => {},
          reset: () => {},
          formState: { errors: {}, dirtyFields: {}, isDirty: false },
        }),
      },
      "@tanstack/react-query": {
        useQueryClient: () => ({ setQueryData: () => {}, invalidateQueries: () => {} }),
        useMutation: () => ({ isPending: false, error: null, mutate: () => {}, reset: () => {} }),
      },
      "@/shared/components/ui/button": ui("button"),
      "@/shared/components/ui/card": ui("card"),
      "@/shared/components/ui/input": ui("input"),
      "@/shared/components/ui/label": ui("label"),
      "@/shared/components/ui/select": ui("select"),
    },
    true,
  );
  const html = renderToStaticMarkup(
    React.createElement(PlatformConfigForm, { config: DEFAULTS }),
  );
  const rendered = new Set(
    [...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]),
  );
  const fields = Object.keys(contract.platformConfigFormSchema.shape);
  assert.equal(fields.length, 15);
  for (const field of fields) {
    assert.ok(rendered.has(field), `${field} has no input in the console`);
  }
  // The bounds the old console could not express are on screen.
  for (const hint of ["0 – 30", "12 – 168", "6 – 72", "3 – 60"]) {
    assert.ok(html.includes(hint), `the ${hint} range is not shown`);
  }
  // The tax defect warning is rendered, after the field it warns about.
  assert.ok(html.includes("Open defect"), "tax warning missing");
  assert.ok(
    html.indexOf("Tax rate") < html.indexOf("Open defect"),
    "tax warning must sit with the field",
  );
  for (const base of ["commission", "subtotal", "total"]) {
    assert.ok(html.includes(`value="${base}"`), `${base} is not selectable`);
  }
});

console.log(
  `platform-config: ${checks} contract checks passed (synthetic transport)`,
);
