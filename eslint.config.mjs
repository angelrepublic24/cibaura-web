import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Type-safety floor. `next/typescript` already loads the
    // `@typescript-eslint` plugin; these promote the escape hatches from
    // "allowed" to "build-breaking" so hand-written types stay honest.
    // All four are syntactic rules — no `parserOptions.project` needed, so
    // lint stays as fast as it is today.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // No escape hatch: the rule's default still allows `@ts-expect-error`
      // when it carries a description, so ban all three outright. Inline
      // disable directives that name @typescript-eslint rules are caught by
      // `npm run lint:suppressions` (scripts/check-type-suppressions.mjs).
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },
];

export default eslintConfig;
