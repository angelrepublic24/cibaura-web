/** Real helper, hooks and components; synthetic session/API values only. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, modules = {}, extra = "") {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8") + extra, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (name in modules) return modules[name];
        if (name === "react" || name === "react/jsx-runtime")
          return require(name);
        throw new Error(`Unmocked module ${name}`);
      },
    },
  );
  return exports;
}
const scopeHelpers = load("src/modules/agency/helpers/agency.helper.ts", {
  "@/modules/agency/schema/agency.schema": { AGENCY_PERMISSIONS: [] },
});
const { fleetForScope, occupancyForScope } = scopeHelpers;
const a = { id: "car-a", branchId: "a" };
const b = { id: "car-b", branchId: "b" };
const cars = [a, b, { id: "unassigned" }];
const entries = [a, b, { id: "unknown" }].map((c) => ({
  id: `block-${c.id}`,
  carId: c.id,
  source: "manual_block",
}));
const restricted = { mode: "branches", branchIds: ["a"] };
const all = { mode: "all", branchIds: [] };
let checks = 0;
for (const [scope, expectedCars, expectedEntries] of [
  [undefined, [], []],
  [restricted, ["car-a"], ["block-car-a"]],
  [{ mode: "branches", branchIds: [] }, [], []],
  [all, ["car-a", "car-b", "unassigned"], entries.map((e) => e.id)],
]) {
  assert.equal(
    JSON.stringify(fleetForScope(cars, scope).map((c) => c.id)),
    JSON.stringify(expectedCars),
  );
  checks++;
  assert.equal(
    JSON.stringify(occupancyForScope(entries, cars, scope).map((e) => e.id)),
    JSON.stringify(expectedEntries),
  );
  checks++;
}
assert.equal(occupancyForScope(entries, [], restricted).length, 0);
checks++;

/*
 * BUG-006: why a car in the agency's own fleet is not on its public page.
 * Mirrors `backend/src/modules/fleet/public-visibility.ts`, which ANDs three
 * switches — so this asserts each one alone, all of them together, and the
 * "unknown is not off" rule for the relations the fleet payload lacks.
 */
/** Cross-realm arrays (the helper runs in a VM context): compare serialised. */
const assertBlockers = (actual, expected, message) =>
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

