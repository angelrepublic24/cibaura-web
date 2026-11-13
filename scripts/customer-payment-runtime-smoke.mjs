import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function hooks() {
  const slots = [];
  let cursor = 0;
  const effects = [];
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useCallback(callback) { return callback; },
      useEffect(effect, deps) {
        const index = cursor++;
        const previous = slots[index];
        if (!previous || deps.some((dep, i) => dep !== previous[i])) effects.push(effect);
        slots[index] = deps;
      },
    },
    render(component, props) { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; },
  };
}
function evaluate(file, dependencies, extra = "", sourceOverride) {
  const exports = {};
  const source = (sourceOverride ?? readFileSync(file, "utf8")) + extra;
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Date, require: (id) => dependencies[id] ?? require(id) });
  return exports;
}
function walk(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  const children = Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity);
  for (const child of children) { const found = walk(child, predicate); if (found) return found; }
}
const event = { preventDefault() {} };
function cardHarness({ tokenize = async () => ({ paymentMethod: { id: "pm_local_test" } }), saveCard = async () => {}, stripeAvailable = true, elementsAvailable = true, cardAvailable = true, loader = Promise.resolve({}) } = {}) {
  const h = hooks();
  let done = 0, tokenCalls = 0, saveCalls = 0;
  const save = { isPending: false, reset() {}, async mutateAsync(id) { saveCalls++; return saveCard(id); } };
  const cardExports = evaluate("src/modules/payments/components/add-card-form.tsx", {
    react: h.react,
    "@stripe/react-stripe-js": { CardElement: "card-element", Elements: "elements", useStripe: () => stripeAvailable ? { createPaymentMethod: (...args) => { tokenCalls++; return tokenize(...args); } } : null, useElements: () => elementsAvailable ? { getElement: () => cardAvailable ? {} : null } : null },
    "@/modules/payments/helpers/payments.helper": { getStripe: () => loader, stripeTestMode: false },
    "@/modules/payments/hooks/payments.hook": { useAddPaymentMethod: () => save },
    "@/shared/components/ui/button": { Button: "button" },
    "@/shared/api/errors": { getErrorMessage: (error, fallback) => error instanceof Error && error.message ? error.message : fallback },
  }, "\nexport { CardForm };\n");
  const render = () => h.render(cardExports.CardForm, { onDone: () => done++ });
  return { render, outer: () => h.render(cardExports.AddCardForm, { onDone: () => done++ }), stats: () => ({ done, tokenCalls, saveCalls }) };
}
const submitButton = (tree) => walk(tree, (node) => node.type === "button" && node.props?.type === "submit");
const alert = (tree) => walk(tree, (node) => node.props?.role === "alert")?.props.children;

await check("Card tokenization rejection releases loading state and supports retry", async () => {
  let failed = true;
  const h = cardHarness({ tokenize: async () => { if (failed) throw new Error("SDK offline"); return { paymentMethod: { id: "pm_retry" } }; } });
  await h.render().props.onSubmit(event);
  assert.equal(submitButton(h.render()).props.disabled, false);
  assert.equal(alert(h.render()), "SDK offline");
  failed = false;
  await h.render().props.onSubmit(event);
  assert.equal(h.stats().done, 1);
});
await check("Immediate duplicate submissions tokenize and save exactly once, remaining busy through server save", async () => {
  const token = deferred(), saved = deferred();
  const h = cardHarness({ tokenize: () => token.promise, saveCard: () => saved.promise });
  const form = h.render();
  const first = form.props.onSubmit(event);
  await form.props.onSubmit(event);
  assert.equal(h.stats().tokenCalls, 1);
  assert.equal(submitButton(h.render()).props.disabled, true);
  token.resolve({ paymentMethod: { id: "pm_only_token" } });
  await tick();
  await h.render().props.onSubmit(event);
  assert.equal(h.stats().saveCalls, 1);
  assert.equal(h.stats().done, 0);
  assert.equal(submitButton(h.render()).props.disabled, true);
  saved.resolve(); await first;
  assert.equal(h.stats().done, 1);
});
await check("Card validation errors and absent token never call save", async () => {
  for (const result of [{ error: { message: "Incomplete card" } }, {}]) {
    const h = cardHarness({ tokenize: async () => result });
    await h.render().props.onSubmit(event);
    assert.equal(h.stats().saveCalls, 0);
    assert.equal(h.stats().done, 0);
    assert.ok(alert(h.render()));
    assert.equal(submitButton(h.render()).props.disabled, false);
  }
});
await check("Server save errors stay open, show alert and allow retry with gateway token only", async () => {
  let fail = true;
  const h = cardHarness({ saveCard: async (id) => { assert.equal(id, "pm_local_test"); if (fail) throw new Error("Card could not attach"); } });
  await h.render().props.onSubmit(event);
  assert.equal(alert(h.render()), "Card could not attach");
  assert.equal(h.stats().done, 0);
  assert.equal(submitButton(h.render()).props.disabled, false);
  fail = false; await h.render().props.onSubmit(event);
  assert.equal(h.stats().done, 1);
});
await check("Unavailable Stripe/elements/card cannot tokenize or save", async () => {
  for (const opts of [{ stripeAvailable: false }, { elementsAvailable: false }, { cardAvailable: false }]) {
    const h = cardHarness(opts); await h.render().props.onSubmit(event);
    assert.deepEqual(h.stats(), { done: 0, tokenCalls: 0, saveCalls: 0 });
  }
});
await check("Stripe loader loading, null, rejection and ready states are explicit", async () => {
  for (const mode of ["null", "reject", "ready"]) {
    const loader = deferred(); const h = cardHarness({ loader: loader.promise });
    assert.match(JSON.stringify(h.outer()), /Loading payment form/);
    if (mode === "reject") loader.reject(new Error("blocked")); else loader.resolve(mode === "ready" ? {} : null);
    await tick();
    assert.match(JSON.stringify(h.outer()), mode === "ready" ? /elements/ : /payment form could not load/);
  }
});

