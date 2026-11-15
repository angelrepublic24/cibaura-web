import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
/** Controlled browser/native/API boundaries around actual transpiled source. */
export function sourceLoader(mocks = {}, globals = {}, additions = {}) {
  const root = process.cwd();
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const extra = additions[path.relative(root, file).replaceAll("\\", "/")] ?? "";
    const output = ts.transpileModule(readFileSync(file, "utf8") + extra, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(output, { exports, Date, Error, URL, URLSearchParams, console, ...globals, require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("@/") || id.startsWith(".")) {
        const base = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(file), id);
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
export function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
export function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return (Array.isArray(tree) ? tree : [tree.props?.children].flat(Infinity)).map(text).join("");
}
