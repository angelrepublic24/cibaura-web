import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}
function hooks() {
  const slots = [];
  let cursor = 0;
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
      },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useEffect() {},
    },
    render(component, props) { cursor = 0; return component(props); },
  };
}
function evaluate(file, dependencies, extra = "", globals = {}) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(file, "utf8") + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, { exports, Error, Date, ...globals, require(id) {
    if (dependencies[id]) return dependencies[id];
    if (!id.startsWith("@/")) return require(id);
    return new Proxy({}, { get(_target, key) { return String(key); } });
  }});
  return exports;
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return (Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)).map(text).join("");
}

await check("Auth guard has identical SSR and first-client markup regardless of browser session marker", () => {
  let me = { isLoading: false, isError: false }, status = "unknown";
  const { RedirectIfAuthenticated } = evaluate("src/modules/auth/components/redirect-if-authenticated.tsx", {
    react: { useEffect() {} },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/modules/auth/hooks/auth.hook": { useMe: () => me },
    "@/shared/auth/store": { useAuthStore: selector => selector({ status, user: null }) },
    "@/shared/components/states": {
      LoadingState: ({ label }) => require("react").createElement("div", { role: "status" }, label),
      ErrorState: "section",
    },
    "@/shared/api/errors": { getErrorMessage: error => error.message },
  });
  const props = { children: require("react").createElement("form", { id: "login" }) };
  const server = renderToStaticMarkup(RedirectIfAuthenticated(props));
  me = { isLoading: true, isError: false };
  const firstClient = renderToStaticMarkup(RedirectIfAuthenticated(props));
  assert.equal(server, firstClient);
  assert.ok(server.includes("Checking session"));
  assert.ok(!server.includes("<form"));
  me = { isLoading: false, isError: true, error: new Error("offline"), refetch() {} };
  const errorTree = RedirectIfAuthenticated(props);
  assert.equal(errorTree.props.title, "Could not check your session");
  assert.equal(errorTree.props.message, "offline");
  status = "guest";
  assert.ok(renderToStaticMarkup(RedirectIfAuthenticated(props)).includes('id="login"'));
});

await check("Payment outer Close cannot unmount busy card form, including a click before rerender", async () => {
  for (const fail of [false, true]) {
    const parent = hooks();
    const panel = evaluate("src/modules/payments/components/payment-methods-panel.tsx", {
      react: parent.react,
      "@/modules/payments/hooks/payments.hook": {
        useMyPaymentMethods: () => ({ isLoading: false, isError: false, data: [] }),
        useRemovePaymentMethod: () => ({ isPending: false }),
      },
      "@/modules/payments/helpers/payments.helper": { stripeConfigured: true },
    }).PaymentMethodsPanel;
    let tree = parent.render(panel);
    find(tree, n => n.type === "Button" && n.props.children === "Add card").props.onClick();
    tree = parent.render(panel);
    const staleClose = find(tree, n => n.type === "Button" && n.props.children === "Close");
    const childProps = find(tree, n => n.type === "AddCardForm").props;
    let resolveToken, saves = 0, tokenizations = 0;
    const token = new Promise(resolve => { resolveToken = resolve; });
    const child = hooks();
    const card = evaluate("src/modules/payments/components/add-card-form.tsx", {
      react: child.react,
      "@stripe/react-stripe-js": { CardElement: "CardElement", useStripe: () => ({ createPaymentMethod() { tokenizations++; return token; } }), useElements: () => ({ getElement: () => ({}) }) },
      "@/modules/payments/helpers/payments.helper": { getStripe: () => Promise.resolve({}), stripeTestMode: false },
      "@/modules/payments/hooks/payments.hook": { useAddPaymentMethod: () => ({ isPending: false, reset() {}, async mutateAsync() { saves++; if (fail) throw new Error("save failed"); } }) },
      "@/shared/api/errors": { getErrorMessage: error => error.message },
    }, "\nexport { CardForm };").CardForm;
    const childTree = child.render(card, childProps);
    const pending = childTree.props.onSubmit({ preventDefault() {} });
    staleClose.props.onClick();
    tree = parent.render(panel);
    assert.ok(find(tree, n => n.type === "AddCardForm"));
    assert.equal(find(tree, n => n.type === "Button" && n.props.children === "Close").props.disabled, true);
    await childTree.props.onSubmit({ preventDefault() {} });
    assert.equal(tokenizations, 1);
    resolveToken({ paymentMethod: { id: "pm_synthetic" } });
    await pending;
    assert.equal(saves, 1);
    tree = parent.render(panel);
    if (fail) {
      const close = find(tree, n => n.type === "Button" && n.props.children === "Close");
      assert.equal(close.props.disabled, false);
      close.props.onClick();
      assert.equal(find(parent.render(panel), n => n.type === "AddCardForm"), undefined);
    } else assert.equal(find(tree, n => n.type === "AddCardForm"), undefined);
  }
});