const { storefrontBlockers } = scopeHelpers;
const verified = { verificationStatus: "verified" };
const activeBranch = { isActive: true };
assertBlockers(
  storefrontBlockers({
    car: { status: "active" },
    branch: activeBranch,
    agency: verified,
  }),
  [],
  "an active car on an active branch of a verified agency is public",
);
assertBlockers(
  storefrontBlockers({ car: { status: "draft" }, branch: activeBranch, agency: verified }),
  ["draft"],
);
assertBlockers(
  storefrontBlockers({ car: { status: "paused" }, branch: activeBranch, agency: verified }),
  ["paused"],
);
assertBlockers(
  storefrontBlockers({
    car: { status: "active" },
    branch: { isActive: false },
    agency: verified,
  }),
  ["branch_inactive"],
);
assertBlockers(
  storefrontBlockers({
    car: { status: "active" },
    branch: activeBranch,
    agency: { verificationStatus: "pending" },
  }),
  ["agency_unverified"],
);
// EVERY blocker, not the first: a host who fixes one of three and still sees
// nothing concludes the platform is broken.
assertBlockers(
  storefrontBlockers({
    car: { status: "draft" },
    branch: { isActive: false },
    agency: { verificationStatus: "suspended" },
  }),
  ["draft", "branch_inactive", "agency_unverified"],
);
// A relation the caller does not have is UNKNOWN, never reported as off.
assertBlockers(storefrontBlockers({ car: { status: "active" } }), []);
checks += 7;
let session = {
  data: { agency: { id: "agency" }, membership: { branchScope: restricted } },
};
let queryOptions;
const raw = {
  pageParams: [1, 2],
  pages: [
    { items: [b], page: 1, pageSize: 1, total: 2 },
    { items: [a], page: 2, pageSize: 1, total: 2 },
  ],
};
const hooks = load("src/modules/agency/hooks/agency.hook.ts", {
  react: { useCallback: (fn) => fn, useEffect: () => {} },
  "@tanstack/react-query": {
    useQuery: () => session,
    useMutation: () => ({}),
    useQueryClient: () => ({}),
    useInfiniteQuery: (options) => {
      queryOptions = options;
      return { data: options.select(raw), hasNextPage: false };
    },
  },
  "@/modules/agency/helpers/agency.helper": scopeHelpers,
  "@/modules/agency/services/agency.service": { agencyService: {} },
  "@/modules/bookings/hooks/bookings.hook": { bookingKeys: { detail: () => [] } },
  "@/shared/hooks/use-open-signed-url": { useOpenSignedUrl: () => ({}) },
  "@/shared/api/errors": { API_ERROR_CODES: {}, isApiErrorCode: () => false },
});
const paged = hooks.useFleetPages();
assert.equal(paged.data.pages[0].items.length, 0);
checks++;
assert.equal(queryOptions.getNextPageParam(paged.data.pages[0]), 2);
checks++;
assert.equal(paged.data.pages[1].items[0].id, "car-a");
checks++;
assert.equal(
  queryOptions.getNextPageParam({
    page: 1,
    pageSize: 100,
    total: 0,
    items: [],
  }),
  undefined,
);
checks++;
assert.equal(hooks.useAllFleet().cars.length, 1);
checks++;
const firstKey = JSON.stringify(queryOptions.queryKey);
session = {
  data: {
    agency: { id: "agency" },
    membership: { branchScope: { mode: "branches", branchIds: ["b"] } },
  },
};
assert.equal(hooks.useAllFleet().cars[0].id, "car-b");
checks++;
assert.notEqual(JSON.stringify(queryOptions.queryKey), firstKey);
checks++;
session = { isError: true };
assert.equal(hooks.useAllFleet().cars.length, 0);
checks++;
assert.equal(queryOptions.enabled, false);
checks++;

