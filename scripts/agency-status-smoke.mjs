/** Agency status gate: what each verification state actually renders.
 * Transpile the real components; isolate their UI, data and router deps.
 * Run: node scripts/agency-status-smoke.mjs
 *
 * Guards the owner rule "a pending applicant enters but writes nothing":
 * every surface that could hand a pending applicant a button the backend
 * answers with 403 AGENCY_APPLICATION_UNDER_REVIEW, plus the logo that used
 * to lock an agency person out of the storefront they also rent from.
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
/** Marker component: proves a child surface was chosen, and with which props. */
const marker = (label, read = () => "") =>
  function Marker(props) {
    return React.createElement("p", null, `${label}${read(props)}`);
  };

let authState = null;
let session = null;
/** queryKey → data, or an Error to model a failing read (e.g. a 403). */
let queryData = {};

function queryResult(queryKey) {
  const entry = queryData[queryKey];
  const failed = entry instanceof Error;
  return {
    isSuccess: !failed,
    isLoading: false,
    isError: failed,
    error: failed ? entry : undefined,
    data: failed ? undefined : entry,
  };
}

const mocks = {
  // next
  default: (props) => React.createElement("a", props), // next/link
  usePathname: () => "/agency",
  // data
  useMe: () => ({}),
  useAuthStore: (select) => select(authState),
  useAgencySession: () => session,
  useQuery: ({ queryKey }) => queryResult(queryKey),
  // The surfaces read through module hooks now; each answers from the same
  // keyed fixtures the old `useQuery` stub did.
  useAgencyApplication: () => queryResult("application"),
  useMyAgencyDocuments: () => queryResult("documents"),
  useHostAgreement: () => queryResult("agreement"),
  useFleet: () => queryResult("fleet"),
  useAgencyBranches: () => queryResult("branches"),
  usePermission: () => ({ can: () => true }),
  useAgencyAccessRevokedWatcher: () => undefined,
  isAgencyAccessRevokedError: () => false,
  isRevokedStatus: (status) => status === "rejected" || status === "suspended",
  applyKeys: {
    myDocuments: () => "documents",
    application: () => "application",
  },
  AGENCY_SIGNUP_PATH: "/become-agency",
  HOST_SIGNUP_PATH: "/become-host",
  agencyDocumentTypeLabel: (type) => type,
  formatUploadedDate: () => "12 Mar 2026",
  formatDateTime: () => "12 Mar 2026, 10:00",
  agencyKeys: {
    hostAgreement: () => "agreement",
    fleet: () => "fleet",
    branches: () => "branches",
  },
  useState: React.useState,
  // surfaces whose selection is the thing under test
  AgencyApplicationReview: marker(
    "REVIEW:",
    (p) => `${p.agency.verificationStatus}`,
  ),
  AgencyAccessRevoked: marker("REVOKED:", (p) => `${p.status}:${p.reason}`),
  CarForm: marker("CAR-FORM"),
  LoadingState: marker("LOADING"),
  // leaves
  cn: (...parts) => parts.filter(Boolean).join(" "),
  buttonVariants: () => "btn",
  formatMoneyCents: () => "RD$0",
  getErrorMessage: (_e, fallback) => fallback,
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
      return new Proxy({}, { get: (_t, key) => mocks[key] ?? stub });
    },
  });
  return exports;
}

const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));

// ── /agency route group: one surface per verification status ────────────────

// THE SHELL IS LOADED FOR REAL, not stubbed like every other import.
//
// It draws the console's navigation, so stubbing it would leave this file
// asserting "a verified agency keeps its nav" against a render that has no
// nav in it — the assertion would pass or fail on where the markup happens
// to live rather than on what the agency gets. It is the same reason the
// layout itself is transpiled instead of mocked.
mocks.ConsoleShell = load(
  "src/shared/components/console-shell.tsx",
).ConsoleShell;

const AgencyLayout = load("src/app/agency/layout.tsx").default;
const agency = (verificationStatus, extra = {}) => ({
  id: "agency-1",
  name: "Cibao Rentals",
  kind: "business",
  verificationStatus,
  verificationReason: null,
  hostAgreementSigned: true,
  ...extra,
});
const layoutFor = (status, extra) => {
  session = { isLoading: false, data: { agency: agency(status, extra) } };
  return render(AgencyLayout, {
    children: React.createElement("p", null, "DASHBOARD-CHILD"),
  });
};

