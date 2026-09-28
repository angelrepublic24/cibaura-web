// Component interactions with explicit geo/provider fixtures; no real location request.
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
const results = [
  {
    address_components: [
      { types: ["country"], short_name: "DO" },
      { types: ["locality"], long_name: "Santo Domingo" },
    ],
  },
];
let states = [],
  refs = [],
  index = 0,
  refIndex = 0,
  countryData = countries,
  cityValue = "",
  calls = 0,
  denied = false;
const react = {
  ...require("react"),
  useState: (initial) => {
    const slot = index++;
    if (!(slot in states)) states[slot] = initial;
    return [
      states[slot],
      (value) => {
        states[slot] =
          typeof value === "function" ? value(states[slot]) : value;
      },
    ];
  },
  useRef: (initial) =>
    refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
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
      process: { env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "fixture-only" } },
      navigator: {
        geolocation: {
          getCurrentPosition: (success, failure) => {
            calls++;
            if (denied) failure(new Error("denied"));
            else success({ coords: { latitude: 0, longitude: 0 } });
          },
        },
      },
      google: {
        maps: {
          importLibrary: async () => ({
            Geocoder: class {
              async geocode() {
                return { results };
              }
            },
          }),
        },
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
assert.equal(
  destinations.matchDestination(results, countries, cities).city.id,
  "sd",
);
assert.equal(
  destinations.matchDestination(results, [countries[1]], cities),
  null,
);
assert.equal(
  destinations.matchDestination(results, countries, [
    ...cities,
    { ...cities[0], id: "duplicate", countryId: "us" },
  ]),
  null,
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
    "@/shared/hooks/use-google-maps": { loadGoogleMaps: async () => {} },
  },
);
const render = () => {
  index = 0;
  refIndex = 0;
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
const button = (tree, label) =>
  find(tree, (node) => node.props?.children === label);
let tree = render();
assert.equal(calls, 0, "mount must never request location");
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
tree = render();
button(tree, "Use my location").props.onClick();
await new Promise(setImmediate);
tree = render();
assert.equal(calls, 1);
assert.equal(cityValue, "", "suggestion must not select a destination");
button(tree, "Dismiss").props.onClick();
assert.equal(cityValue, "");
tree = render();
button(tree, "Use my location").props.onClick();
await new Promise(setImmediate);
tree = render();
button(tree, "Use this destination").props.onClick();
assert.equal(cityValue, "santo-domingo");
denied = true;
tree = render();
button(tree, "Use my location").props.onClick();
await new Promise(setImmediate);
tree = render();
assert.equal(cityValue, "santo-domingo", "denial preserves manual destination");
assert(
  find(
    tree,
    (node) =>
      typeof node.props?.children === "string" &&
      node.props.children.includes("choose any destination manually"),
  ),
);
countryData = [countries[0]];
states = [];
refs = [];
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
console.log(
  "Destination smoke: matching, ambiguous slugs, country/city reset, explicit location, confirmation/dismissal/denial, single-country display and dateless params passed (fixtures only).",
);