function paymentHarness({ sdk = async () => ({ handleNextAction: async () => ({}) }), purpose = "booking" } = {}) {
  const h = hooks(); const authorized = []; let poll = {}, now = 0;
  const mockDate = class extends Date { static now() { return now; } };
  const exports = {};
  const source = readFileSync("src/modules/bookings/hooks/request-payment.hook.ts", "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date: mockDate, require: (id) => {
    if (id === "react") return h.react;
    if (id.includes("bookings.hook")) return { useBookingVerificationPoll: () => poll };
    if (id.includes("payments.helper")) return { getStripe: sdk };
    return require(id);
  } });
  return { render: () => h.render(exports.useRequestPayment, { onAuthorized: (id) => authorized.push(id), purpose }), authorized, poll(value, elapsed = 0) { poll = { data: value, dataUpdatedAt: elapsed + 1 }; now = elapsed; } };
}
await check("Authorized and failed creation outcomes bypass Stripe challenge correctly", async () => {
  const h = paymentHarness(); h.render().start({ id: "one", payment: { status: "authorized" } });
  assert.equal(h.render().phase.step, "authorized"); assert.deepEqual(h.authorized, ["one"]);
  h.render().reset(); assert.equal(h.render().phase.step, "idle");
  h.render().start({ id: "two", payment: { status: "failed" } });
  assert.equal(h.render().phase.step, "failed"); assert.equal(h.authorized.length, 1);
});
await check("3DS missing secret, unavailable SDK and SDK/bank rejection leave a recoverable failure", async () => {
  const missing = paymentHarness(); missing.render().start({ id: "one", payment: { status: "requires_action", clientSecret: null } });
  assert.equal(missing.render().phase.step, "failed");
  for (const sdk of [async () => null, async () => { throw new Error("SDK load failed"); }, async () => ({ handleNextAction: async () => { throw new Error("network failed"); } }), async () => ({ handleNextAction: async () => ({ error: { message: "Bank declined" } }) })]) {
    const h = paymentHarness({ sdk });
    h.render().start({ id: "one", payment: { status: "requires_action", clientSecret: "test_secret" } });
    await tick(); assert.equal(h.render().phase.step, "failed"); assert.equal(h.authorized.length, 0);
  }
});
await check("3DS successful next-action waits for server polling; deposit terminal states resolve", async () => {
  const h = paymentHarness({ purpose: "deposit" });
  h.render().startChallenge({ bookingId: "one", clientSecret: "test_secret" });
  await tick(); assert.equal(h.render().phase.step, "verifying"); assert.equal(h.authorized.length, 0);
  h.poll({ id: "one", state: "accepted", deposit: { status: "requires_action" } }, 1000); h.render();
  assert.equal(h.render().phase.step, "verifying");
  h.poll({ id: "one", state: "accepted", deposit: { status: "held" } }, 2000); h.render();
  assert.equal(h.render().phase.step, "authorized"); assert.deepEqual(h.authorized, ["one"]);
});
await check("Verification timeout does not declare payment success", async () => {
  const h = paymentHarness({ purpose: "deposit" }); h.render().startChallenge({ bookingId: "one", clientSecret: "test_secret" }); await tick();
  h.poll({ id: "one", state: "accepted", deposit: { status: "requires_action" } }, 45001); h.render();
  assert.equal(h.render().phase.step, "failed"); assert.equal(h.authorized.length, 0);
});
await check("Delayed booking webhooks and missing payment rows never become authorized after five seconds", async () => {
  for (const payment of [undefined, { status: "requires_action" }]) {
    const h = paymentHarness(); h.render().startChallenge({ bookingId: "one", clientSecret: "test_secret" }); await tick();
    h.poll({ id: "one", state: "requested", payment }, 10000); h.render();
    assert.equal(h.render().phase.step, "verifying"); assert.equal(h.authorized.length, 0);
    h.poll({ id: "one", state: "requested", payment }, 45001); h.render();
    assert.equal(h.render().phase.step, "failed"); assert.equal(h.authorized.length, 0);
    assert.doesNotMatch(h.render().phase.message, /not been charged|not completed|released automatically/);
  }
});
await check("Booking polling requires explicit live authorization and rejects failed, voided, refunded and terminal states", async () => {
  for (const status of ["authorized", "captured", "failed", "capture_failed", "voided", "refunded"]) {
    const h = paymentHarness(); h.render().startChallenge({ bookingId: "one", clientSecret: "test_secret" }); await tick();
    h.poll({ id: "one", state: "requested", payment: { status } }, 10000); h.render();
    const success = ["authorized", "captured"].includes(status);
    assert.equal(h.render().phase.step, success ? "authorized" : "failed");
    assert.equal(h.authorized.length, success ? 1 : 0);
  }
  for (const state of ["rejected", "expired", "cancelled"]) {
    const h = paymentHarness(); h.render().startChallenge({ bookingId: "one", clientSecret: "test_secret" }); await tick();
    h.poll({ id: "one", state, payment: { status: "authorized" } }, 10000); h.render();
    assert.equal(h.render().phase.step, "failed"); assert.equal(h.authorized.length, 0);
  }
});
await check("Actual booking submit callback sends selected card and signed quote once; outdated terms require fresh consent", async () => {
  const file = "src/modules/cars/components/car-detail.tsx";
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let submit;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "sendRequest") submit = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(submit);
  const exports = {}, calls = [], outcomes = [], sign = [], invalidations = [];
  const frozen = { input: { carId: "car", start: "2027-01-02", end: "2027-01-04", pickupType: "delivery", deliveryZoneId: "zone" }, card: { id: "selected-older-card" }, quote: { token: "quoted-token" }, termsVersion: "signed-version", userId: "customer" };
  let refreshed = 0;
  const context = {
    exports, requestInFlight: { current: false },
    consent: { snapshot: frozen, isCurrent: () => true, isOwner: () => true, close: () => sign.push(false), invalidate: (message) => invalidations.push(message) },
    unexpired: () => true, BookingOutcomeUnknownError: class extends Error {},
    requestMutation: { mutate: (body, options) => calls.push({ body, options }) },
    setSubmittedBooking() {},
    payment: { start: (booking) => outcomes.push(booking) },
    getApiErrorCode: (error) => error.code, API_ERROR_CODES: { TERMS_OUTDATED: "TERMS_OUTDATED" },
    legal: { refetch: async () => { refreshed++; } },
  };
  runInNewContext(ts.transpileModule("export " + submit, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const signed = { signature: { typedName: "Demo Customer" }, agreementConsentToken: "preview-receipt", consentExpiresAt: "2030-01-01T00:00:00Z" };
  exports.sendRequest(signed); exports.sendRequest(signed);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.paymentMethodId, "selected-older-card");
  assert.equal(calls[0].body.deliveryZoneId, "zone");
  assert.equal(calls[0].body.termsVersion, "signed-version");
  assert.equal(calls[0].body.quoteToken, "quoted-token");
  assert.equal(calls[0].body.agreementConsentToken, "preview-receipt");
  assert.equal(calls[0].body.signature.typedName, "Demo Customer");
  const outcome = { id: "booking", payment: { status: "requires_action" } };
  calls[0].options.onSuccess(outcome);
  assert.equal(outcomes[0], outcome); assert.equal(sign[0], false);
  calls[0].options.onSettled(); exports.sendRequest(signed);
  assert.equal(calls.length, 2);
  await calls[1].options.onError({ code: "TERMS_OUTDATED" });
  assert.equal(invalidations.length, 1); assert.equal(refreshed, 1);
});
console.log(`${checks} customer payment runtime groups passed (mock Stripe and hook runner; no browser/provider calls).`);
