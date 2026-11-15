import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function evaluate(source, dependencies = {}, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, URL, URLSearchParams, ...globals,
    require: (name) => dependencies[name] ?? require(name),
  });
  return exports;
}
const load = (file, dependencies) => evaluate(readFileSync(file, "utf8"), dependencies);
function functions(file, names) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  return ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map((node) => node.getText(ast)).join("\n");
}
const auth = evaluate(functions("src/modules/auth/helpers/auth.helper.ts", ["roleHome", "safeInternalPath"]));
const nav = load("src/shared/helpers/account-navigation.ts");
const routes = load("src/modules/account/helpers/settings-routes.ts");
const authSchemas = load("src/modules/auth/schema/auth.schema.ts");
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const plain = (value) => JSON.parse(JSON.stringify(value));

check("Role homes preserve supplier/admin destinations and send plain customers home", () => {
  for (const [roles, expected] of [
    [["customer"], "/"], [["agency_owner"], "/agency"], [["agency_staff"], "/agency"],
    [["platform_admin"], "/admin"], [["customer", "platform_admin"], "/admin"],
    [["agency_owner", "platform_admin"], "/agency"],
  ]) assert.equal(auth.roleHome({ roles }), expected);
});

function successCallback(file) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (!callback && ts.isPropertyAssignment(node) && node.name.getText(ast) === "onSuccess" && ts.isArrowFunction(node.initializer)) callback = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(callback, `Missing successful-auth callback in ${file}`);
  return `export const run = ${callback.getText(ast)};`;
}
check("Actual login/register success callbacks honor safe next before role defaults", () => {
  for (const file of ["login-form", "register-form"]) {
    const callback = successCallback(`src/modules/auth/components/${file}.tsx`);
    for (const roles of [["customer"], ["agency_owner"], ["platform_admin"]]) {
      for (const next of [undefined, "/account/bookings/test?tab=chat", "/account/settings/documents?next=%2Fcars%2Fall", "https://outside.invalid", "/\n/outside.invalid"]) {
        let signedIn, destination;
        const { run } = evaluate(callback, {}, {
          ...auth, next, signIn: (user) => { signedIn = user; }, router: { push: (href) => { destination = href; } },
        });
        const user = { roles };
        run({ user });
        assert.equal(signedIn, user);
        assert.equal(destination, auth.safeInternalPath(next, auth.roleHome(user)));
      }
    }
  }
});
check("Login requires nonempty password while registration keeps its length policy", () => {
  assert.equal(authSchemas.loginSchema.safeParse({ email: "qa@example.invalid", password: "x" }).success, true);
  assert.equal(authSchemas.loginSchema.safeParse({ email: "qa@example.invalid", password: "" }).success, false);
  const registration = { fullName: "Demo Customer", email: "qa@example.invalid", acceptTerms: true };
  assert.equal(authSchemas.registerSchema.safeParse({ ...registration, password: "1234567", confirmPassword: "1234567" }).success, false);
  assert.equal(authSchemas.registerSchema.safeParse({ ...registration, password: "12345678", confirmPassword: "12345678" }).success, true);
});
check("Avatar uses first/last initials with whitespace and fallback handling", () => {
  for (const [name, email, expected] of [["Demo Customer", undefined, "DC"], ["  Demo Middle Customer  ", undefined, "DC"], ["Ana", undefined, "AN"], ["", "demo@example.invalid", "DE"], [undefined, undefined, "?"], ["José Núñez", undefined, "JN"]]) {
    assert.equal(nav.accountInitials(name, email), expected);
  }
});
check("Hover opens, first click pins, pointer leave does not undo a pinned click", () => {
  let state = nav.accountMenuReducer("closed", "hover");
  assert.equal(state, "hover");
  assert.equal(nav.accountMenuReducer(state, "leave"), "closed");
  state = nav.accountMenuReducer(state, "toggle");
  assert.equal(state, "explicit");
  assert.equal(nav.accountMenuReducer(state, "leave"), "explicit");
  assert.equal(nav.accountMenuReducer(state, "toggle"), "closed");
  assert.equal(nav.accountMenuReducer("closed", "open"), "explicit");
  assert.equal(nav.accountMenuReducer("explicit", "close"), "closed");
});
check("Workspace switches and admin profile routing are role/segment scoped", () => {
  assert.deepEqual(plain(nav.accountWorkspaceLinks("/", ["customer"])), []);
  assert.equal(nav.accountWorkspaceLinks("/", ["agency_owner"])[0].href, "/agency");
  assert.equal(nav.accountWorkspaceLinks("/agency/requests", ["agency_staff"])[0].href, "/");
  assert.equal(nav.accountWorkspaceLinks("/", ["platform_admin"])[0].href, "/admin");
  assert.equal(nav.accountWorkspaceLinks("/admin/orders", ["platform_admin"])[0].href, "/");
  assert.equal(nav.accountWorkspaceLinks("/", ["agency_owner", "platform_admin"]).length, 2);
  assert.equal(nav.accountSettingsHref("/admin/orders", ["platform_admin"]), "/admin/profile");
  assert.equal(nav.accountSettingsHref("/administrator", ["platform_admin"]), nav.ACCOUNT_SETTINGS_PATH);
  assert.equal(nav.accountSettingsHref("/admin/orders", ["customer"]), nav.ACCOUNT_SETTINGS_PATH);
});
check("Legacy route migration preserves next and repeated query values", () => {
  const target = routes.settingsHrefWithQuery("/account/settings/documents", { next: "/cars/all?country=US", tag: ["one", "two"], ignored: undefined });
  const url = new URL(target, "https://local.invalid");
  assert.equal(url.pathname, "/account/settings/documents");
  assert.equal(url.searchParams.get("next"), "/cars/all?country=US");
  assert.deepEqual(url.searchParams.getAll("tag"), ["one", "two"]);
});

