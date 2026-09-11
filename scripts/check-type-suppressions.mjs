// @ts-check
/**
 * Type-safety suppression gate (`npm run lint:suppressions`). Exits 1 and lists
 * file:line for any source file under src/ containing:
 *   - an ESLint directive (disable, disable-line, disable-next-line, block, or
 *     inline rule config) naming an @typescript-eslint rule, or a disable with
 *     no rule list (which silences every rule, typescript-eslint included);
 *   - a TypeScript directive: ts-ignore, ts-expect-error or ts-nocheck.
 * Directives naming only other rules (e.g. @next/next/no-img-element) pass.
 * No dependencies. Usage: node scripts/check-type-suppressions.mjs [dir...]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = /\.[cm]?[jt]sx?$/;
// A directive at the start of a `//` or `/*` comment, as ESLint parses it.
const ESLINT = /(\/\/|\/\*)\s*(eslint(?:-disable(?:-next-line|-line)?)?)(?=[\s*]|$)/g;
// TypeScript matches these by prefix (no word boundary), so do we.
const TS = /@ts-(?:ignore|expect-error|nocheck)/gi;

const args = process.argv.slice(2);
const roots = args.length
  ? args.map((dir) => resolve(dir))
  : [fileURLToPath(new URL('../src', import.meta.url))];

/** @type {string[]} */
const findings = [];
let scanned = 0;
for (const root of roots) {
  for (const entry of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (!SOURCE.test(entry)) continue;
    scanned++;
    const file = join(root, entry);
    const text = readFileSync(file, 'utf8');
    const where = relative(process.cwd(), file).split(sep).join('/');
    /** @param {number} at @param {string} why */
    const report = (at, why) => findings.push(`${where}:${text.slice(0, at).split('\n').length}  ${why}`);
    for (const m of text.matchAll(ESLINT)) {
      const [whole, opener, keyword] = m;
      const from = m.index + whole.length;
      const end = text.indexOf(opener === '//' ? '\n' : '*/', from);
      // The rule list runs to the end of the comment or a ` -- reason` suffix.
      const rules = (text.slice(from, end === -1 ? undefined : end).split(/\s-{2,}\s/)[0] ?? '').trim();
      if (keyword !== 'eslint' && rules === '') report(m.index, `${keyword} with no rule list (silences all rules)`);
      else if (rules.includes('@typescript-eslint/')) report(m.index, `${keyword} names a typescript-eslint rule: ${rules}`);
    }
    for (const m of text.matchAll(TS)) report(m.index, `TypeScript directive ${m[0]}`);
  }
}

if (scanned === 0) {
  console.error(`lint:suppressions: no source files found under ${roots.join(', ')}`);
  process.exit(1);
}
if (findings.length > 0) {
  console.error(`lint:suppressions: ${findings.length} type-safety suppression(s), fix the type instead:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`lint:suppressions: OK, ${scanned} files scanned, no typescript-eslint disables or TS directives`);
