import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();
function loader(mocks = {}, extra = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = readFileSync(file, "utf8") + (extra[file] ?? "");
    runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        Error,
        URL,
        URLSearchParams,
        FormData,
        Blob,
        File,
        console,
        require: (id) => {
          if (Object.hasOwn(mocks, id)) return mocks[id];
          if (id.startsWith("@/") || id.startsWith(".")) {
            const base = id.startsWith("@/")
              ? path.join(root, "src", id.slice(2))
              : path.resolve(path.dirname(file), id);
            const target = [base, base + ".ts", base + ".tsx"].find(
              (item) => existsSync(item) && statSync(item).isFile(),
            );
            if (!target) throw new Error(`Missing module ${id}`);
            return load(target);
          }
          return require(id);
        },
      },
    );
    return exports;
  }
  return load;
}
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log("PASS " + name);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const authWire = {
  id: "customer",
  email: "qa@example.invalid",
  name: "Demo Customer",
  phone: "+18095550100",
  roles: ["customer"],
  agencyId: null,
  status: "active",
  termsVersion: "2026-09-08",
  createdAt: "2026-11-11T00:00:00Z",
};
const profile = {
  ...authWire,
  dateOfBirth: "1990-01-01",
  countryId: null,
  cityId: null,
  marketingOptIn: false,
};
const requests = [];
const request = {
  id: "request",
  customerId: "customer",
  documentType: "identity_card",
  reason: "Synthetic extra review",
  requestedBy: null,
  status: "requested",
  revision: 1,
  submittedRevision: null,
  createdAt: "2026-11-11T00:00:00Z",
  updatedAt: "2026-11-11T00:00:00Z",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  files: [],
  history: [],
};
let response = profile;
const api = Object.fromEntries(
  ["get", "post", "patch", "delete"].map((method) => [
    method,
    async (url, body, config) => {
      requests.push({ method, url, body, config });
      return { data: response };
    },
  ]),
);
const load = loader({ "@/shared/api/client": { Api: api, withSessionBoundary: operation => operation() } });
const auth = load("src/modules/auth/services/auth.service.ts").authService;
const additional = load(
  "src/modules/verification/services/additional-verification.service.ts",
).additionalVerificationService;
const helpers = load(
  "src/modules/verification/helpers/additional-verification.helper.ts",
);