await check("Failed inspection URLs remain honest but refreshed photo/video URLs recover", () => {
  for (const kind of ["photo", "video"]) {
    const h = hooks();
    const thumb = evaluate("src/modules/bookings/components/inspection-media-viewer.tsx", {
      react: h.react,
      "@/shared/utils/lifecycle-labels": { mediaLabelText: value => value },
    }, "\nexport { MediaThumb };").MediaThumb;
    const item = { id: "same", kind, label: "front", url: "https://example.invalid/old" };
    const tag = kind === "photo" ? "img" : "video";
    const first = h.render(thumb, { item });
    find(first, n => n.type === tag).props.onError();
    assert.ok(text(h.render(thumb, { item })).includes("Link expired"));
    const recovered = h.render(thumb, { item: { ...item, url: "https://example.invalid/new" } });
    assert.equal(find(recovered, n => n.type === tag).props.src, "https://example.invalid/new");
    assert.ok(text(h.render(thumb, { item: { ...item, url: null } })).includes("Not available"));
  }
});

await check("Review read errors require retry; confirmed absence enables create and cached reviews remain visible", async () => {
  const h = hooks();
  let retries = 0;
  let query = { isLoading: false, isError: true, error: new Error("offline"), refetch() { retries++; } };
  const section = evaluate("src/modules/bookings/components/booking-detail.tsx", {
    react: h.react,
    "@/modules/agencies/hooks/agencies.hook": { useReviewForBooking: () => query, useCreateReview: () => ({ isPending: false, isError: false }) },
    "@/shared/api/errors": { getErrorMessage: error => error.message },
  }, "\nexport { ReviewSection };").ReviewSection;
  const props = { booking: { id: "synthetic", state: "settled", agency: { name: "Host" } } };
  let tree = h.render(section, props);
  assert.equal(find(tree, n => n.type === "form"), undefined);
  const error = find(tree, n => n.type === "ErrorState");
  assert.equal(error.props.message, "offline");
  await error.props.onRetry();
  assert.equal(retries, 1);
  query = { ...query, isError: false, data: null };
  assert.ok(find(h.render(section, props), n => n.type === "form"));
  query = { ...query, isError: true, data: { rating: 5, comment: "Saved review" } };
  tree = h.render(section, props);
  assert.equal(find(tree, n => n.type === "form"), undefined);
  assert.ok(text(tree).includes("Saved review"));
});

