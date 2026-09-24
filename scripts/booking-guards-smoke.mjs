/** Component regression checks with omitted lifecycle fields, no API calls.
 * Transpile the real components; isolate their UI, form and network dependencies.
 * Run: node scripts/booking-guards-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
let inspectionsEnabled;
const stub = ({ children }) => React.createElement("div", null, children);
const mocks = {
  useBookingInspections: (_id, enabled) => {
    inspectionsEnabled = enabled;
    return { data: [] };
  },
  useNow: () => 0,
  useQueryClient: () => ({}),
  useMutation: () => ({}),
  useInspectionUploads: () => ({ inFlight: false }),
  zodResolver: () => undefined,
  useForm: () => ({
    watch: () => false,
    register: () => ({}),
    handleSubmit: () => () => {},
    formState: { errors: {}, isDirty: false },
  }),
  requiredShotsUploaded: () => 0,
  REQUIRED_INSPECTION_LABELS: [],
  FUEL_LEVEL_OPTIONS: [],
};

function load(file, extraExport = "") {
  const source = readFileSync(file, "utf8") + extraExport;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      if (name === "react" || name === "react/jsx-runtime")
        return require(name);
      return new Proxy({}, { get: (_target, key) => mocks[key] ?? stub });
    },
  });
  return exports;
}

const admin = load("src/features/admin/components/order-lifecycle-cards.tsx");
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
for (const refs of [undefined, []]) {
  assert.match(
    render(admin.InspectionsCard, { bookingId: "fixture", refs }),
    /No check-in or check-out inspection yet/,
  );
  assert.equal(inspectionsEnabled, false);
}
assert.equal(render(admin.DepositCard, { currency: "USD" }), "");
assert.equal(render(admin.ClaimCard, { currency: "USD" }), "");
assert.equal(render(admin.SettlementCard, { currency: "USD" }), "");
const { DraftEditor } = load(
  "src/features/agency/components/inspection-panel.tsx",
  "\nexport { DraftEditor };",
);
for (const deposit of [
  undefined,
  null,
  { status: "held" },
  { status: "pending_hold" },
]) {
  const html = render(DraftEditor, {
    booking: { id: "fixture", deposit },
    inspection: {
      id: "inspection",
      type: "checkin",
      media: [],
      odometerKm: null,
      fuelLevelEighths: null,
    },
  });
  assert.match(html, /Submit for customer confirmation/);
  if (deposit == null) assert.doesNotMatch(html, /Security deposit in place/);
  if (deposit?.status === "pending_hold")
    assert.match(html, /Security deposit not held yet/);
}
console.log(
  "booking-guards: 9 component render cases passed (synthetic props)",
);