// Direct URL: render the real page through the real gate. Unauthorized/loading/error
// must not mount the child queries, not merely hide a navigation link.
let permission = { can: () => false };
let queries = 0;
const states = {
  EmptyState: ({ title }) => React.createElement("p", null, title),
  LoadingState: ({ label }) => React.createElement("p", null, label),
  ErrorState: ({ title }) => React.createElement("p", null, title),
};
const gate = load("src/modules/agency/components/permission-gate.tsx", {
  "@/modules/agency/hooks/agency.hook": { usePermission: () => permission },
  "@/modules/agency/helpers/agency.helper": {
    PERMISSION_LABELS: { "zones:manage": "Manage delivery zones" },
  },
  "@/shared/api/errors": { getErrorMessage: () => "Retry" },
  "@/shared/components/states": states,
});
const stub = ({ children }) => React.createElement("div", null, children);
const zones = load("src/app/agency/zones/page.tsx", {
  // The page reads through module hooks now; each one standing in for a
  // query still proves the gate mounts no read until it allows one.
  "@/modules/agency/hooks/agency.hook": {
    useAgencyBranches: () => {
      queries++;
      return { data: [] };
    },
    useAgencyZones: () => {
      queries++;
      return { data: [] };
    },
    useCreateZone: () => ({}),
    useDeleteZone: () => ({}),
  },
  "lucide-react": { Trash2: stub },
  "@/modules/agency/components/permission-gate": gate,
  "@/shared/utils/money": {},
  "@/shared/components/states": states,
  "@/shared/components/ui/button": { Button: stub },
  "@/shared/components/ui/card": { Card: stub, CardContent: stub },
  "@/shared/components/ui/input": { Input: stub },
  "@/shared/components/ui/label": { Label: stub },
  "@/shared/components/ui/select": {
    Select: ({ children, ...props }) =>
      React.createElement("select", props, children),
  },
});
for (const state of [
  { can: () => false },
  { can: () => true, isPending: true },
  { can: () => true, isError: true },
]) {
  permission = state;
  const html = renderToStaticMarkup(React.createElement(zones.default));
  assert(!html.includes("Select a branch to manage"));
  checks++;
  assert.equal(queries, 0);
  checks++;
}
permission = { can: (p) => p === "zones:manage" };
assert(
  renderToStaticMarkup(React.createElement(zones.default)).includes(
    "Select a branch to manage",
  ),
);
checks++;
assert.equal(queries, 1);
checks++;
// Calendar receives an overbroad response. Both grid and list must hide notes
// and entries of other branches, including unknown car IDs.
const dates = load("src/shared/utils/dates.ts");
const month = dates.currentMonth();
const calendarEntries = entries.map((entry, i) => ({
  ...entry,
  startDate: `${month}-02`,
  endDate: `${month}-04`,
  note: i === 0 ? "VISIBLE_NOTE" : "PRIVATE_OTHER_BRANCH",
}));
let fleet = { cars: [a], isLoading: false, isError: false };
let view = "month";
let stateIndex = 0;
let calendarOptions;
const ui = new Proxy({}, { get: () => stub });
const calendar = load(
  "src/app/agency/calendar/page.tsx",
  {
    react: {
      ...React,
      useState: (initial) => {
        const index = stateIndex++;
        return [index === 1 ? "car-b" : index === 2 ? view : initial, () => {}];
      },
    },
    "lucide-react": ui,
    "@/modules/agency/hooks/agency.hook": {
      useAllFleet: () => fleet,
      useAgencySession: () => ({
        data: {
          agency: { id: "agency" },
          membership: { branchScope: restricted },
        },
      }),
      // The month query lives in the hook now; this stand-in records the
      // (carId, month, enabled) the page asks for, which is what the scope
      // assertions below are about.
      useAgencyCalendar: (carId, month, enabled) => {
        calendarOptions = { queryKey: ["calendar", carId, month], enabled };
        return { data: calendarEntries };
      },
      useCreateManualBlock: () => ({}),
      useDeleteManualBlock: () => ({}),
      useInvalidateAgencyCalendar: () => () => {},
    },
    "@/shared/api/errors": {
      getApiErrorStatus: () => undefined,
      getErrorMessage: (_e, fallback) => fallback,
    },
    "@/modules/agency/helpers/agency.helper": scopeHelpers,
    "@/modules/agency/components/permission-gate": gate,
    "@/shared/utils/dates": dates,
    "@/shared/components/states": states,
    "@/shared/components/ui/badge": ui,
    "@/shared/components/ui/button": ui,
    "@/shared/components/ui/card": ui,
    "@/shared/components/ui/input": ui,
    "@/shared/components/ui/label": ui,
    "@/shared/components/ui/select": ui,
    "@/shared/components/ui/textarea": ui,
    "@/lib/utils": { cn: (...parts) => parts.filter(Boolean).join(" ") },
  },
  "\nexport { OccupancyCalendar };",
);
for (const mode of ["month", "list"]) {
  view = mode;
  stateIndex = 0;
  const html = renderToStaticMarkup(
    React.createElement(calendar.OccupancyCalendar),
  );
  assert(html.includes("VISIBLE_NOTE"));
  checks++;
  assert(!html.includes("PRIVATE_OTHER_BRANCH"));
  checks++;
  assert.equal(calendarOptions.queryKey[1], null);
  checks++; // stale car-b selection cleared
}
fleet = { cars: [], isLoading: false, isError: true };
stateIndex = 0;
const failed = renderToStaticMarkup(
  React.createElement(calendar.OccupancyCalendar),
);
assert(!failed.includes("VISIBLE_NOTE"));
checks++;
assert.equal(calendarOptions.enabled, false);
checks++;