const Link = ({ children, ...props }) => React.createElement("a", props, children);
const deps = {
  react: { ...React, useReducer: () => ["explicit", () => {}] },
  "next/link": { default: Link },
  "@/shared/helpers/account-navigation": nav,
  "@/shared/config/support": { SUPPORT_PATH: "/support" },
  "@/modules/auth/hooks/auth.hook": { useLogout: () => () => {} },
};
check("Actual menu markup exposes customer destinations and only authorized workspaces", () => {
  for (const [roles, pathname] of [[["customer"], "/"], [["agency_owner"], "/agency"], [["platform_admin"], "/admin"]]) {
    const { UserMenu } = load("src/shared/components/user-menu.tsx", {
      ...deps, "next/navigation": { usePathname: () => pathname },
      "@/shared/auth/store": { useAuthStore: (select) => select({ user: { fullName: "Demo Customer", email: "qa@example.invalid", roles } }) },
    });
    const html = renderToStaticMarkup(React.createElement(UserMenu));
    assert.match(html, />DC<\/button>/);
    for (const label of ["Rentals", "Favorites", "Settings", "Help &amp; support", "Log out"]) assert(html.includes(label));
    assert(html.includes('href="/account"'));
    assert(html.includes('href="/account/favorites"'));
    assert(html.includes(`href="${nav.accountSettingsHref(pathname, roles)}"`));
    assert.match(html, /aria-haspopup="menu"/);
    assert.match(html, /aria-expanded="true"/);
    if (roles.includes("customer") && roles.length === 1) assert(!html.includes("Switch to"));
  }
});
check("Only Settings renders section navigation; mobile navigation is retained", () => {
  const { default: AccountLayout } = load("src/app/account/layout.tsx", {
    "next/navigation": { usePathname: () => "/account" },
    "@/shared/auth/guard": { RoleGuard: ({ children }) => React.createElement(React.Fragment, null, children) },
  });
  const rental = renderToStaticMarkup(React.createElement(AccountLayout, null, React.createElement("p", null, "Rentals body")));
  assert(!rental.includes("<aside"));
  assert(!rental.includes("<nav"));
  for (const pathname of ["/account/settings/profile", "/account/settings/blocked"]) {
    const { default: SettingsLayout } = load("src/app/account/settings/layout.tsx", {
      "next/link": { default: Link }, "next/navigation": { usePathname: () => pathname },
      "@/shared/auth/store": { useAuthStore: (select) => select({ user: { fullName: "Demo Customer", email: "qa@example.invalid" } }) },
      "@/shared/helpers/account-navigation": nav, "./settings.css": {},
    });
    const html = renderToStaticMarkup(React.createElement(SettingsLayout, null, React.createElement("p", null, "Settings body")));
    for (const label of ["Profile", "Documents", "Payment methods", "Security", "Privacy &amp; account"]) assert(html.includes(label));
    assert(!html.includes("Delete account"));
    assert.match(html, /aria-current="page"/);
    assert.match(html, /settings-nav/);
    assert(!html.includes("max-md:hidden"));
  }
});
console.log(`Customer navigation: ${checks} focused regression groups passed. Reducer/callback and mocked SSR coverage only; native hover/focus/touch remain separate UI verification.`);
