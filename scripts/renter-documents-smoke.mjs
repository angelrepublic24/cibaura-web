/**
 * Real components with serializer-shaped fixtures, no network.
 *
 * Two agency-side surfaces that are easy to get subtly wrong:
 *
 *  1. THE RENTER-DOCUMENTS NUDGE (QA feature #9). The button exists only
 *     where the SERVER says a nudge would be true, obeys the cooldown the
 *     server will enforce, and never prints identity data or a consequence
 *     the backend does not actually enforce.
 *
 *  2. WHO SENT EACH CHAT MESSAGE (QA fix #14). The wire deliberately
 *     withholds the sender's user id, so an agency-side message is NOT
 *     attributable to a person. Labelling a colleague's message "You" is the
 *     bug that was reported — and it is one ternary away from coming back, so
 *     it is asserted here rather than left to review.
 *
 * Run: node scripts/renter-documents-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const stub = ({ children }) => React.createElement("div", null, children);
const now = Date.parse("2026-09-25T12:00:00Z");

let permission = { can: () => true };
let remind = { isPending: false, isError: false, isSuccess: false, error: null };
let messages = [];
let authState = null;
let checks = 0;

const mocks = {
  useNow: () => now,
  usePermission: () => permission,
  useRemindRenterDocuments: () => ({ ...remind, mutate: () => {} }),
  formatDateTime: (iso) => `at ${iso}`,
  formatRemaining: (ms) => `${Math.round(ms / 3_600_000)}h`,
  getErrorMessage: (_error, fallback) => fallback,
  isApiErrorCode: (error, code) => error?.code === code,
  API_ERROR_CODES: {
    RENTER_DOCUMENTS_IN_ORDER: "RENTER_DOCUMENTS_IN_ORDER",
    RENTER_DOCUMENTS_REMINDER_TOO_SOON: "RENTER_DOCUMENTS_REMINDER_TOO_SOON",
    RENTER_DOCUMENTS_BOOKING_CLOSED: "RENTER_DOCUMENTS_BOOKING_CLOSED",
  },
  Button: ({ children, disabled }) =>
    React.createElement("button", { disabled }, children),
  cn: (...parts) => parts.filter(Boolean).join(" "),
  useBookingMessages: () => ({ data: messages }),
  useSendBookingMessage: () => ({ isPending: false, isError: false, mutate: () => {} }),
  useAuthStore: (select) => select(authState),
  Input: (props) => React.createElement("input", props),
  EmptyState: ({ title }) => React.createElement("p", null, title),
  LoadingState: ({ label }) => React.createElement("p", null, label),
};

function load(file) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) =>
      name === "react" || name === "react/jsx-runtime"
        ? require(name)
        : new Proxy({}, { get: (_target, key) => mocks[key] ?? stub }),
  });
  return exports;
}

/** Agency-viewer booking: `customer` and `renterDocuments` are agency-only. */
const booking = {
  id: "booking",
  state: "accepted",
  agency: { id: "agency-1", name: "Cibao Rentals" },
  customer: { id: "renter-1", name: "Deimy Pérez" },
};
const pendingOnly = {
  pending: true,
  reasons: [],
  lastRemindedAt: null,
  nextReminderAt: null,
};
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
const withDocs = (renterDocuments, state = booking.state) =>
  render(RenterDocumentsNotice, {
    booking: { ...booking, state, renterDocuments },
  });

// ── The nudge ──────────────────────────────────────────────────────────────
const { RenterDocumentsNotice } = load(
  "src/modules/agency/components/renter-documents-notice.tsx",
);

// An ABSENT key means "this route did not resolve it" — not `pending: false`.
assert.equal(render(RenterDocumentsNotice, { booking }), "");
checks++;
assert.equal(withDocs({ ...pendingOnly, pending: false }), "");
checks++;

