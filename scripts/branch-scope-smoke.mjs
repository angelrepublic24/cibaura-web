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
const scopeHelpers = load("src/features/agency/branch-scope.ts");
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
const hooks = load("src/features/agency/hooks.ts", {
  react: { useEffect: () => {} },
  "@tanstack/react-query": {
    useQuery: () => session,
    useInfiniteQuery: (options) => {
      queryOptions = options;
      return { data: options.select(raw), hasNextPage: false };
    },
  },
  "./branch-scope": scopeHelpers,
  "./api": {
    AgencyApi: {},
    agencyKeys: {
      session: () => ["session"],
      fleetPages: (filters) => ["agency", "fleet", "pages", filters],
    },
  },
  "@/features/bookings/api": {},
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
const gate = load("src/features/agency/components/permission-gate.tsx", {
  "@/features/agency/use-permission": { usePermission: () => permission },
  "@/features/agency/rbac": {
    PERMISSION_LABELS: { "zones:manage": "Manage delivery zones" },
  },
  "@/shared/api/errors": { getErrorMessage: () => "Retry" },
  "@/shared/components/states": states,
});
const stub = ({ children }) => React.createElement("div", null, children);
const zones = load("src/app/agency/zones/page.tsx", {
  "@tanstack/react-query": {
    useQuery: () => {
      queries++;
      return { data: [] };
    },
  },
  "lucide-react": { Trash2: stub },
  "@/features/agency/api": {
    AgencyApi: {},
    agencyKeys: { branches: () => ["branches"] },
  },
  "@/features/agency/components/permission-gate": gate,
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
    "@tanstack/react-query": {
      useQueryClient: () => ({}),
      useMutation: () => ({}),
      useQuery: (options) => {
        calendarOptions = options;
        return { data: calendarEntries };
      },
    },
    "lucide-react": ui,
    "@/features/agency/api": {
      AgencyApi: {},
      agencyKeys: { calendar: (carId, month) => ["calendar", carId, month] },
    },
    "@/features/agency/hooks": {
      useAllFleet: () => fleet,
      useAgencySession: () => ({
        data: {
          agency: { id: "agency" },
          membership: { branchScope: restricted },
        },
      }),
    },
    "@/features/agency/branch-scope": scopeHelpers,
    "@/features/agency/components/permission-gate": gate,
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
const fleetPage = load(
  "src/app/agency/fleet/page.tsx",
  {
    "next/link": { default: stub },
    "lucide-react": ui,
    "@/features/agency/hooks": {
      useAgencySession: () => ({ data: { agency: {} } }),
      useFleetPages: () => ({
        data: { pages: [{ items: [], total: 999 }] },
        hasNextPage: true,
      }),
    },
    "@/features/agency/components/car-registration-document": ui,
    "@/features/agency/components/permission-gate": gate,
    "@/features/agency/use-permission": {
      usePermission: () => ({ can: () => false, branchScope: restricted }),
    },
    "@/features/cars/photos": {},
    "@/features/cars/components/car-photo-placeholder": ui,
    "@/shared/utils/money": {},
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
console.log(
  `Branch scope: ${checks} checks passed (synthetic data; backend authorization remains mandatory).`,
);
