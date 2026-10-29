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
  taxCents: 1800,
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
  depositRequired: true,
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
// The real service builds the request path; only the transport is faked.
// Its zod schemas are stubbed to pass-through so the fixtures below stay
// readable — their SHAPE is what the schema tests cover.
const passthrough = new Proxy({}, { get: () => ({ parse: (value) => value }) });
const { bookingsService } = load(
  "src/modules/bookings/services/bookings.service.ts",
  "",
  {
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
    "@/modules/bookings/schema/bookings.schema": passthrough,
    "@/modules/legal/schema/legal.schema": passthrough,
  },
);
// The component asks a HOOK now; this one runs the real service call and
// records the refresh the hook would do.
mocks.useRespondClaim = (bookingId, claimId) => ({
  isPending: false,
  mutate: (input) => {
    pendingRequest = bookingsService
      .respondClaim(bookingId, claimId, input)
      .then(() => {
        invalidated = bookingId;
      });
  },
});
const customerClaim = load(
  "src/modules/bookings/components/claim-response-card.tsx",
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
  checks++;
}
// A claim that closed under us is a refresh, not an error to argue with —
// the hook, which owns the cache, is where that rule lives now.
const bookingHooks = load("src/modules/bookings/hooks/bookings.hook.ts");
bookingHooks.useRespondClaim(booking.id, claim.id);
assert.equal(typeof mutation.onError, "function");
checks++;
const admin = load("src/modules/admin/components/order-lifecycle-cards.tsx");
for (const [file, name, props, pattern] of [
  [
    "src/modules/bookings/components/deposit-banner.tsx",
    "DepositBanner",
    { booking },
    /USD 250.00/,
  ],
  [
    "src/modules/bookings/components/settlement-card.tsx",
    "SettlementCard",
    { booking },
    /USD 31.00/,
  ],
  [
    "src/modules/agency/components/deposit-status-card.tsx",
    "DepositStatusCard",
    { booking },
    /USD 250.00/,
  ],
  [
    "src/modules/agency/components/claim-card.tsx",
    "ClaimCard",
    { booking },
    /Fixture damage description/,
  ],
  [
    "src/modules/agency/components/agency-settlement-card.tsx",
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
  "src/modules/bookings/components/inspections-section.tsx",
);
const inspectionHtml = render(InspectionsSection, { booking });
assert.match(inspectionHtml, /12,345 km/);
assert.match(inspectionHtml, /Recorded fixture scratch/);
checks++;
bookingHooks.useBookingDetail(booking.id);
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
// Deliberately inconsistent amounts prove the UI displays server figures rather
// than recomputing totals. These are test fixtures, not real inventory.
const money = load("src/shared/utils/money.ts");
const { PriceBreakdown } = load(
  "src/shared/components/price-breakdown.tsx",
  "",
  {
    "@/shared/utils/money": money,
  },
);
const pricing = {
  currency: "USD",
  days: 2,
  hostDailyRateCents: 10000,
  renterDailyRateCents: 11000,
  hostDeliveryFeeCents: 500,
  renterDeliveryFeeCents: 550,
  hostSubtotalCents: 20500,
  renterSubtotalCents: 22550,
  commissionPct: 10,
  commissionCents: 2050,
  taxRatePct: 18,
  taxCents: 3690,
  totalCents: 99999,
};
const heldDeposit = { cents: 35000, required: true };
for (const viewer of ["renter", "host"]) {
  for (const taxRatePct of [0, 18]) {
    const result = render(PriceBreakdown, {
      pricing: { ...pricing, taxRatePct, taxCents: taxRatePct ? 3690 : 0 },
      viewer,
      deposit: heldDeposit,
    });
    assert(result.includes(`Tax (${money.formatPct(taxRatePct)})`));
    assert(result.includes(money.formatMoneyCents(taxRatePct ? 3690 : 0, "USD")));
    assert(result.includes(money.formatMoneyCents(99999, "USD")));
    assert(result.includes(money.formatMoneyCents(35000, "USD")));
    // BUG-010: renta y delivery son líneas SEPARADAS, no "(included in
    // subtotal)". BUG-002: la línea de renta LEE como el producto que es, y
    // no queda ninguna línea de "subtotal" que incluya el delivery dentro.
    const rateCents = viewer === "renter" ? 11000 : 10000;
    assert(
      result.includes(
        `<dt>${money.formatMoneyCents(rateCents, "USD")}/day × 2 days</dt>`,
      ),
    );
    assert.match(result, /<dt>Delivery<\/dt>/);
    assert(!/subtotal/i.test(result), "ninguna línea ambigua de subtotal");
    // La renta es subtotal − delivery (resta exacta de enteros del servidor).
    const rentalCents = viewer === "renter" ? 22550 - 550 : 20500 - 500;
    const deliveryCents = viewer === "renter" ? 550 : 500;
    assert(result.includes(money.formatMoneyCents(rentalCents, "USD")));
    assert(result.includes(money.formatMoneyCents(deliveryCents, "USD")));
    assert.match(result, /Security deposit/);
    checks++;
  }
}
// The decision this whole surface exists for: a renter is shown the marked-up
// subtotal and NOTHING of the host's base price or the platform's cut.
const renterView = render(PriceBreakdown, {
  pricing,
  viewer: "renter",
  deposit: heldDeposit,
});
// Renta marcada (22550 − 550 = 22000) + delivery (550); jamás la base del host.
assert(renterView.includes(money.formatMoneyCents(22000, "USD")));
assert(renterView.includes(money.formatMoneyCents(550, "USD")));
assert(!renterView.includes(money.formatMoneyCents(20500, "USD")));
assert(!renterView.includes(money.formatMoneyCents(20000, "USD")));
assert(!renterView.includes(money.formatMoneyCents(2050, "USD")));
assert(!renterView.includes("Platform service fee"));
checks++;
const hostView = render(PriceBreakdown, {
  pricing,
  viewer: "host",
  deposit: heldDeposit,
});
assert(hostView.includes(money.formatMoneyCents(20000, "USD")));
assert(hostView.includes("Platform service fee"));
checks++;
assert.match(
  render(PriceBreakdown, {
    pricing,
    viewer: "renter",
    deposit: { ...heldDeposit, estimate: true },
  }),
  /Estimated security deposit/,
);
checks++;
// "rate × days" is only CLAIMED when it is exactly true. The displayed
// amount is the server's subtotal either way.
const exact = {
  ...pricing,
  hostDeliveryFeeCents: 0,
  renterDeliveryFeeCents: 0,
  renterSubtotalCents: 22000,
};
assert.match(
  render(PriceBreakdown, { pricing: exact, viewer: "renter" }),
  /\$110\.00\/day × 2 days/,
);
checks++;
// A booking priced before the markup moved into the daily rate: a cent off,
// so the row must not pretend to be a multiplication.
const legacy = { ...exact, renterSubtotalCents: 21999 };
const legacyView = render(PriceBreakdown, { pricing: legacy, viewer: "renter" });
assert.match(legacyView, /<dt>Rental · 2 days<\/dt>/);
// The rate still has to be readable — stated on its own line, where it claims
// no multiplication.
assert.match(legacyView, /<dt>Daily rate<\/dt>/);
assert(legacyView.includes(money.formatMoneyCents(21999, "USD")));
assert(!legacyView.includes(money.formatMoneyCents(22000, "USD")));
checks++;

/*
 * BUG-002: EVERY LINE A READER CAN SEE ADDS UP TO THE TOTAL.
 *
 * Its own fixture on purpose. The snapshot above is deliberately incoherent
 * (`totalCents: 99999`) to prove the component prints the server's figures
 * instead of recomputing them, so it is the one fixture that cannot also
 * prove they reconcile. This one is built from the contract itself
 * (`subtotal = rate × days + delivery`, `commission = renterSubtotal −
 * hostSubtotal`, `total = renterSubtotal + tax`) and then checks the
 * RENDERED numbers, not the inputs.
 */
function coherentPricing({ days, delivery, taxRatePct, drift = 0 }) {
  const hostRate = 10000;
  const renterRate = 11000; // the platform's cut lives inside the rate
  const hostDelivery = delivery;
  const renterDelivery = delivery === 0 ? 0 : delivery + 50;
  const hostSubtotalCents = hostRate * days + hostDelivery;
  // `drift` models a booking priced before the markup moved into the rate.
  const renterSubtotalCents = renterRate * days + renterDelivery + drift;
  const taxCents = Math.round((renterSubtotalCents * taxRatePct) / 100);
  return {
    currency: "USD",
    days,
    hostDailyRateCents: hostRate,
    renterDailyRateCents: renterRate,
    hostDeliveryFeeCents: hostDelivery,
    renterDeliveryFeeCents: renterDelivery,
    hostSubtotalCents,
    renterSubtotalCents,
    commissionPct: 10,
    commissionCents: renterSubtotalCents - hostSubtotalCents,
    taxRatePct,
    taxCents,
    totalCents: renterSubtotalCents + taxCents,
  };
}

/** Every `<dt>/<dd>` pair as `{ label, cents }`, read back off the markup. */
function moneyRows(html) {
  return [...html.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)].map(
    ([, label, value]) => ({
      label,
      cents: Math.round(Number(value.replace(/[^0-9.-]/g, "")) * 100),
    }),
  );
}

for (const days of [1, 3]) {
  for (const delivery of [0, 500]) {
    for (const taxRatePct of [0, 18]) {
      for (const viewer of ["renter", "host"]) {
        const snapshot = coherentPricing({ days, delivery, taxRatePct });
        const html = render(PriceBreakdown, {
          pricing: snapshot,
          viewer,
          deposit: heldDeposit,
        });
        const rows = moneyRows(html);
        const total = rows.find((row) => row.label === "Total");
        assert(total, "there is always a Total row");
        /*
         * The "Daily rate" row is a RATE, not a line item: it only appears
         * when the label above could not state the product, and it is
         * excluded here for the same reason it is muted on screen. The
         * deposit is a hold the copy says is NOT in the total.
         */
        const summable = rows.filter(
          (row) =>
            row.label !== "Total" &&
            row.label !== "Daily rate" &&
            !/deposit/i.test(row.label),
        );
        assert.equal(
          summable.reduce((sum, row) => sum + row.cents, 0),
          total.cents,
          `${viewer}: ${days}d delivery=${delivery} tax=${taxRatePct} must reconcile`,
        );
        // The rental row is the car alone, and it reads as the product it is.
        const subtotalCents =
          viewer === "renter"
            ? snapshot.renterSubtotalCents
            : snapshot.hostSubtotalCents;
        const deliveryCents =
          viewer === "renter"
            ? snapshot.renterDeliveryFeeCents
            : snapshot.hostDeliveryFeeCents;
        const rateCents =
          viewer === "renter"
            ? snapshot.renterDailyRateCents
            : snapshot.hostDailyRateCents;
        const dayWord = days === 1 ? "1 day" : `${days} days`;
        assert(
          html.includes(
            `<dt>${money.formatMoneyCents(rateCents, "USD")}/day × ${dayWord}</dt>` +
              `<dd>${money.formatMoneyCents(subtotalCents - deliveryCents, "USD")}</dd>`,
          ),
          `${viewer}: the rental row is the product, delivery taken out`,
        );
        // A fee of zero is no line at all, and never an ambiguous subtotal.
        assert.equal(/<dt>Delivery<\/dt>/.test(html), delivery > 0);
        assert(!/subtotal/i.test(html));
        checks++;
      }
    }
  }
}

// The same reconciliation on a legacy snapshot, where the label degrades: the
// amounts still add up, because none of them was ever derived here.
for (const viewer of ["renter", "host"]) {
  const drifted = coherentPricing({
    days: 2,
    delivery: 500,
    taxRatePct: 18,
    drift: -1,
  });
  const html = render(PriceBreakdown, { pricing: drifted, viewer });
  const rows = moneyRows(html);
  const total = rows.find((row) => row.label === "Total");
  const summable = rows.filter(
    (row) => row.label !== "Total" && row.label !== "Daily rate",
  );
  assert.equal(
    summable.reduce((sum, row) => sum + row.cents, 0),
    total.cents,
    `${viewer}: a drifted snapshot still reconciles`,
  );
  // Only the RENTER's subtotal drifts (the host's is exact by contract), so
  // only the renter's label degrades — and then the rate gets its own line.
  if (viewer === "renter") {
    assert.match(html, /<dt>Rental · 2 days<\/dt>/);
    assert.match(html, /<dt>Daily rate<\/dt>/);
  } else {
    assert(html.includes("/day × 2 days"));
  }
  checks++;
}
// "No deposit" is a host's decision, stated as one — never a blank amount.
assert.match(
  render(PriceBreakdown, {
    pricing,
    viewer: "renter",
    deposit: { cents: 0, required: false },
  }),
  /No deposit required/,
);
checks++;
const summary = load(
  "src/modules/bookings/components/booking-summary.tsx",
  "",
  {
    "@/shared/components/price-breakdown": { PriceBreakdown },
  },
);
assert(
  render(summary.PricingCard, {
    booking: {
      ...booking,
      pricing,
      depositCents: 35000,
      depositRequired: true,
      car: { depositCents: 20000 },
    },
    viewer: "renter",
  }).includes(money.formatMoneyCents(35000, "USD")),
);
checks++;
for (const taxCents of [0, 1800]) {
  const current = {
    ...booking,
    state: "settled",
    settlement: { ...settlement, taxCents },
  };
  for (const result of [
    render(
      load("src/modules/bookings/components/settlement-card.tsx")
        .SettlementCard,
      { booking: current },
    ),
    render(
      load("src/modules/agency/components/agency-settlement-card.tsx")
        .AgencySettlementCard,
      { booking: current },
    ),
    render(admin.SettlementCard, {
      settlement: current.settlement,
      currency: "USD",
    }),
  ]) {
    assert.match(result, /Tax allocated to the tax authority/);
    assert(result.includes(`USD ${(taxCents / 100).toFixed(2)}`));
    assert.match(result, /USD 69.00/);
    assert.match(result, /USD 10.00/);
    assert.match(result, /USD 31.00/);
    checks++;
  }
}
console.log(
  `Booking lifecycle: ${checks} cases passed (serializer-shaped fixtures, actual response mutation/API path; no real booking writes).`,
);