const open = withDocs({
  ...pendingOnly,
  reasons: ["license_expired", "a_code_shipped_later"],
});
assert.match(open, /The renter still owes documents/);
assert.match(open, /Their driver&#x27;s licence has expired/);
// A code this build has never seen still counts as missing, never a blank row.
assert.match(open, /Something else on their file is missing/);
assert.doesNotMatch(open, /<button[^>]*disabled/, "cooldown open ⇒ enabled");
checks++;

// The cooldown the server will enforce is SHOWN, not discovered via a 409.
const waiting = withDocs({
  pending: true,
  reasons: [],
  lastRemindedAt: "2026-09-25T10:00:00Z",
  nextReminderAt: "2026-09-26T10:00:00Z",
});
assert.match(waiting, /<button[^>]*disabled/);
assert.match(waiting, /you can send another in 22h/);
assert.match(waiting, /Remind again/);
// Pending with NO reasons is the pre-acceptance identity window (ADR-0011).
assert.match(waiting, /shared with you once you accept/);
checks++;

// Neither a malformed nor a past instant may leave the button stuck.
assert.doesNotMatch(
  withDocs({ ...pendingOnly, nextReminderAt: "not-a-date" }),
  /<button[^>]*disabled/,
);
assert.doesNotMatch(
  withDocs({ ...pendingOnly, nextReminderAt: "2026-09-24T10:00:00Z" }),
  /<button[^>]*disabled/,
);
// Whole minutes would render the last seconds as "in 0m".
assert.match(
  withDocs({ ...pendingOnly, nextReminderAt: "2026-09-25T12:00:40Z" }),
  /in under a minute/,
);
checks++;

// The endpoint requires `bookings:handle`; without it there is no button.
permission = { can: () => false };
const readOnly = withDocs(pendingOnly);
assert.doesNotMatch(readOnly, /<button/);
assert.match(readOnly, /Ask a teammate who can handle bookings/);
permission = { can: () => true };
checks++;

// Every refusal the backend can answer gets its own sentence.
for (const [code, copy] of [
  ["RENTER_DOCUMENTS_IN_ORDER", /Nothing is missing any more/],
  ["RENTER_DOCUMENTS_REMINDER_TOO_SOON", /already reminded about this booking/],
  ["RENTER_DOCUMENTS_BOOKING_CLOSED", /cannot reopen it/],
  ["A_CODE_SHIPPED_LATER", /Could not send the reminder/],
]) {
  remind = { isPending: false, isError: true, isSuccess: false, error: { code } };
  assert.match(withDocs(pendingOnly), copy);
  checks++;
}
remind = { isPending: false, isError: false, isSuccess: false, error: null };

/*
 * The consequence sentence follows the state. The documents gate
 * (`VerificationService.assertCanRent`) runs at request, re-sign and car
 * change — NOT at hand-over — so "cannot be handed over" would be a check
 * the server does not make, and an unrecognised state gets no consequence
 * rather than a guessed one.
 */
for (const [state, pattern] of [
  ["requested", /cannot move forward[\s\S]*including the pick-up/],
  ["accepted", /cannot move forward[\s\S]*before the pick-up/],
  ["active", /already under way/],
]) {
  assert.match(withDocs(pendingOnly, state), pattern, `consequence for ${state}`);
  checks++;
}
const unexpected = withDocs(pendingOnly, "returned");
assert.match(unexpected, /still owes documents/, "the card still renders");
assert.doesNotMatch(unexpected, /cannot move forward|already under way/);
assert.doesNotMatch(unexpected, /handed over/);
checks++;

// ── Who sent each message ──────────────────────────────────────────────────
const { ChatPanel } = load("src/modules/bookings/components/chat-panel.tsx");
messages = [
  { id: "m1", senderRole: "customer", body: "Hola", createdAt: "2026-09-25T11:00:00Z" },
  // TWO agency-side messages. The wire cannot tell them apart, so NEITHER may
  // be attributed to the reader — this is the QA #14 regression guard.
  { id: "m2", senderRole: "agency", body: "Buenas", createdAt: "2026-09-25T11:05:00Z" },
  { id: "m3", senderRole: "agency", body: "Confirmado", createdAt: "2026-09-25T11:06:00Z" },
];
const count = (html, needle) => (html.match(new RegExp(needle, "g")) ?? []).length;

authState = { user: { id: "staff-1", agencyId: "agency-1", roles: ["agency_staff"] } };
const hostView = render(ChatPanel, { booking });
assert.doesNotMatch(
  hostView,
  /You ·/,
  "a colleague's message must never be attributed to the reader (QA #14)",
);
assert.equal(count(hostView, "Your team ·"), 2);
assert.match(hostView, /Deimy Pérez ·/, "the renter is named for the host");
assert.match(hostView, /records which side replied, not which teammate/);
assert.match(hostView, /sent from this tab/, "the host is told what You means");
checks++;

// The renter IS identified by `senderRole` — one human by definition.
authState = { user: { id: "renter-1", agencyId: null, roles: ["customer"] } };
const renterView = render(ChatPanel, { booking });
assert.match(renterView, /You ·/);
assert.equal(count(renterView, "Cibao Rentals ·"), 2);
assert.doesNotMatch(renterView, /Your team/);
assert.doesNotMatch(renterView, /which teammate/, "irrelevant to the renter");
checks++;

// A platform_admin reading for oversight is not a party to either side.
authState = { user: { id: "admin-1", agencyId: null, roles: ["platform_admin"] } };
const adminView = render(ChatPanel, { booking });
assert.doesNotMatch(adminView, /You ·/);
assert.match(adminView, /Cibao Rentals ·/);
assert.match(adminView, /Deimy Pérez ·/);
assert.match(adminView, /which teammate/);
assert.doesNotMatch(adminView, /sent from this tab/, "no composer, no You");
checks++;

// The customer's own payload carries no `customer` ref: degrade to the word.
authState = { user: { id: "staff-1", agencyId: "agency-1", roles: ["agency_staff"] } };
assert.match(
  render(ChatPanel, { booking: { ...booking, customer: undefined } }),
  /Renter ·/,
);
checks++;

console.log(
  `renter-documents: ${checks} render cases passed (fixtures; the cooldown and the nudge are enforced server-side).`,
);