await check(
  "Login retains existing auth DTO; profile separately requires canonical settings fields",
  async () => {
    response = { accessToken: "test", refreshToken: "test", user: authWire };
    assert.equal(
      (await auth.login({ email: authWire.email, password: "x" })).user
        .fullName,
      authWire.name,
    );
    response = authWire;
    await assert.rejects(auth.me());
    response = profile;
    const user = await auth.me();
    assert.equal(user.dateOfBirth, profile.dateOfBirth);
    assert.equal(user.marketingOptIn, false);
  },
);
await check(
  "Marketing-only PATCH never clears profile fields or leaks unknown keys",
  async () => {
    response = { ...profile, marketingOptIn: true };
    await auth.updateMe({ marketingOptIn: true, roles: ["platform_admin"] });
    assert.deepEqual(plain(requests.at(-1).body), { marketingOptIn: true });
  },
);
await check(
  "Profile sends canonical DOB/residence and explicit null clear semantics",
  async () => {
    await auth.updateMe({
      fullName: "New Name",
      phone: null,
      dateOfBirth: "1990-01-01",
      countryId: null,
      cityId: null,
    });
    assert.deepEqual(plain(requests.at(-1).body), {
      name: "New Name",
      phone: null,
      dateOfBirth: "1990-01-01",
      countryId: null,
      cityId: null,
    });
    response = new Blob(['{"schemaVersion":1}']);
    assert.equal(await auth.exportMyData(), response);
    assert.equal(requests.at(-1).url, "/users/me/export");
    assert.equal(requests.at(-1).body.responseType, "blob");
  },
);
await check(
  "Additional upload/submit/review/withdraw carry revision and safe wire DTOs",
  async () => {
    response = request;
    const file = new File(["synthetic"], "test.pdf", {
      type: "application/pdf",
    });
    await additional.upload(request.id, 3, "id_front", file);
    const body = requests.at(-1).body;
    assert.equal(body.get("revision"), "3");
    assert.equal(body.get("slot"), "id_front");
    assert.equal(body.get("file").name, "test.pdf");
    await additional.submit(request.id, 3);
    assert.deepEqual(plain(requests.at(-1).body), { revision: 3 });
    await additional.review(request.id, {
      revision: 3,
      decision: "correction",
      note: "Replace image",
    });
    assert.equal(requests.at(-1).body.revision, 3);
    await additional.withdraw(request.id, 3, "No longer needed");
    assert.deepEqual(plain(requests.at(-1).body), {
      revision: 3,
      reason: "No longer needed",
    });
    await assert.rejects(
      additional.review(request.id, {
        revision: 3,
        decision: "correction",
        note: " ",
      }),
    );
    response = { ...request, revision: "3" };
    await assert.rejects(additional.submit(request.id, 3));
  },
);
const file = (slot, revision) => ({
  id: slot + revision,
  slot,
  revision,
  filename: "synthetic.png",
  contentType: "image/png",
  sizeBytes: 68,
  uploadedAt: request.createdAt,
});
await check(
  "Drafts and older revisions cannot enable submit/review from filenames alone",
  () => {
    assert.equal(helpers.canSubmitAdditional(request), false);
    assert.equal(
      helpers.canSubmitAdditional({ ...request, files: [file("id_front", 1)] }),
      false,
    );
    assert.equal(
      helpers.canSubmitAdditional({
        ...request,
        files: [file("id_front", 1), file("id_back", 1)],
      }),
      true,
    );
    const correction = {
      ...request,
      status: "correction_requested",
      revision: 2,
      submittedRevision: 1,
      files: [file("id_front", 1), file("id_back", 1)],
    };
    assert.equal(helpers.canSubmitAdditional(correction), false);
    assert.equal(helpers.canReviewAdditional(correction), false);
    const submitted = {
      ...request,
      status: "submitted",
      submittedRevision: 1,
      files: [file("id_front", 1), file("id_back", 1)],
    };
    assert.equal(helpers.canSubmitAdditional(submitted), false);
    assert.equal(helpers.canReviewAdditional(submitted), true);
    assert.equal(
      helpers.canReviewAdditional({ ...submitted, submittedRevision: null }),
      false,
    );
    assert.deepEqual(
      plain(helpers.requiredAdditionalSlots({ documentType: "passport" })),
      ["file"],
    );
  },
);

