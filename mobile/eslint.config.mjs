import reactHooks from "eslint-plugin-react-hooks";

/**
 * Narrow on purpose: this exists to catch the one class of bug that gets
 * through typecheck and tests and then crashes on a real device — a hook
 * called conditionally, or after an early return. A screen that renders a
 * loading state first and mounts an effect afterwards changes its hook count
 * between renders, which React turns into a hard crash in a release build.
 */
export default [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parser: (await import("@typescript-eslint/parser")).default,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