// A filtered-empty first page must still expose pagination, without an agency-wide count.
let fleetPages = {
  data: { pages: [{ items: [], total: 999 }] },
  hasNextPage: true,
};
let fleetBranches = [];
// A real `Agency` always carries its verification status; `{}` would read as
// "present but not verified", which is a different fixture (asserted below).
let fleetAgency = { verificationStatus: "verified" };
const fleetPage = load(
  "src/app/agency/fleet/page.tsx",
  {
    "next/link": { default: stub },
    "lucide-react": ui,
    "@/modules/agency/hooks/agency.hook": {
      useAgencySession: () => ({ data: { agency: fleetAgency } }),
      useFleetPages: () => fleetPages,
      // Unrestricted for agency members; the fleet rows read it to say whether
      // a car's branch is deactivated (BUG-006).
      useAgencyBranches: () => ({ data: fleetBranches }),
      usePermission: () => ({ can: () => false, branchScope: restricted }),
    },
    // The REAL helper: `storefrontBlockers` mirrors the backend predicate, so
    // the stub would be the one thing worth exercising.
    "@/modules/agency/helpers/agency.helper": scopeHelpers,
    "@/shared/components/ui/input": ui,
    "@/shared/components/ui/label": ui,
    "@/modules/agency/components/car-registration-document": ui,
    "@/modules/agency/components/permission-gate": gate,
    // Rows render once there are cars loaded: the thumb falls back to the
    // placeholder, and the rate just has to be a string.
    "@/modules/cars/helpers/cars.helper": { carPhoto: () => null },
    "@/modules/cars/components/car-photo-placeholder": ui,
    "@/shared/utils/money": { formatMoneyCents: (cents) => `$${cents / 100}` },
    "@/shared/components/states": states,
    "@/shared/components/ui/badge": ui,
    "@/shared/components/ui/button": ui,
    "@/shared/components/ui/card": ui,
  },
  "\nexport { FleetList };",
);
const fleetHtml = renderToStaticMarkup(
  React.createElement(fleetPage.FleetList),
);
assert(fleetHtml.includes("Load more"));
checks++;
assert(!fleetHtml.includes("999"));
checks++;
// With nothing loaded there is nothing to search: a filter over an empty list
// is a control that cannot act (BUG-005).
assert(!fleetHtml.includes("Find a car"));
checks++;

/*
 * Rows loaded: the search box appears, and each row says whether the car is
 * on the public page — naming the switch that is off (BUG-005 / BUG-006).
 */
fleetBranches = [
  { id: "branch-live", isActive: true },
  { id: "branch-off", isActive: false },
];
const fleetCar = (id, status, branchId) => ({
  id,
  status,
  branchId,
  year: 2024,
  plate: `PLATE-${id}`,
  color: "white",
  transmission: "automatic",
  seats: 5,
  make: { id: "make", name: "Toyota" },
  model: { id: "model", name: "Corolla" },
  hostDailyRateCents: 4000,
  registration: null,
});
fleetPages = {
  data: {
    pages: [
      {
        items: [
          fleetCar("live", "active", "branch-live"),
          fleetCar("draft", "draft", "branch-live"),
          fleetCar("retired", "active", "branch-off"),
        ],
        total: 3,
      },
    ],
  },
  hasNextPage: false,
};
const loadedHtml = renderToStaticMarkup(
  React.createElement(fleetPage.FleetList),
);
assert(loadedHtml.includes("Find a car"), "the fleet search box renders");
checks++;
assert(loadedHtml.includes("Live on your public page"));
checks++;
assert(loadedHtml.includes("still a draft"));
checks++;
assert(loadedHtml.includes("its branch is deactivated"));
checks++;

// A pending or suspended agency has NO storefront at all, so every row says
// so — the fourth of the four reasons a host can hit.
fleetAgency = { verificationStatus: "pending" };
const unverifiedHtml = renderToStaticMarkup(
  React.createElement(fleetPage.FleetList),
);
assert(!unverifiedHtml.includes("Live on your public page"));
assert.equal(
  (unverifiedHtml.match(/your agency is not verified yet/g) ?? []).length,
  3,
);
checks++;
fleetAgency = { verificationStatus: "verified" };
console.log(
  `Branch scope: ${checks} checks passed (synthetic data; backend authorization remains mandatory).`,
);