await check("Password change/reset clear local auth only on success; change returns to login without refresh", async () => {
  let signedOut = 0, navigated = [], changes = 0, resets = 0;
  const auth = evaluate("src/modules/auth/hooks/auth.hook.ts", {
    "@tanstack/react-query": { useMutation: options => options },
    "@/shared/auth/store": { useAuthStore: selector => selector({ signOut() { signedOut++; } }) },
    "@/modules/auth/services/auth.service": { authService: { async changePassword() { changes++; }, async resetPassword() { resets++; } } },
  }, "", { window: { location: { replace: target => navigated.push(target) } } });
  const change = auth.useChangePassword();
  await change.mutationFn({ currentPassword: "old", newPassword: "new" });
  assert.equal(changes, 1);
  assert.equal(signedOut, 0);
  assert.equal(change.onError, undefined);
  change.onSuccess();
  assert.equal(signedOut, 1);
  assert.deepEqual(navigated, ["/auth/login"]);
  const reset = auth.useResetPassword();
  await reset.mutationFn({ token: "synthetic", password: "new", termsVersion: "current" });
  assert.equal(resets, 1);
  assert.equal(signedOut, 1);
  reset.onSuccess();
  assert.equal(signedOut, 2);
  assert.deepEqual(navigated, ["/auth/login"]);
});
await check("Late /me results cannot rehydrate a signed-out or replacement session and receive cancellation signal", async () => {
  let generation = 0, marker = true, resolveMe, captured, receivedSignal;
  let query = { isSuccess: false, isError: false };
  const effects = [], mirrored = [];
  const { CancelledError } = require("@tanstack/react-query");
  const auth = evaluate("src/modules/auth/hooks/auth.hook.ts", {
    react: { useEffect: effect => effects.push(effect) },
    "@tanstack/react-query": { CancelledError, useQuery: options => { captured = options; return query; } },
    "@/shared/auth/store": { useAuthStore: selector => selector({ setUser: user => mirrored.push(user) }) },
    "@/shared/auth/token": { hasUserMarker: () => marker, getSessionGeneration: () => generation },
    "@/modules/auth/services/auth.service": { authService: { me(signal) { receivedSignal = signal; return new Promise(resolve => { resolveMe = resolve; }); } } },
  });
  auth.useMe();
  effects.shift()();
  const controller = new AbortController();
  const oldMe = captured.queryFn({ signal: controller.signal });
  assert.equal(receivedSignal, controller.signal);
  generation++;
  marker = false;
  resolveMe({ id: "old-user" });
  await assert.rejects(oldMe, error => error instanceof CancelledError);
  // A previously scheduled success effect must also consult the live marker.
  marker = true;
  query = { isSuccess: true, isError: false, data: { id: "old-user" } };
  auth.useMe();
  marker = false;
  effects.shift()();
  assert.equal(mirrored.at(-1), null);
  const beforeReplacement = mirrored.length;
  marker = true;
  auth.useMe();
  generation++;
  effects.shift()();
  assert.equal(mirrored.length, beforeReplacement);
  auth.useMe();
  const beforeNewLogin = captured.queryFn({ signal: controller.signal });
  generation++;
  resolveMe({ id: "old-user" });
  await assert.rejects(beforeNewLogin, error => error instanceof CancelledError);
});

