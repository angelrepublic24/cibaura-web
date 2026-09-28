// Destination interactions with catalog fixtures and the actual shared date picker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const countries = [
  { id: "do", code: "DO", name: "Dominican Republic" },
  { id: "us", code: "US", name: "United States" },
];
const cities = [
  { id: "sd", countryId: "do", slug: "santo-domingo", name: "Santo Domingo" },
  { id: "mi", countryId: "us", slug: "miami", name: "Miami" },
];
let states = [],
  index = 0,
  countryData = countries,
  cityValue = "";
const react = {
  ...require("react"),
  useState: (initial) => {
    const slot = index++;
    if (!(slot in states))
      states[slot] = typeof initial === "function" ? initial() : initial;
    return [
      states[slot],
      (value) => {
        states[slot] =
          typeof value === "function" ? value(states[slot]) : value;
      },
    ];
  },
  useMemo: (factory) => factory(),
};
function load(file, modules = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      URLSearchParams,
      document: { getElementById: () => ({ focus: () => {} }) },
      require: (name) =>
        name in modules
          ? modules[name]
          : name === "react"
            ? react
            : name === "react/jsx-runtime"
              ? require(name)
              : new Proxy({}, { get: () => "stub" }),
    },
  );
  return exports;
}
const destinations = load("src/features/cars/destinations.ts");
assert(destinations.hasUniqueCitySlug(cities[0], cities));
assert(
  !destinations.hasUniqueCitySlug(cities[0], [
    ...cities,
    { ...cities[0], id: "duplicate" },
  ]),
);
const { DestinationFields } = load(
  "src/features/cars/components/destination-fields.tsx",
  {
    "../destinations": destinations,
    "@tanstack/react-query": {
      useQuery: ({ queryKey }) => ({
        data: queryKey[1] === "countries" ? countryData : cities,
      }),
    },
  },
);
const render = () => {
  index = 0;
  return DestinationFields({
    city: cityValue,
    onCityChange: (value) => {
      cityValue = value;
    },
  });
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[].concat(tree.props?.children ?? []).flatMap(nodes)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
let tree = render();
find(tree, (node) => node.props?.id === "hero-country").props.onChange({
  target: { value: "do" },
});
tree = render();
assert(
  nodes(tree).some(
    (node) => node.type === "option" && node.props.value === "santo-domingo",
  ),
);
assert(
  !nodes(tree).some(
    (node) => node.type === "option" && node.props.value === "miami",
  ),
);
cityValue = "santo-domingo";
find(tree, (node) => node.props?.id === "hero-country").props.onChange({
  target: { value: "us" },
});
assert.equal(cityValue, "", "country change clears city");
countryData = [countries[0]];
states = [];
tree = render();
assert.equal(
  find(tree, (node) => node.props?.id === "hero-country").props.readOnly,
  true,
);
const params = load("src/features/cars/request-params.ts", {
  "@/shared/utils/money": { wholeUnitsToCents: (value) => value * 100 },
});
const catalog = params.carCatalogParams("santo-domingo", {
  from: "2026-12-01",
  to: "2026-12-03",
  priceMin: 10,
});
assert.equal(catalog.city, "santo-domingo");
assert.equal(catalog.priceMinCents, 1000);
assert(!("start" in catalog) && !("end" in catalog));
// The actual homepage uses the shared picker, not native date inputs.
const dates = load("src/shared/utils/dates.ts");
const picker = load("src/shared/components/date-range-picker.tsx", {
  "@/shared/utils/dates": dates,
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
});
const filters = load("src/features/cars/filters.ts", {
  "@/shared/utils/dates": dates,
});
let navigation;
const { HeroSearch } = load("src/features/cars/components/hero-search.tsx", {
  "next/navigation": {
    useRouter: () => ({
      push: (url) => {
        navigation = url;
      },
    }),
  },
  "@/features/cars/filters": filters,
  "@/shared/utils/dates": { ...dates, todayIso: () => "2026-09-27" },
  "@/shared/types/domain": { CAR_CATEGORIES: [] },
  "@/lib/utils": { cn: (...values) => values.join(" ") },
  "@/shared/components/date-range-picker": picker,
});
const home = () => {
  index = 0;
  return HeroSearch();
};
states = [];
tree = home();
assert(!nodes(tree).some((node) => node.props?.type === "date"));
assert(find(tree, (node) => node.props?.type === "submit").props.disabled);
assert.equal(
  find(tree, (node) => node.props?.type === "submit").props["aria-label"],
  "Choose a city",
);
states[1] = "santo-domingo";
tree = home();
tree.props.onSubmit({ preventDefault() {} });
assert.equal(navigation, "/cars/santo-domingo");
find(tree, (node) => node.props?.id === "hero-dates").props.onClick();
tree = home();
const calendar = find(tree, (node) => node.type === picker.DateRangePicker);
assert(calendar);
assert.equal(calendar.props.locale, "en-GB");
calendar.props.onChange({ from: "2026-10-03", to: "" });
tree = home();
assert.equal(
  find(tree, (node) => node.props?.type === "submit").props["aria-label"],
  "Choose return date",
);
calendar.props.onChange({ from: "2026-10-03", to: "2026-10-05" });
tree = home();
assert(
  find(tree, (node) => node.props?.children === "03/10/2026 - 05/10/2026"),
);
tree.props.onSubmit({ preventDefault() {} });
assert.equal(navigation, "/cars/santo-domingo?from=2026-10-03&to=2026-10-05");
// Keep car-detail half-open occupied boundaries unchanged.
states = [];
index = 0;
let range;
const occupied = picker.blockedDayPredicate([
  { start: "2026-10-05", end: "2026-10-07" },
]);
tree = picker.DateRangePicker({
  value: { from: "2026-10-03", to: "" },
  onChange: (next) => {
    range = next;
  },
  minDate: "2026-10-01",
  maxDate: "2026-10-31",
  isDayBlocked: occupied,
  locale: "en-GB",
});
const boundary = find(tree, (node) =>
  node.props?.["aria-label"]?.startsWith("Monday, 5 October 2026"),
);
assert(boundary && !boundary.props.disabled);
boundary.props.onClick();
assert.equal(range.to, "2026-10-05");
const afterBoundary = find(tree, (node) =>
  node.props?.["aria-label"]?.startsWith("Tuesday, 6 October 2026"),
);
assert(afterBoundary.props.disabled);
console.log(
  "Destination smoke: country/city, ambiguous slugs, optional date browse, shared picker, day/month display, incomplete-range feedback and half-open blocked boundaries passed (fixtures).",
);
