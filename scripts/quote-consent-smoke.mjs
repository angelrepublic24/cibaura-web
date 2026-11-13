import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";

const require = createRequire(import.meta.url);
const { AxiosError } = require("axios");
const root = process.cwd();
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function loader(mocks = {}, globals = {}, extra = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = fs.readFileSync(file, "utf8") + (extra[file] ?? "");
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
        console,
        setTimeout,
        clearTimeout,
        ...globals,
        require: (id) => {
          if (Object.hasOwn(mocks, id)) return mocks[id];
          if (id.startsWith("@/") || id.startsWith(".")) {
            const base = id.startsWith("@/")
              ? path.join(root, "src", id.slice(2))
              : path.resolve(path.dirname(file), id);
            const target = [base, base + ".ts", base + ".tsx"].find(
              (candidate) =>
                fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
            );
            if (!target) throw new Error("Missing module " + id);
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
function runtime() {
  let active;
  let now = Date.parse("2030-01-01T00:00:00Z");
  let timerId = 0;
  const timers = new Map();
  const same = (a, b) =>
    a &&
    b &&
    a.length === b.length &&
    a.every((value, index) => value === b[index]);
  const react = {
    ...React,
    useState(initial) {
      const target = active,
        index = target.cursor++;
      if (!(index in target.slots))
        target.slots[index] =
          typeof initial === "function" ? initial() : initial;
      return [
        target.slots[index],
        (next) => {
          target.slots[index] =
            typeof next === "function" ? next(target.slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      const index = active.cursor++;
      return (active.slots[index] ??= { current: initial });
    },
    useCallback(callback, deps) {
      const index = active.cursor++;
      if (!same(active.slots[index]?.deps, deps))
        active.slots[index] = { deps, callback };
      return active.slots[index].callback;
    },
    useEffect(effect, deps) {
      const target = active,
        index = target.cursor++;
      if (!same(target.slots[index]?.deps, deps)) {
        const old = target.slots[index];
        target.slots[index] = { deps };
        target.effects.push(() => {
          old?.cleanup?.();
          target.slots[index].cleanup = effect();
        });
      }
    },
  };
  return {
    react,
    globals: {
      Date: class extends Date {
        static now() {
          return now;
        }
      },
      setTimeout: (callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, at: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
    instance: () => ({ slots: [], cursor: 0, effects: [] }),
    render(instance, callback) {
      active = instance;
      instance.cursor = 0;
      const value = callback();
      while (instance.effects.length) instance.effects.shift()();
      active = null;
      return value;
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers])
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
    },
    now: () => now,
  };
}
const pricing = {
  days: 2,
  hostDailyRateCents: 10000,
  renterDailyRateCents: 11500,
  hostDeliveryFeeCents: 0,
  renterDeliveryFeeCents: 0,
  hostSubtotalCents: 20000,
  renterSubtotalCents: 23000,
  commissionPct: 15,
  commissionCents: 3000,
  taxCents: 0,
  taxRatePct: 0,
  totalCents: 23000,
  currency: "USD",
};
const input = {
  carId: "car",
  start: "2030-02-01",
  end: "2030-02-03",
  pickupType: "branch_pickup",
};
const baseContext = () => ({
  input: { ...input },
  userId: "owner",
  card: {
    id: "chosen-card",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2035,
  },
  legalVersion: "version-1",
  materialIdentity: "Original conditions",
});
const makeQuote = (r, token = "quote-1", duration = 10000) => ({
  token,
  expiresAt: new Date(r.now() + duration).toISOString(),
  pricing: { ...pricing },
  depositCents: 50000,
  depositRequired: true,
});
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log("PASS " + name);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
function hookHarness() {
  const r = runtime();
  const instance = r.instance();
  let context = baseContext(),
    quote = makeQuote(r),
    reads = 0,
    refreshResult;
  const load = loader({ react: r.react }, r.globals);
  const useConsent = load(
    "src/modules/bookings/hooks/checkout-consent.hook.ts",
  ).useCheckoutConsent;
  const render = () =>
    r.render(instance, () =>
      useConsent(context, quote, () => {
        reads++;
        return refreshResult;
      }),
    );
  return {
    r,
    load,
    render,
    get context() {
      return context;
    },
    set context(next) {
      context = next;
    },
    get quote() {
      return quote;
    },
    set quote(next) {
      quote = next;
    },
    get reads() {
      return reads;
    },
    set refreshResult(next) {
      refreshResult = next;
    },
    acceptAndOpen() {
      render().setTermsChecked(true);
      assert.equal(render().open(), true);
      return render();
    },
  };
}

await check(
  "Frozen checkout preserves server money, deposit, card and terms across background quote refetch",
  () => {
    const h = hookHarness();
    const opened = h.acceptAndOpen();
    const frozen = opened.snapshot;
    h.quote.pricing.totalCents = 99999;
    h.quote.depositCents = 99999;
    h.quote.token = "newer-offer";
    assert.equal(h.render().snapshot.quote.pricing.totalCents, 23000);
    assert.equal(frozen.quote.depositCents, 50000);
    assert.equal(frozen.quote.token, "quote-1");
    assert.equal(frozen.card.id, "chosen-card");
    assert.equal(frozen.termsVersion, "version-1");
    assert.throws(() => {
      frozen.quote.pricing.totalCents = 1;
    });
  },
);
await check(
  "Input, owner, selected card, terms and material-fact changes clear all consent synchronously",
  async () => {
    for (const change of [
      (c) => ({ ...c, input: { ...c.input, end: "2030-02-04" } }),
      (c) => ({ ...c, userId: "other-owner" }),
      (c) => ({ ...c, card: { ...c.card, id: "other-card" } }),
      (c) => ({ ...c, legalVersion: "version-2" }),
      (c) => ({ ...c, materialIdentity: "New conditions" }),
    ]) {
      const h = hookHarness();
      const opened = h.acceptAndOpen();
      const old = opened.snapshot;
      h.context = change(h.context);
      const changed = h.render();
      assert.equal(changed.snapshot, null);
      assert.equal(changed.acceptedTerms, false);
      assert.equal(opened.isCurrent(old), false);
      await tick();
      assert.equal(h.reads, 1);
    }
  },
);
await check(
  "Accepted terms are the checkbox version; a newer live version cannot be signed implicitly",
  () => {
    const h = hookHarness();
    h.render().setTermsChecked(true);
    h.render();
    h.context = { ...h.context, legalVersion: "version-2" };
    assert.equal(h.render().acceptedTerms, false);
    assert.equal(h.render().open(), false);
  },
);
await check(
  "Quote expiry invalidates signing and refreshes read-only data without a POST",
  async () => {
    const h = hookHarness();
    const old = h.acceptAndOpen().snapshot;
    h.r.advance(10001);
    assert.equal(h.render().snapshot, null);
    assert.equal(h.render().acceptedTerms, false);
    assert.equal(h.render().isCurrent(old), false);
    await tick();
    assert.equal(h.reads, 1);
  },
);
await check(
  "Conflict refresh blocks a new signing snapshot until the latest refresh completes",
  async () => {
    const h = hookHarness();
    const a = deferred(),
      b = deferred();
    h.refreshResult = a.promise;
    h.render().invalidate("Refresh first");
    await tick();
    h.refreshResult = b.promise;
    h.render().invalidate("Refresh latest");
    await tick();
    a.resolve();
    await tick();
    assert.equal(h.render().refreshing, true);
    h.render().setTermsChecked(true);
    assert.equal(h.render().open(), false);
    b.resolve();
    await tick();
    assert.equal(h.render().refreshing, false);
  },
);
await check(
  "Ambiguous outcome locks repeat submit, retains safe own booking route and never leaks it to another owner",
  () => {
    const h = hookHarness();
    const old = h.acceptAndOpen().snapshot;
    h.render().markUncertain(old, "11111111-1111-4111-8111-111111111111");
    assert.ok(h.render().uncertain);
    h.render().setTermsChecked(true);
    assert.equal(h.render().open(), false);
    h.context = { ...h.context, userId: "other-owner" };
    assert.equal(h.render().uncertain, null);
  },
);

const bookingId = "11111111-1111-4111-8111-111111111111";
const booking = {
  id: bookingId,
  car: {
    id: "car",
    make: "Fixture",
    model: "Car",
    year: 2026,
    primaryPhoto: null,
  },
  branch: { id: "branch", name: "Branch" },
  agency: { id: "agency", name: "Agency" },
  period: { start: input.start, end: input.end },
  state: "requested",
  pickup: { type: "branch_pickup", hostDeliveryFeeCents: 0 },
  pricing,
  timestamps: {
    requestedAt: "2030-01-01T00:00:00Z",
    acceptedAt: null,
    pickedUpAt: null,
    returnedAt: null,
    settledAt: null,
    updatedAt: "2030-01-01T00:00:00Z",
  },
  rejectionReason: null,
  cancellationReason: null,
  depositCents: 50000,
  depositRequired: true,
  inspections: [],
  handover: { code: null, codeRequired: true, confirmedAt: null },
  payment: { status: "authorized", clientSecret: null },
  quote: "honored",
};
const sent = [];
let reply = booking,
  failure;
const Api = {
  post: async (url, body) => {
    sent.push({ url, body });
    if (failure) throw failure;
    return { data: reply };
  },
};
const loadService = loader({ "@/shared/api/client": { Api } });
const service = loadService(
  "src/modules/bookings/services/bookings.service.ts",
).bookingsService;
const Unknown = loadService(
  "src/modules/bookings/helpers/checkout-consent.ts",
).BookingOutcomeUnknownError;
const signedInput = {
  ...input,
  paymentMethodId: "chosen-card",
  quoteToken: "quote-token",
  agreementConsentToken: "consent-receipt",
  termsVersion: "version-1",
  signature: { typedName: "Demo Customer" },
};
await check(
  "Actual request service retains both opaque tokens and honored outcome with selected card/terms/signature",
  async () => {
    const result = await service.request(signedInput);
    assert.equal(result.quote, "honored");
    assert.equal(result.pricing.totalCents, 23000);
    assert.deepEqual(plain(sent.at(-1).body), {
      ...signedInput,
      acceptTerms: true,
    });
    const count = sent.length;
    await assert.rejects(
      service.request({ ...signedInput, quoteToken: undefined }),
    );
    assert.equal(sent.length, count);
  },
);
await check(
  "Unexpected or non-honored successful responses become unknown outcomes, never safe retry signals",
  async () => {
    for (const value of [
      undefined,
      "absent",
      "expired",
      "mismatched",
      "invalid",
    ]) {
      reply = { ...booking, quote: value };
      const count = sent.length;
      await assert.rejects(
        service.request(signedInput),
        (error) =>
          error instanceof Unknown &&
          error.bookingId === bookingId &&
          !error.message.includes("not been charged"),
      );
      assert.equal(sent.length, count + 1);
    }
  },
);
await check(
  "Network/5xx request ambiguity is locked while precondition409 stays a coded refusal",
  async () => {
    for (const error of [
      new Error("Network lost"),
      new AxiosError("Server error", undefined, undefined, undefined, {
        status: 500,
      }),
    ]) {
      failure = error;
      await assert.rejects(
        service.request(signedInput),
        (error) => error instanceof Unknown,
      );
    }
    failure = new AxiosError("Reconfirm", undefined, undefined, undefined, {
      status: 409,
      data: { code: "QUOTE_CONFIRMATION_REQUIRED" },
    });
    await assert.rejects(
      service.request(signedInput),
      (error) => error === failure,
    );
    failure = undefined;
  },
);
await check(
  "Preview service transports exact token and accepted version and requires the HMAC receipt fields",
  async () => {
    reply = {
      kind: "rental_agreement",
      version: 1,
      title: "Agreement",
      html: "<p>23000</p>",
      agreementConsentToken: "receipt",
      consentExpiresAt: "2030-01-01T00:10:00Z",
    };
    const preview = await service.agreementPreview({
      ...input,
      quoteToken: "quote-token",
      termsVersion: "version-1",
    });
    assert.equal(preview.agreementConsentToken, "receipt");
    assert.equal(sent.at(-1).body.quoteToken, "quote-token");
    assert.equal(sent.at(-1).body.termsVersion, "version-1");
    reply = { ...reply, agreementConsentToken: undefined };
    await assert.rejects(
      service.agreementPreview({
        ...input,
        quoteToken: "quote-token",
        termsVersion: "version-1",
      }),
    );
  },
);
await check(
  "Actual query keys isolate owner/token/terms; preview background refresh and request retries are disabled",
  () => {
    const load = loader({
      "@tanstack/react-query": {
        useQuery: (options) => options,
        useMutation: (options) => options,
      },
      "@/shared/api/client": { Api },
    });
    const hooks = load("src/modules/bookings/hooks/bookings.hook.ts");
    const a = hooks.useAgreementPreview(
      { ...input, quoteToken: "one", termsVersion: "version-1" },
      "owner",
      true,
    );
    const b = hooks.useAgreementPreview(
      { ...input, quoteToken: "two", termsVersion: "version-1" },
      "owner",
      true,
    );
    const c = hooks.useAgreementPreview(
      { ...input, quoteToken: "one", termsVersion: "version-1" },
      "other",
      true,
    );
    assert.notDeepEqual(plain(a.queryKey), plain(b.queryKey));
    assert.notDeepEqual(plain(a.queryKey), plain(c.queryKey));
    assert.equal(a.retry, false);
    assert.equal(a.refetchOnWindowFocus, false);
    assert.equal(a.refetchOnReconnect, false);
    assert.equal(hooks.useRequestBooking().retry, false);
  },
);

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}
await check(
  "Actual dialog removes consent form on receipt/template replacement and stale signed handlers cannot submit",
  () => {
    const r = runtime(),
      dialogInstance = r.instance(),
      formInstance = r.instance();
    const helper = loader(
      {},
      r.globals,
    )("src/modules/bookings/helpers/checkout-consent.ts");
    const snapshot = helper.freezeCheckout(
      baseContext(),
      makeQuote(r),
      "version-1",
    );
    let preview = {
      kind: "rental_agreement",
      version: 1,
      title: "Agreement",
      html: "<p>Original terms</p>",
      agreementConsentToken: "receipt-one",
      consentExpiresAt: new Date(r.now() + 5000).toISOString(),
    };
    const invalidated = [],
      signed = [],
      defaults = [];
    const load = loader(
      {
        react: r.react,
        "@/modules/bookings/hooks/bookings.hook": {
          useAgreementPreview: () => ({
            data: preview,
            isSuccess: true,
            isFetching: false,
          }),
        },
        "@/shared/auth/store": {
          useAuthStore: (select) =>
            select({ user: { fullName: "Demo Customer" } }),
        },
        "react-hook-form": {
          useForm: (options) => {
            defaults.push(options.defaultValues);
            return {
              formState: { errors: {}, dirtyFields: { typedName: true } },
              register: () => ({}),
              setValue() {},
              handleSubmit: (callback) => () =>
                callback({ typedName: "Demo Customer", acceptAgreement: true }),
            };
          },
        },
      },
      r.globals,
    );
    const component = load(
      "src/modules/bookings/components/rental-agreement-sign-dialog.tsx",
    ).RentalAgreementSignDialog;
    const props = {
      snapshot,
      onClose() {},
      onInvalidated: (message) => invalidated.push(message),
      isCheckoutCurrent: () => true,
      agencyName: "Agency",
      carLabel: "Fixture Car",
      onSign: (...args) => signed.push(args),
      signing: false,
      error: null,
    };
    const render = () => r.render(dialogInstance, () => component(props));
    render();
    const tree = render();
    const formElement = find(
      tree,
      (node) => node.type?.name === "AgreementConsentForm",
    );
    assert.ok(formElement);
    const form = r.render(formInstance, () =>
      formElement.type(formElement.props),
    );
    assert.equal(defaults[0].acceptAgreement, false);
    assert.equal(defaults[0].typedName, "");
    form.props.onSubmit();
    assert.equal(signed.length, 1);
    assert.equal(signed[0][1].agreementConsentToken, "receipt-one");
    preview = {
      ...preview,
      version: 2,
      html: "<p>Changed terms</p>",
      agreementConsentToken: "receipt-two",
    };
    const replaced = render();
    assert.equal(
      find(replaced, (node) => node.type?.name === "AgreementConsentForm"),
      null,
    );
    assert.equal(invalidated.length, 1);
    form.props.onSubmit();
    assert.equal(signed.length, 1);
    assert.equal(invalidated.length, 2);
  },
);
await check(
  "Actual booking callback routes consent conflicts to fresh review and ambiguous results to status checking only",
  async () => {
    const source = fs.readFileSync(
      "src/modules/cars/components/car-detail.tsx",
      "utf8",
    );
    const ast = ts.createSourceFile(
      "car-detail.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let submit;
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "sendRequest")
        submit = node.getText(ast);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(submit);
    const r = runtime();
    const helpers = loader(
      {},
      r.globals,
    )("src/modules/bookings/helpers/checkout-consent.ts");
    const frozen = helpers.freezeCheckout(
      baseContext(),
      makeQuote(r),
      "version-1",
    );
    const calls = [],
      invalidated = [],
      uncertain = [],
      paid = [];
    let current = true,
      owner = true,
      reads = 0;
    const exports = {};
    const globals = {
      exports,
      unexpired: helpers.unexpired,
      BookingOutcomeUnknownError: helpers.BookingOutcomeUnknownError,
      requestInFlight: { current: false },
      consent: {
        snapshot: frozen,
        isCurrent: () => current,
        isOwner: () => owner,
        close() {},
        invalidate: (message) => invalidated.push(message),
        markUncertain: (...args) => uncertain.push(args),
      },
      requestMutation: {
        mutate: (body, options) => calls.push({ body, options }),
      },
      setSubmittedBooking() {},
      payment: { start: (booking) => paid.push(booking) },
      getApiErrorCode: (error) => error.code,
      API_ERROR_CODES: {
        TERMS_OUTDATED: "TERMS_OUTDATED",
        QUOTE_CONFIRMATION_REQUIRED: "QUOTE_CONFIRMATION_REQUIRED",
        AGREEMENT_CONFIRMATION_REQUIRED: "AGREEMENT_CONFIRMATION_REQUIRED",
      },
      legal: {
        refetch: async () => {
          reads++;
        },
      },
    };
    runInNewContext(
      ts.transpileModule("export " + submit, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      globals,
    );
    const signed = {
      signature: { typedName: "Demo Customer" },
      agreementConsentToken: "accepted-receipt",
      consentExpiresAt: new Date(r.now() + 5000).toISOString(),
    };
    for (const code of [
      "QUOTE_CONFIRMATION_REQUIRED",
      "AGREEMENT_CONFIRMATION_REQUIRED",
      "TERMS_OUTDATED",
    ]) {
      exports.sendRequest(signed);
      const call = calls.at(-1);
      assert.equal(call.body.quoteToken, frozen.quote.token);
      assert.equal(call.body.agreementConsentToken, "accepted-receipt");
      assert.equal(call.body.termsVersion, "version-1");
      await call.options.onError({ code });
      call.options.onSettled();
    }
    assert.equal(invalidated.length, 3);
    assert.equal(reads, 3);
    assert.equal(calls.length, 3);
    exports.sendRequest(signed);
    const unknownCall = calls.at(-1);
    await unknownCall.options.onError(
      new helpers.BookingOutcomeUnknownError(bookingId),
    );
    unknownCall.options.onSettled();
    assert.equal(uncertain.length, 1);
    assert.equal(uncertain[0][1], bookingId);
    assert.equal(paid.length, 0);
    assert.equal(calls.length, 4);
    current = false;
    exports.sendRequest(signed);
    assert.equal(calls.length, 4);
    current = true;
    exports.sendRequest(signed);
    owner = false;
    calls.at(-1).options.onSuccess(booking);
    assert.equal(paid.length, 0);
  },
);
console.log(
  `Quote consent: ${checks} real-code runtime/contract groups passed (mock SDK/API/React hook runner; real local HTTP and native UI remain separate).`,
);