// Before the status is known no surface can be chosen — least of all the
// dashboard, which would flash a clickable panel at an applicant.
session = { isLoading: true, data: undefined };
const loading = render(AgencyLayout, {
  children: React.createElement("p", null, "DASHBOARD-CHILD"),
});
assert.match(loading, /LOADING/, "it waits on the session read");
assert.doesNotMatch(
  loading,
  /DASHBOARD-CHILD/,
  "the panel must not render before the verification status is known",
);

const verified = layoutFor("verified");
assert.match(verified, /DASHBOARD-CHILD/, "a verified agency keeps its panel");
assert.match(verified, /Fleet/, "a verified agency keeps its nav");

const pending = layoutFor("pending");
assert.match(pending, /REVIEW:pending/, "a pending applicant gets their file");
assert.doesNotMatch(
  pending,
  /DASHBOARD-CHILD/,
  "a pending applicant must not reach a dashboard page",
);
for (const label of ["Fleet", "Wallet", "Staff", "Settings", "Walk-in"]) {
  assert.doesNotMatch(
    pending,
    new RegExp(label),
    `a pending applicant must not see the ${label} nav item`,
  );
}

// Revoked still wins, and now carries the status so a suspension is not
// described to its owner as a rejected application.
assert.match(
  layoutFor("rejected", { verificationReason: "documents illegible" }),
  /REVOKED:rejected:documents illegible/,
);
assert.match(layoutFor("suspended"), /REVOKED:suspended/);

// ── The review screen itself ────────────────────────────────────────────────

const { AgencyApplicationReview } = load(
  "src/modules/agency/components/application-review.tsx",
);
const reviewWith = (application) => {
  queryData = { application };
  return render(AgencyApplicationReview, { agency: agency("pending") });
};

const file = reviewWith({
  createdAt: "2026-03-12T10:00:00.000Z",
  kyc: {
    legalName: "Cibao Rentals SRL",
    taxId: "1-01-12345-6",
    ownerName: null,
    ownerIdNumber: null,
    phone: null,
    address: null,
  },
  documents: [{ id: "d1", type: "owner_id", uploadedAt: "2026-03-12" }],
  documentCount: 1,
  carDocumentsPending: 0,
});
assert.match(file, /under review/);
assert.match(file, /Cibao Rentals SRL/, "it shows what the applicant sent");
assert.match(file, /owner_id/, "it lists the documents on record");
assert.doesNotMatch(
  file,
  /ownerName|null/,
  "KYC fields the applicant never filled are dropped, not printed empty",
);

// An agency_staff member of a pending agency is refused the file (the payload
// carries the owner's KYC). The screen must degrade, not break — and the way
// back to the storefront survives either way.
const refused = reviewWith(new Error("Forbidden resource"));
assert.match(refused, /under review/, "the status header survives a failed read");
assert.match(
  refused,
  /visible only to the owner/,
  "the refusal is explained in words that mean something to the reader",
);
assert.doesNotMatch(
  refused,
  /Forbidden resource/,
  "the raw server message is never the explanation shown to a human",
);
for (const markup of [file, refused]) {
  assert.match(markup, /Browse cars/, "the customer keeps a way to rent");
  assert.match(markup, /My rentals/);
}

// ── Header: the logo never locks a supplier out of the storefront ───────────

const { SiteHeader } = load("src/shared/components/site-header.tsx");
for (const roles of [["customer"], ["agency_owner"], ["agency_staff"]]) {
  authState = {
    user: { fullName: "A", email: "a@b.c" },
    status: "authenticated",
    hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
  };
  assert.match(
    render(SiteHeader, {}),
    /<a href="\/" aria-label="Cibaura — home"/,
    `the logo must reach the storefront for ${roles.join("+")}`,
  );
}

// ── Host wizard: the first-car step waits for verification ──────────────────

const { MemberSteps } = load(
  "src/modules/agencies/components/host-wizard.tsx",
  "\nexport { MemberSteps };",
);
const wizardFor = (verificationStatus) => {
  session = { isSuccess: true, data: { agency: agency(verificationStatus) } };
  queryData = {
    documents: [{ type: "owner_id" }, { type: "owner_id_back" }],
    agreement: { signed: { id: "c1" }, resignRequired: false },
    fleet: { items: [] },
    branches: [{ id: "branch-1" }],
  };
  return render(MemberSteps, {});
};

const pendingHost = wizardFor("pending");
assert.doesNotMatch(
  pendingHost,
  /CAR-FORM/,
  "a pending host must not be offered a car form the backend refuses",
);
assert.match(pendingHost, /reviewing your application/);
assert.match(
  wizardFor("verified"),
  /CAR-FORM/,
  "a verified host resumes at the first-car step",
);

console.log("agency-status-smoke: OK");
