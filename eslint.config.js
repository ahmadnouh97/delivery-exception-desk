import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({ ignores: ["**/dist/"] }, js.configs.recommended, {
  files: ["**/*.{ts,tsx}"],
  extends: [tseslint.configs.recommended],
});