await check("Real Axios interceptors never replay old-session requests or sign out a replacement after delayed refresh", async () => {
  const axios = require("axios");
  let generation = 0, signOuts = 0, protectedCalls = 0, refreshCalls = 0, releaseRefresh;
  const client = evaluate("src/shared/api/client.ts", {
    "@/lib/config": { API_URL: "http://api.example.invalid/api" },
    "@/shared/auth/token": { getSessionGeneration: () => generation },
    "@/shared/auth/store": { useAuthStore: { getState: () => ({ status: "authenticated", signOut() { signOuts++; } }) } },
  }, "\nexport { RefreshClient };");
  client.Api.defaults.adapter = async config => {
    protectedCalls++;
    const response = { status: 401, statusText: "Unauthorized", data: {}, headers: {}, config };
    throw new axios.AxiosError("expired", "ERR_BAD_REQUEST", config, null, response);
  };
  client.RefreshClient.defaults.adapter = config => {
    refreshCalls++;
    return new Promise(resolve => { releaseRefresh = () => resolve({ status: 200, statusText: "OK", data: {}, headers: {}, config }); });
  };
  const pending = client.Api.get("/users/me");
  const rejected = assert.rejects(pending);
  while (!releaseRefresh) await new Promise(resolve => setImmediate(resolve));
  generation++;
  releaseRefresh();
  await rejected;
  assert.equal(refreshCalls, 1);
  assert.equal(protectedCalls, 1);
  assert.equal(signOuts, 0);
  // A401 arriving after the boundary must not start refresh at all.
  let rejectOld;
  client.Api.defaults.adapter = config => new Promise((_resolve, reject) => {
    rejectOld = () => reject(new axios.AxiosError("old401", "ERR_BAD_REQUEST", config, null, { status: 401, data: {}, headers: {}, config }));
  });
  const old = client.Api.get("/bookings/mine");
  const oldRejected = assert.rejects(old);
  while (!rejectOld) await new Promise(resolve => setImmediate(resolve));
  generation++;
  rejectOld();
  await oldRejected;
  assert.equal(refreshCalls, 1);
  assert.equal(signOuts, 0);
  client.Api.defaults.adapter = async config => {
    throw new axios.AxiosError("wrong password", "ERR_BAD_REQUEST", config, null, {
      status: 401, data: { code: "PASSWORD_INCORRECT", message: "wrong password" }, headers: {}, config,
    });
  };
  await assert.rejects(client.Api.patch("/auth/change-password", {}), error => error.response.data.code === "PASSWORD_INCORRECT");
  assert.equal(refreshCalls, 1);
  assert.equal(signOuts, 0);
  let freshCalls = 0;
  client.Api.defaults.adapter = async config => {
    freshCalls++;
    if (freshCalls === 1) throw new axios.AxiosError("expired", "ERR_BAD_REQUEST", config, null, { status: 401, data: {}, headers: {}, config });
    return { status: 200, statusText: "OK", data: { id: "current-user" }, headers: {}, config };
  };
  client.RefreshClient.defaults.adapter = async config => {
    refreshCalls++;
    return { status: 200, statusText: "OK", data: {}, headers: {}, config };
  };
  const current = await client.Api.get("/users/me");
  assert.equal(current.data.id, "current-user");
  assert.equal(freshCalls, 2);
  assert.equal(refreshCalls, 2);
  assert.equal(signOuts, 0);
});
await check("Auth boundary drains refresh Set-Cookie before credential call, serializes calls and blocks new refresh", async () => {
  const axios = require("axios");
  for (const httpFailure of [false, true]) {
    let generation = 0, refreshCalls = 0, credentialCalls = 0, signOuts = 0, settleRefresh, finishFirst;
    const events = [];
    const client = evaluate("src/shared/api/client.ts", {
      "@/lib/config": { API_URL: "http://api.example.invalid/api" },
      "@/shared/auth/token": { getSessionGeneration: () => generation, advanceSessionGeneration: () => { generation++; } },
      "@/shared/auth/store": { useAuthStore: { getState: () => ({ status: "authenticated", signOut() { signOuts++; } }) } },
    }, "\nexport { RefreshClient };");
    assert.equal(client.RefreshClient.defaults.timeout, 20_000);
    client.Api.defaults.adapter = config => {
      if (config.url.startsWith("/auth/")) {
        credentialCalls++;
        events.push(config.url);
        if (config.url === "/auth/login") return new Promise(resolve => { finishFirst = () => resolve({ status: 200, data: {}, headers: {}, config }); });
        return Promise.resolve({ status: 204, data: {}, headers: {}, config });
      }
      return Promise.reject(new axios.AxiosError("expired", "ERR_BAD_REQUEST", config, null, { status: 401, data: {}, headers: {}, config }));
    };
    client.RefreshClient.defaults.adapter = config => {
      refreshCalls++;
      return new Promise((resolve, reject) => { settleRefresh = () => {
        // Simulates browser cookie processing BEFORE the response settles.
        events.push("old-refresh-Set-Cookie");
        const response = { status: httpFailure ? 500 : 200, data: {}, headers: {}, config };
        if (httpFailure) reject(new axios.AxiosError("server error", "ERR_BAD_RESPONSE", config, null, response));
        else resolve(response);
      }; });
    };
    const old = assert.rejects(client.Api.get("/users/me"));
    while (!settleRefresh) await new Promise(resolve => setImmediate(resolve));
    const first = client.withSessionBoundary(() => client.Api.post("/auth/login", {}));
    const second = client.withSessionBoundary(() => client.Api.post("/auth/register", {}));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(credentialCalls, 0);
    await assert.rejects(client.Api.get("/bookings/mine"));
    assert.equal(refreshCalls, 1);
    settleRefresh();
    while (!finishFirst) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ["old-refresh-Set-Cookie", "/auth/login"]);
    assert.equal(credentialCalls, 1);
    finishFirst();
    await Promise.all([old, first, second]);
    assert.deepEqual(events, ["old-refresh-Set-Cookie", "/auth/login", "/auth/register"]);
    assert.equal(signOuts, 0);
    client.Api.defaults.adapter = async config => {
      throw new axios.AxiosError("wrong password", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: { code: "PASSWORD_INCORRECT" }, headers: {}, config,
      });
    };
    await assert.rejects(client.withSessionBoundary(() => client.Api.patch("/auth/change-password", {})), error => error.response.data.code === "PASSWORD_INCORRECT");
    let released = false;
    await client.withSessionBoundary(async () => { released = true; });
    assert.equal(released, true);
    assert.equal(signOuts, 0);
    assert.equal(refreshCalls, 1);
  }
});

