import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();
function loadWith(mocks) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const extra = file.endsWith("verification-panel.tsx")
      ? "\nexport { LicenseDetailsCard };"
      : "";
    const output = ts.transpileModule(readFileSync(file, "utf8") + extra, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(output, { exports, Date, Error, console, require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("@/") || id.startsWith(".")) {
        const base = id.startsWith("@/")
          ? path.join(root, "src", id.slice(2))
          : path.resolve(path.dirname(file), id);
        const target = [base, `${base}.ts`, `${base}.tsx`].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
        if (!target) throw new Error(`Missing module ${id}`);
        return load(target);
      }
      return require(id);
    } });
    return exports;
  }
  return load;
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return (Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)).map(text).join("");
}
let values = { licenseNumber: "QA-12345", licenseExpiry: "2099-12-31" };
let mutation = { isPending: false, isError: false, isSuccess: false, mutate(value) { submitted.push(value); }, reset() {} };
const submitted = [];
let queryData;
const load = loadWith({
  "next/link": { default: "Link" },
  "react-hook-form": { useForm: options => ({
    register: name => ({ name }),
    formState: { errors: {} },
    handleSubmit: callback => async event => {
      event?.preventDefault?.();
      // Run the component's real zod resolver; only the browser/RHF binding is a boundary.
      const result = await options.resolver(values, {}, { criteriaMode: "firstError", shouldUseNativeValidation: false, fields: {} });
      if (!Object.keys(result.errors).length) callback(result.values);
    },
  }) },
  "../hooks/verification.hook": {
    useSubmitVerification: () => mutation,
    useMyVerification: () => ({ data: queryData }),
    useUploadVerificationDocument: () => ({ isPending: false }),
  },
  "@/shared/components/ui/button": { Button: "Button" },
  "./additional-documents-panel": { AdditionalDocumentsPanel: "AdditionalDocumentsPanel" },
});
const { LicenseDetailsCard: Card, VerificationPanel } = load("src/modules/verification/components/verification-panel.tsx");
const verification = { status: "unverified", licenseNumber: null, licenseExpiry: null, dateOfBirth: null, rejectionReason: null, licenseExpired: false, licenseExpiresSoon: false, daysUntilExpiry: null };
const render = record => Card({ verification: record, documents: [] });
const button = tree => find(tree, node => node.type === "Button" && node.props.type === "submit");
const submit = tree => find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

await check("Missing Profile DOB visibly explains disabled submission beside its action", async () => {
  const tree = render(verification);
  assert.equal(button(tree).props.disabled, true);
  assert.equal(button(tree).props["aria-describedby"], "license-submit-requirement");
  const reason = find(tree, node => node.props?.id === "license-submit-requirement");
  assert.match(text(reason), /Add your date of birth in Profile to enable license submission/);
  assert.equal(find(reason, node => node.type === "Link").props.href, "/account/settings/profile");
  await submit(tree);
  assert.equal(submitted.length, 0);
});
await check("Saved Profile DOB enables license details without requiring a new DOB entry", async () => {
  const tree = render({ ...verification, dateOfBirth: "1990-01-01" });
  assert.equal(button(tree).props.disabled, false);
  assert.equal(button(tree).props["aria-describedby"], undefined);
  assert.equal(find(tree, node => node.props?.id === "license-submit-requirement"), undefined);
  await submit(tree);
  assert.deepEqual(JSON.parse(JSON.stringify(submitted.at(-1))), { ...values, dateOfBirth: "1990-01-01" });
  assert.equal(find(tree, node => node.type === "input" && node.props.name === "dateOfBirth"), undefined);
});
await check("Only an in-flight request keeps the DOB-complete button disabled", () => {
  mutation = { ...mutation, isPending: true };
  const tree = render({ ...verification, dateOfBirth: "1990-01-01" });
  assert.equal(button(tree).props.disabled, true);
  assert.match(text(button(tree)), /Submitting/);
  mutation = { ...mutation, isPending: false };
  assert.equal(button(render({ ...verification, dateOfBirth: "1990-01-01" })).props.disabled, false);
});
await check("Invalid or expired dates do not send a request through the actual license resolver", async () => {
  const before = submitted.length;
  for (const licenseExpiry of ["", "2000-01-01"]) {
    values = { licenseNumber: "QA-12345", licenseExpiry };
    await submit(render({ ...verification, dateOfBirth: "1990-01-01" }));
  }
  assert.equal(submitted.length, before);
});
await check("First submission keeps its confirmation when refreshed license details arrive", () => {
  queryData = { verification: { ...verification, dateOfBirth: "1990-01-01" }, documents: [] };
  const before = find(VerificationPanel(), node => node.type === Card);
  const saved = { ...queryData.verification, status: "pending", licenseNumber: "QA-12345", licenseExpiry: "2099-12-31" };
  queryData = { verification: saved, documents: [] };
  const after = find(VerificationPanel(), node => node.type === Card);
  assert.equal(after.type, before.type);
  assert.equal(after.key, before.key, "Refetch must preserve the form's mutation state");
  mutation = { ...mutation, isSuccess: true, data: saved };
  const confirmation = find(render(saved), node => node.props?.role === "status" && /License details saved/.test(text(node)));
  assert.ok(confirmation, "A successful first submission must confirm it was saved");
  mutation = { ...mutation, data: { ...saved, status: "rejected", rejectionReason: "License is expired" } };
  assert.match(text(find(render(saved), node => node.props?.role === "alert")), /License is expired/);
});
console.log(`${checks} license submission runtime checks passed.`);
