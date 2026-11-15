import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const component = file.endsWith("new-car-form.tsx");
  const source = readFileSync(file, "utf8") + (component
    ? "\nexports.formInternals = { carFormSchema, defaultsFor, toCarFields };"
    : "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    exports, console,
    require: (name) => {
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      // Only form validation/defaults/mapping execute, so UI hooks need no
      // network or React renderer. The schemas and their dependencies are real.
      if (component && ![
        "@/modules/agency/schema/agency.schema",
        "@/shared/types/domain",
        "@/shared/utils/money",
      ].includes(name)) return {};
      const base = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      const target = [base + ".ts", path.join(base, "index.ts")].find(existsSync);
      assert(target, `Missing dependency ${name}`);
      return load(target);
    },
  });
  return exports;
}

const api = load("src/modules/agency/schema/agency.schema.ts");
const { formInternals: form } = load("src/modules/agency/components/new-car-form.tsx");
const values = {
  branchId: "branch", makeId: "make", modelId: "model", year: "2026",
  color: "white", transmission: "automatic", fuel: "gasoline", seats: "5",
  category: "luxury", plate: "Q123456", pricePerDay: "75.50",
  depositMode: "inherit", depositAmount: "", engineDisplacementCc: "", enginePowerHp: "",
};
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const plain = value => JSON.parse(JSON.stringify(value));

check("Luxury/exotic/sedan drafts can leave both engine fields blank", () => {
  for (const category of ["luxury", "exotic", "sedan"]) {
    const parsed = form.carFormSchema.parse({ ...values, category });
    const fields = form.toCarFields(parsed);
    assert.equal(fields.engineDisplacementCc, null);
    assert.equal(fields.enginePowerHp, null);
  }
});
check("Form rejects half-pairs, decimals, scientific notation and out-of-range values", () => {
  for (const [cc, hp] of [
    ["3000", ""], ["", "350"], ["599", "350"], ["9001", "350"],
    ["3000", "19"], ["3000", "2001"], ["3000.5", "350"],
    ["3000", "350.5"], ["3e3", "350"], ["abc", "350"],
  ]) assert.equal(form.carFormSchema.safeParse({ ...values, engineDisplacementCc: cc, enginePowerHp: hp }).success, false, `${cc}/${hp}`);
});
check("Exact server bounds and surrounding whitespace are accepted", () => {
  for (const [cc, hp] of [["600", "20"], ["9000", "2000"], [" 1998 ", " 150 "]]) {
    const parsed = form.carFormSchema.parse({ ...values, engineDisplacementCc: cc, enginePowerHp: hp });
    const fields = form.toCarFields(parsed);
    assert.equal(fields.engineDisplacementCc, Number(cc));
    assert.equal(fields.enginePowerHp, Number(hp));
  }
});
check("Create service schema retains both mapped engine fields instead of stripping them", () => {
  const fields = form.toCarFields(form.carFormSchema.parse({ ...values, engineDisplacementCc: "2981", enginePowerHp: "450" }));
  const sent = api.createCarInputSchema.parse({ ...fields, branchId: values.branchId });
  assert.equal(sent.engineDisplacementCc, 2981);
  assert.equal(sent.enginePowerHp, 450);
});
check("Edit defaults retain canonical engine values and unrelated saves resend them", () => {
  const car = {
    ...form.toCarFields(form.carFormSchema.parse(values)), branchId: "branch",
    engine: { displacementCc: 2981, displacementL: 3, powerHp: 450 },
    hostDailyRateCents: 7550, depositOverrideCents: null,
  };
  const defaults = form.defaultsFor(car);
  assert.equal(defaults.engineDisplacementCc, "2981");
  assert.equal(defaults.enginePowerHp, "450");
  const sent = api.updateCarInputSchema.parse(form.toCarFields(form.carFormSchema.parse({ ...defaults, color: "black" })));
  assert.equal(sent.engineDisplacementCc, 2981);
  assert.equal(sent.enginePowerHp, 450);
});
check("Clearing both edit inputs sends explicit nulls, not missing properties", () => {
  const sent = api.updateCarInputSchema.parse(form.toCarFields(form.carFormSchema.parse(values)));
  assert(Object.hasOwn(sent, "engineDisplacementCc"));
  assert(Object.hasOwn(sent, "enginePowerHp"));
  assert.equal(sent.engineDisplacementCc, null);
  assert.equal(sent.enginePowerHp, null);
});
check("Input schemas reject invalid numeric bounds and half-pair creation", () => {
  const payload = { ...form.toCarFields(form.carFormSchema.parse(values)), branchId: "branch" };
  assert.equal(api.createCarInputSchema.safeParse({ ...payload, engineDisplacementCc: 3000 }).success, false);
  for (const patch of [{ engineDisplacementCc: 599 }, { engineDisplacementCc: 9001 }, { enginePowerHp: 19 }, { enginePowerHp: 2001 }, { enginePowerHp: 150.5 }]) {
    assert.equal(api.updateCarInputSchema.safeParse(patch).success, false);
  }
  // A partial API edit may retain the other stored figure; the server checks
  // the merged pair. The form above always supplies both of its input values.
  assert.deepEqual(plain(api.updateCarInputSchema.parse({ enginePowerHp: 451 })), { enginePowerHp: 451 });
});
console.log(`Car engine: ${checks} regression groups passed (actual form validators/defaults/mappers and service schemas).`);