await check("Actual auth service routes all five cookie-changing actions through the transport boundary", async () => {
  let inside = false, boundaries = 0;
  const calls = [];
  const api = Object.fromEntries(["post", "patch"].map(method => [method, async (url) => {
    assert.equal(inside, true, `${url} bypassed session boundary`);
    calls.push(`${method} ${url}`);
    return { data: { user: { id: "synthetic" } } };
  }]));
  const service = evaluate("src/modules/auth/services/auth.service.ts", {
    "@/shared/api/client": { Api: api, async withSessionBoundary(operation) {
      boundaries++;
      inside = true;
      try { return await operation(); } finally { inside = false; }
    } },
    "@/modules/auth/schema/auth.schema": { authResultWireSchema: { parse: data => data } },
    "@/modules/auth/helpers/auth.helper": { toUser: user => user },
  }).authService;
  await service.login({ email: "synthetic@example.invalid", password: "test" });
  await service.register({ email: "synthetic@example.invalid", password: "test", fullName: "Synthetic", termsVersion: "current" });
  await service.logout();
  await service.resetPassword({ token: "synthetic", password: "test", termsVersion: "current" });
  await service.changePassword({ currentPassword: "old", newPassword: "new" });
  assert.equal(boundaries, 5);
  assert.deepEqual(calls, ["post /auth/login", "post /auth/register", "post /auth/logout", "post /auth/reset-password", "patch /auth/change-password"]);
});

await check("Uncertain refresh transport rejects credential boundary without sending credentials; requires reload", async () => {
  const axios = require("axios");
  let generation = 0, settleRefresh, credentials = 0;
  const client = evaluate("src/shared/api/client.ts", {
    "@/lib/config": { API_URL: "http://api.example.invalid/api" },
    "@/shared/auth/token": { getSessionGeneration: () => generation, advanceSessionGeneration: () => { generation++; } },
    "@/shared/auth/store": { useAuthStore: { getState: () => ({ status: "guest" }) } },
  }, "\nexport { RefreshClient };");
  client.Api.defaults.adapter = async config => {
    throw new axios.AxiosError("expired", "ERR_BAD_REQUEST", config, null, { status: 401, data: {}, headers: {}, config });
  };
  client.RefreshClient.defaults.adapter = config => new Promise((_resolve, reject) => {
    settleRefresh = () => reject(new axios.AxiosError("timeout", "ECONNABORTED", config));
  });
  const old = assert.rejects(client.Api.get("/users/me"));
  while (!settleRefresh) await new Promise(resolve => setImmediate(resolve));
  const auth = assert.rejects(client.withSessionBoundary(async () => { credentials++; }), /Reload this page/);
  settleRefresh();
  await Promise.all([old, auth]);
  assert.equal(credentials, 0);
  await assert.rejects(client.withSessionBoundary(async () => { credentials++; }), /Reload this page/);
  assert.equal(credentials, 0);
});
console.log(`Customer edge runtime: ${checks} groups passed. Controlled component/hook execution, not browser or provider E2E.`);
