// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // src/generated is the Prisma client output (gitignored, produced by `prisma generate`).
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "src/generated/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "module",
    },
    rules: {
      // Leading-underscore args/vars are intentionally unused (e.g. interface signatures).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // `@Req() req: any` / Prisma `where: any` builders are common here; surface them without failing CI.
      "@typescript-eslint/no-explicit-any": "warn",
      // `catch {}` is used deliberately for best-effort lookups (e.g. optional session).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["test/**/*.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // Tests use `any` for mocks and `require()` inside jest.isolateModules / after jest.resetModules.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
