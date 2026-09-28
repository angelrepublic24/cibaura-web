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
  {
    id: "sd",
    countryId: "do",
    regionId: "santo",
    slug: "santo-domingo",
    name: "Santo Domingo",
  },
  { id: "mi", countryId: "us", regionId: null, slug: "miami", name: "Miami" },
];
const regions = [
  {
    id: "santo",
    countryId: "do",
    slug: "santo-domingo",
    name: "Santo Domingo",
    kind: "province",
  },
];
let countryValue = "",
  regionValue = "";
let focusedTrigger;
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
  useRef: (value) => ({ current: value }),
  useEffect: () => {},
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
      document: {
        getElementById: (id) => ({
          focus: () => {
            focusedTrigger = id;
          },
        }),
      },
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
        data:
          queryKey[1] === "countries"
            ? countryData
            : queryKey[1] === "regions"
              ? regions
              : cities,
      }),
    },
  },
);
const render = () => {
  index = 0;
  return DestinationFields({
    country: countryValue,
    region: regionValue,
    onCountryChange: (value) => {
      countryValue = value;
      regionValue = "";
      cityValue = "";
    },
    onRegionChange: (value) => {
      regionValue = value;
      cityValue = "";
    },
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
  target: { value: "DO" },
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
  target: { value: "US" },
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
  "@tanstack/react-query": { useQuery: () => ({ data: countryData }) },
  "../destinations": destinations,
  "./destination-fields": { DestinationFields },
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
countryData = countries;
states = [];
tree = home();
assert(!nodes(tree).some((node) => node.props?.type === "date"));
assert(find(tree, (node) => node.props?.type === "submit").props.disabled);
assert.equal(
  find(tree, (node) => node.props?.type === "submit").props["aria-label"],
  "Choose a country",
);
states[6] = "DO";
tree = home();
tree.props.onSubmit({ preventDefault() {} });
assert.equal(navigation, "/cars/all?country=DO");
states[1] = "santo-domingo";
tree = home();
tree.props.onSubmit({ preventDefault() {} });
assert.equal(navigation, "/cars/santo-domingo?country=DO");
find(tree, (node) => node.props?.id === "hero-from").props.onClick();
tree = home();
let calendar = find(tree, (node) => node.type === picker.DateRangePicker);
assert(calendar);
assert.equal(calendar.props.locale, "en-GB");
calendar.props.onChange({ from: "2026-10-03", to: "" });
tree = home();
assert.equal(
  find(tree, (node) => node.props?.type === "submit").props["aria-label"],
  "Choose return date",
);
find(tree, (node) => node.props?.id === "hero-to").props.onClick();
tree = home();
calendar = find(tree, (node) => node.type === picker.DateRangePicker);
assert.equal(calendar.props.editing, "to");
calendar.props.onChange({ from: "2026-10-03", to: "2026-10-05" });
assert.equal(focusedTrigger, "hero-to");
tree = home();
assert(
  find(tree, (node) => node.props?.["aria-label"] === "Return: 05/10/2026"),
);
tree.props.onSubmit({ preventDefault() {} });
assert.equal(
  navigation,
  "/cars/santo-domingo?country=DO&from=2026-10-03&to=2026-10-05",
);
// The actual parent owns cascades; country and region survive search navigation.
states[7] = "santo-domingo";
tree = home();
find(tree, (node) => node.type === DestinationFields).props.onRegionChange(
  "another-region",
);
assert.equal(states[1], "");
assert.equal(states[7], "another-region");
tree = home();
tree.props.onSubmit({ preventDefault() {} });
assert(navigation.startsWith("/cars/all?country=DO&region=another-region&"));
find(tree, (node) => node.type === DestinationFields).props.onCountryChange(
  "US",
);
assert.equal(states[1], "");
assert.equal(states[7], "");
assert.equal(
  params.carCatalogParams("all", { country: "DO", region: "santo-domingo" })
    .country,
  "DO",
);
assert.equal(
  params.carSearchParams("all", {
    country: "DO",
    region: "santo-domingo",
    from: "2026-10-03",
    to: "2026-10-05",
  }).region,
  "santo-domingo",
);
countryValue = "DO";
regionValue = "santo-domingo";
tree = render();
assert.equal(
  find(tree, (node) => node.props?.htmlFor === "hero-region").props.children,
  "Province",
);
assert(
  nodes(tree).some(
    (node) => node.type === "option" && node.props.value === "santo-domingo",
  ),
);
countryValue = "US";
regionValue = "";
tree = render();
assert(
  nodes(tree).some(
    (node) => node.type === "option" && node.props.value === "miami",
  ),
  "unassigned cities remain selectable without a region",
);
assert(
  destinations.hasUniqueCitySlug(cities[0], [
    ...cities,
    { ...cities[0], id: "other", countryId: "us" },
  ]),
  "country scopes duplicate city slugs",
);
regions.push({
  id: "capital",
  countryId: "do",
  slug: "capital",
  name: "Capital",
  kind: "capital_district",
});
countryValue = "DO";
regionValue = "";
tree = render();
assert.equal(
  find(tree, (node) => node.props?.htmlFor === "hero-region").props.children,
  "Region",
);
regionValue = "capital";
tree = render();
assert.equal(
  find(tree, (node) => node.props?.htmlFor === "hero-region").props.children,
  "Capital district",
);
regions.pop();
// Endpoint editing preserves the other date, opens its month and keeps boundaries.
function edit(endpoint, value, day, blocked = () => false) {
  states = [];
  index = 0;
  let changed;
  const result = picker.DateRangePicker({
    editing: endpoint,
    value,
    minDate: "2026-09-27",
    locale: "en-GB",
    isDayBlocked: blocked,
    onChange: (next) => {
      changed = next;
    },
  });
  const button = find(result, (node) => node.props?.["data-date"] === day);
  assert(button, "the calendar opens on the edited endpoint's month");
  if (!button.props.disabled) button.props.onClick();
  return { changed, disabled: button.props.disabled };
}
let result = edit("to", { from: "2026-10-03", to: "2026-12-05" }, "2026-12-08");
assert.equal(result.changed.from, "2026-10-03");
assert.equal(result.changed.to, "2026-12-08");
result = edit("from", { from: "2026-10-03", to: "2026-10-05" }, "2026-10-04");
assert.equal(result.changed.to, "2026-10-05");
result = edit("from", { from: "2026-10-03", to: "2026-10-05" }, "2026-10-06");
assert.equal(result.changed.from, "2026-10-06");
assert.equal(result.changed.to, "");
assert(
  edit("to", { from: "2026-10-03", to: "2026-10-05" }, "2026-10-03").disabled,
);
result = edit("to", { from: "", to: "" }, "2026-09-28");
assert.equal(result.changed.from, "");
assert.equal(result.changed.to, "2026-09-28");
result = edit("to", { from: "2026-10-31", to: "" }, "2026-11-01");
assert.equal(result.changed.to, "2026-11-01");
states = [
  "from",
  "santo-domingo",
  "2026-10-03",
  "2026-10-05",
  undefined,
  "",
  "DO",
  "",
];
tree = home();
find(tree, (node) => node.type === picker.DateRangePicker).props.onChange({
  from: "2026-10-06",
  to: "",
});
tree = home();
assert.equal(states[2], "2026-10-06");
assert(
  find(tree, (node) => node.props?.role === "status").props.children.includes(
    "Choose a new return",
  ),
);
assert(find(tree, (node) => node.props?.type === "submit").props.disabled);
find(tree, (node) => node.props?.id === "hero-to").props.onClick();
tree = home();
find(tree, (node) => node.props?.children === "Any dates").props.onClick();
tree = home();
assert.equal(states[2], "");
assert.equal(states[3], "");
assert(!find(tree, (node) => node.props?.type === "submit").props.disabled);
assert.equal(focusedTrigger, "hero-to");
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
const endpointBoundary = edit(
  "to",
  { from: "2026-10-03", to: "2026-10-04" },
  "2026-10-05",
  occupied,
);
assert.equal(endpointBoundary.changed.to, "2026-10-05");
assert(
  edit("to", { from: "2026-10-03", to: "2026-10-04" }, "2026-10-06", occupied)
    .disabled,
);
const afterBoundary = find(tree, (node) =>
  node.props?.["aria-label"]?.startsWith("Tuesday, 6 October 2026"),
);
assert(afterBoundary.props.disabled);
console.log(
  "Destination smoke: country/city, ambiguous slugs, optional date browse, shared picker, day/month display, independent endpoint editing, month selection, trigger focus restoration, incomplete-range feedback and half-open blocked boundaries passed (fixtures).",
);

// Results opt in to atomic cascades and region labels; homepage stays unchanged.
regions.push(
  {
    id: "nj",
    countryId: "us",
    slug: "new-jersey",
    name: "New Jersey",
    kind: "state",
  },
  {
    id: "de",
    countryId: "us",
    slug: "delaware",
    name: "Delaware",
    kind: "state",
  },
);
cities.push(
  {
    id: "nj-city",
    countryId: "us",
    regionId: "nj",
    name: "Newark",
    slug: "newark",
  },
  {
    id: "de-city",
    countryId: "us",
    regionId: "de",
    name: "Newark",
    slug: "newark-de",
  },
);
countryData = countries;
let selection = { country: "US", region: "", city: "newark" };
const renderResultsDestination = () =>
  DestinationFields({
    ...selection,
    idPrefix: "sr",
    showCityRegions: true,
    onDestinationChange: (next) => {
      selection = next;
    },
  });
const labelText = (node) =>
  Array.isArray(node)
    ? node.map(labelText).join("")
    : typeof node === "string"
      ? node
      : node?.props
        ? labelText(node.props.children)
        : "";
tree = renderResultsDestination();
assert.equal(
  labelText(
    find(
      tree,
      (node) => node.type === "option" && node.props.value === "newark",
    ),
  ),
  "Newark, New Jersey",
);
assert.equal(
  labelText(
    find(
      tree,
      (node) => node.type === "option" && node.props.value === "newark-de",
    ),
  ),
  "Newark, Delaware",
);
find(tree, (node) => node.props?.id === "sr-region").props.onChange({
  target: { value: "delaware" },
});
assert.equal(selection.city, "");
assert.equal(selection.country, "US");
tree = renderResultsDestination();
assert.equal(
  labelText(
    find(
      tree,
      (node) => node.type === "option" && node.props.value === "newark-de",
    ),
  ),
  "Newark",
);
assert(
  !find(
    tree,
    (node) => node.type === "option" && node.props.value === "newark",
  ),
);
find(tree, (node) => node.props?.id === "sr-city").props.onChange({
  target: { value: "newark-de" },
});
assert.equal(selection.city, "newark-de");
tree = renderResultsDestination();
find(tree, (node) => node.props?.id === "sr-country").props.onChange({
  target: { value: "DO" },
});
assert.equal(selection.country, "DO");
assert.equal(selection.region, "");
assert.equal(selection.city, "");
console.log(
  "Results destination smoke: 10 cascade and Newark assertions passed (fixtures).",
);
