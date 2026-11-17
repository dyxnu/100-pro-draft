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
      "public/prototipo/**",
      ".claude/**",
    ],
  },
  {
    // Ícones de campeões vêm do Data Dragon: <img> simples é suficiente.
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default eslintConfig;
