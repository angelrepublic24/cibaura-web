import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the production helper itself without loading its unrelated imports.
const file = "src/modules/auth/helpers/auth.helper.ts";
const source = ts.createSourceFile(
  file,
  readFileSync(file, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const helper = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "safeInternalPath",
);
assert(helper, "safeInternalPath must exist");
const exports = {};
runInNewContext(
  ts.transpileModule(helper.getText(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports, URL },
);
const safeInternalPath = exports.safeInternalPath;
const fallback = "/account";
const safe = ["/", "/agency", "/account/bookings/123?tab=chat#last", "/cars/all?country=DO"];
const unsafe = [
  undefined,
  "",
  "https://external.invalid/",
  "//external.invalid/",
  "/\\external.invalid/",
  "/\n/external.invalid/",
  "/\t/external.invalid/",
  "/\r\\external.invalid/",
  "javascript:alert(1)",
];
for (const target of safe) assert.equal(safeInternalPath(target, fallback), target);
for (const target of unsafe) assert.equal(safeInternalPath(target, fallback), fallback);
console.log(`Auth redirect: ${safe.length + unsafe.length} cases passed; normalized external destinations rejected.`);