const stub = ({ children }) => React.createElement("div", null, children);
const commonMocks = {
  "next/link": {
    default: ({ children, ...props }) =>
      React.createElement("a", props, children),
  },
  "@/shared/api/client": { Api: api },
  "@/shared/hooks/use-open-signed-url": {
    useOpenSignedUrl: () => ({ open() {}, isPending: false }),
  },
  "@/modules/verification/hooks/additional-verification.hook": {},
  "../hooks/additional-verification.hook": {
    useAdditionalRequests: () => ({ data: [] }),
    useAdditionalAction: () => ({ mutate() {}, isPending: false }),
  },
};
await check(
  "Documents shows license fields and two image slots, no editable DOB or required ID uploads",
  () => {
    const renderLoad = loader({
      ...commonMocks,
      "../hooks/verification.hook": {
        useMyVerification: () => ({
          data: {
            verification: {
              status: "unverified",
              licenseNumber: null,
              licenseExpiry: null,
              dateOfBirth: null,
            },
            documents: [],
          },
        }),
        useSubmitVerification: () => ({ mutate() {} }),
        useUploadVerificationDocument: () => ({ mutate() {} }),
      },
    });
    const panel = renderLoad(
      "src/modules/verification/components/verification-panel.tsx",
    ).VerificationPanel;
    const html = renderToStaticMarkup(React.createElement(panel));
    assert.match(html, /License number/);
    assert.match(html, /Expiration date/);
    assert.match(html, /doc-license_front/);
    assert.match(html, /doc-license_back/);
    assert.doesNotMatch(html, /doc-id_front|doc-id_back|type="date"[^>]*bday/);
    assert.match(html, /href="\/account\/settings\/profile"/);
    assert.match(html, /No additional documents have been requested/);
  },
);
await check(
  "Admin only renders submitted files and review actions stay disabled for private correction drafts",
  () => {
    const draft = {
      ...request,
      status: "correction_requested",
      revision: 2,
      submittedRevision: 1,
      files: [
        file("id_front", 1),
        file("id_back", 1),
        { ...file("id_front", 2), filename: "PRIVATE-DRAFT.png" },
      ],
    };
    const renderLoad = loader({
      ...commonMocks,
      "../hooks/additional-verification.hook": {
        useAdditionalRequests: () => ({ data: [draft] }),
        useAdditionalAction: () => ({ mutate() {}, isPending: false }),
      },
    });
    const component = renderLoad(
      "src/modules/verification/components/additional-documents-admin.tsx",
    ).AdditionalDocumentsAdmin;
    const html = renderToStaticMarkup(
      React.createElement(component, { customerId: "customer" }),
    );
    assert.doesNotMatch(html, /PRIVATE-DRAFT/);
    assert.doesNotMatch(html, /Approve additional documents/);
    assert.match(html, /License verification is independent/);
  },
);
await check(
  "Marketing draft tracks remote preference while pristine and preserves explicit unsaved input",
  () => {
    let cursor = 0;
    const states = [];
    const filePath = path.resolve(
      "src/modules/account/components/privacy-panel.tsx",
    );
    const renderLoad = loader(
      {
        ...commonMocks,
        react: {
          ...React,
          useState: (initial) => {
            const i = cursor++;
            if (!(i in states)) states[i] = initial;
            return [
              states[i],
              (next) => {
                states[i] = next;
              },
            ];
          },
        },
        "@tanstack/react-query": {
          useQueryClient: () => ({ setQueryData() {} }),
        },
        "@/modules/auth/hooks/auth.hook": {
          useUpdateMe: () => ({ mutate() {} }),
          authKeys: { me: () => [] },
        },
        "@/shared/auth/store": {
          useAuthStore: (select) => select({ setUser() {} }),
        },
        "@/modules/auth/components/delete-account-card": {
          DeleteAccountCard: stub,
        },
        "@/modules/bookings/hooks/bookings.hook": {},
        "@/modules/moderation/components/blocked-subjects-panel": {
          BlockedSubjectsPanel: stub,
        },
        "@/modules/moderation/hooks/use-moderation-gate.hook": {},
      },
      { [filePath]: "\nexport { MarketingPreference };" },
    );
    const component = renderLoad(filePath).MarketingPreference;
    const render = (value) => {
      cursor = 0;
      return component({ user: { id: "same-user", marketingOptIn: value } });
    };
    const find = (tree) => {
      if (!tree || typeof tree !== "object") return undefined;
      if (tree.type === "input") return tree;
      for (const child of [tree.props?.children].flat(Infinity)) {
        const found = find(child);
        if (found) return found;
      }
    };
    assert.equal(find(render(false)).props.checked, false);
    assert.equal(find(render(true)).props.checked, true);
    find(render(true)).props.onChange({ target: { checked: false } });
    assert.equal(find(render(true)).props.checked, false);
  },
);
await check(
  "Admin notification deep-link opens independent additional requests without a legacy license row",
  () => {
    const customerId = "11111111-1111-4111-8111-111111111111";
    const { AxiosError } = require("axios");
    const notFound = new AxiosError(
      "No license row",
      undefined,
      undefined,
      undefined,
      { status: 404 },
    );
    const renderLoad = loader({
      "next/navigation": {
        useSearchParams: () => new URLSearchParams({ customerId }),
      },
      "@/shared/auth/guard": {
        RoleGuard: ({ children }) =>
          React.createElement(React.Fragment, null, children),
      },
      "@/modules/verification/components/additional-documents-admin": {
        AdditionalDocumentsAdmin: ({ customerId: id }) =>
          React.createElement(
            "section",
            { "data-additional-customer": id },
            "Additional request actions",
          ),
      },
      "@/modules/verification/hooks/verification.hook": {
        useVerificationQueue: () => ({ data: [] }),
        useVerificationCustomer: () => ({ isError: true, error: notFound }),
        useVerifyCustomer: () => ({}),
        useRejectCustomer: () => ({}),
        useDownloadVerificationDocument: () => ({}),
      },
    });
    const component = renderLoad("src/app/admin/verification/page.tsx").default;
    const html = renderToStaticMarkup(React.createElement(component));
    assert.match(html, /No license submission yet/);
    assert.match(html, new RegExp(`data-additional-customer="${customerId}"`));
    assert.match(html, /value="unverified"/);
  },
);
console.log(
  `Settings: ${checks} contract/runtime groups passed (synthetic API and component props; real HTTP and browser coverage separate).`,
);
