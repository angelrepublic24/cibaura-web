/** Real component/API code with serializer-shaped fixtures, not live bookings. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const now = Date.parse("2026-09-25T12:00:00Z");
const claim = {
  id: "claim",
  bookingId: "booking",
  currency: "USD",
  status: "open",
  requestedCents: 12345,
  approvedCents: null,
  capturedCents: 0,
  uncollectedCents: 0,
  description: "Fixture damage description",
  evidenceMediaIds: [],
  customerResponse: null,
  customerNote: null,
  respondBy: "2026-09-27T12:00:00Z",
  decidedAt: null,
  decisionNote: null,
  createdAt: "2026-09-25T12:00:00Z",
};
const deposit = {
  amountCents: 25000,
  currency: "USD",
  status: "held",
  captureBefore: null,
  capturedCents: 0,
};
const settlement = {
  status: "finalized",
  case: "completed",
  refundCents: 3100,
  retentionCents: 0,
  earlyReturnRefundCents: 0,
  unusedDays: 0,
  claimCents: 0,
  advanceCents: 0,
  hostNetCents: 6900,
  platformNetCents: 1000,
  finalizedAt: "2026-09-25T10:00:00Z",
  disputeWindowEndsAt: null,
  breakdown: [],
};
const booking = {
  id: "booking",
  state: "returned",
  agency: { id: "host", name: "Fixture Host" },
  pricing: { currency: "USD" },
  depositCents: 25000,
  inspections: [{ id: "inspection", type: "checkout", status: "finalized" }],
  deposit,
  claim,
  settlement,
  agreement: null,
};
const inspection = {
  id: "inspection",
  bookingId: "booking",
  type: "checkout",
  status: "finalized",
  odometerKm: 12345,
  fuelLevelEighths: 4,
  damageNotes: "Recorded fixture scratch",
  damageFlagged: true,
  media: [],
  submittedAt: claim.createdAt,
  customerConfirmedAt: claim.createdAt,
  customerAbsentReason: null,
  customerDisputeNote: null,
  finalizedAt: claim.createdAt,
};
const stub = ({ children }) => React.createElement("div", null, children);
let mutation,
  formValues,
  lastRequest,
  pendingRequest,
  invalidated,
  inspectionEnabled,
  queryOptions;
const mocks = {
  useNow: () => now,
  usePermission: () => ({ can: () => true }),
  useQueryClient: () => ({}),
  useQuery: (options) => {
    queryOptions = options;
    return { data: booking };
  },
  useMutation: (options) => {
    mutation = options;
    return {
      isPending: false,
      mutate: (values) => {
        pendingRequest = options.mutationFn(values).then(options.onSuccess);
      },
    };
  },
  useForm: () => ({
    watch: () => formValues?.response,
    register: () => ({}),
    handleSubmit: (callback) => () => callback(formValues),
    formState: { errors: {} },
  }),
  zodResolver: () => undefined,
  useBookingInspections: (_id, enabled) => {
    inspectionEnabled = enabled;
    return { data: [inspection] };
  },
  useAgencyInspections: () => ({ data: [] }),
  useAgencyClaims: () => ({ data: [claim] }),
  invalidateBooking: (_qc, id) => {
    invalidated = id;
  },
  useRequestPayment: () => ({ isPending: false, phase: { step: "idle" } }),
  BOOKING_TERMINAL_STATES: ["cancelled", "settled", "rejected"],
  claimStatusMeta: (status) => ({ label: status, tone: "warning" }),
  depositStatusMeta: (status) => ({ label: status, tone: "warning" }),
  inspectionStatusMeta: (status) => ({ label: status, tone: "warning" }),
  inspectionTypeLabel: (type) => type,
  fuelLevelText: (fuel) => `${fuel}/8`,
  formatMoneyCents: (cents, currency) =>
    `${currency} ${(cents / 100).toFixed(2)}`,
  formatDateTime: (date) => date ?? "none",
  formatRemaining: (ms) => `${ms / 3600000} hours`,
  settlementCaseLabel: (value) => value,
  cn: (...parts) => parts.join(" "),
  Button: ({ children, disabled, type }) =>
    React.createElement("button", { disabled, type }, children),
};
function load(file, extra = "", modules = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(file, "utf8") + extra,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      if (name === "react" || name === "react/jsx-runtime")
        return require(name);
      if (name in modules) return modules[name];
      return new Proxy({}, { get: (_target, key) => mocks[key] ?? stub });
    },
  });
  return exports;
}
const { BookingsApi, bookingKeys } = load("src/features/bookings/api.ts", "", {
  "@/shared/api/client": {
    Api: {
      post: async (path, input) => {
        lastRequest = { path, input };
        return {
          data: {
            ...claim,
            status: input.accept ? "approved" : "under_review",
          },
        };
      },
    },
  },
});
mocks.BookingsApi = BookingsApi;
mocks.bookingKeys = bookingKeys;
const customerClaim = load(
  "src/features/bookings/components/claim-response-card.tsx",
  "\nexport { RespondForm };",
);
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
let checks = 0;
const html = render(customerClaim.ClaimResponseCard, { booking });
assert.match(html, /Your response is needed/);
assert.match(html, /48 hours left to respond/);
assert.match(html, /Accept the claim/);
assert.match(html, /Reject the claim/);
assert.match(html, /USD 123.45/);
assert(!/<button[^>]*disabled/.test(html));
checks++;
assert.equal(
  render(customerClaim.ClaimResponseCard, {
    booking: { ...booking, claim: null },
  }),
  "",
);
checks++;
const expired = render(customerClaim.ClaimResponseCard, {
  booking: {
    ...booking,
    claim: { ...claim, respondBy: "2026-09-24T12:00:00Z" },
  },
});
assert.match(expired, /Response window closed/);
assert.match(expired, /<button[^>]*disabled/);
checks++;
const reviewed = render(customerClaim.ClaimResponseCard, {
  booking: {
    ...booking,
    claim: { ...claim, status: "under_review", customerResponse: "rejected" },
  },
});
assert.match(reviewed, /You rejected the claim/);
assert.doesNotMatch(reviewed, /Send my response/);
checks++;
for (const response of ["accept", "reject"]) {
  formValues = {
    response,
    note: response === "reject" ? "I disagree with this damage" : "",
  };
  const form = customerClaim.RespondForm({ booking, claim });
  form.props.onSubmit();
  await pendingRequest;
  assert.equal(lastRequest.path, "/bookings/booking/claims/claim/respond");
  assert.equal(lastRequest.input.accept, response === "accept");
  assert.equal(lastRequest.input.note, formValues.note || undefined);
  assert.equal(invalidated, booking.id);
  assert.equal(typeof mutation.onError, "function");
  checks++;
}
const admin = load("src/features/admin/components/order-lifecycle-cards.tsx");
for (const [file, name, props, pattern] of [
  [
    "src/features/bookings/components/deposit-banner.tsx",
    "DepositBanner",
    { booking },
    /USD 250.00/,
  ],
  [
    "src/features/bookings/components/settlement-card.tsx",
    "SettlementCard",
    { booking },
    /USD 31.00/,
  ],
  [
    "src/features/agency/components/deposit-status-card.tsx",
    "DepositStatusCard",
    { booking },
    /USD 250.00/,
  ],
  [
    "src/features/agency/components/claim-card.tsx",
    "ClaimCard",
    { booking },
    /Fixture damage description/,
  ],
  [
    "src/features/agency/components/agency-settlement-card.tsx",
    "AgencySettlementCard",
    { booking: { ...booking, state: "settled" } },
    /USD 69.00/,
  ],
]) {
  assert.match(render(load(file)[name], props), pattern);
  checks++;
}
assert.match(
  render(admin.DepositCard, {
    deposit,
    currency: "USD",
    bookingDepositCents: booking.depositCents,
  }),
  /USD 250.00/,
);
checks++;
assert.match(
  render(admin.ClaimCard, { claim, currency: "USD" }),
  /Fixture damage description/,
);
checks++;
assert.match(
  render(admin.SettlementCard, { settlement, currency: "USD" }),
  /USD 69.00/,
);
checks++;
render(admin.InspectionsCard, {
  bookingId: booking.id,
  refs: booking.inspections,
});
assert.equal(inspectionEnabled, true);
checks++;
const { InspectionsSection } = load(
  "src/features/bookings/components/inspections-section.tsx",
);
const inspectionHtml = render(InspectionsSection, { booking });
assert.match(inspectionHtml, /12,345 km/);
assert.match(inspectionHtml, /Recorded fixture scratch/);
checks++;
const hooks = load("src/features/bookings/hooks.ts");
hooks.useBookingDetail(booking.id);
for (const [state, currentClaim, interval] of [
  ["returned", null, 30000],
  ["settled", claim, 30000],
  ["settled", null, false],
]) {
  assert.equal(
    queryOptions.refetchInterval({
      state: { data: { state, claim: currentClaim } },
    }),
    interval,
  );
  checks++;
}
console.log(
  `Booking lifecycle: ${checks} cases passed (serializer-shaped fixtures, actual response mutation/API path; no real booking writes).`,
);
