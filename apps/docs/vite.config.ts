import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "app"
);

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/docs/" : undefined,
  plugins: [fumadocsMdx(), tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "@": appDirectory,
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
    ],
  },
  ssr: {
    noExternal: [
      "fumadocs-core",
      "fumadocs-ui",
      "@fumadocs/base-ui",
    ],
  },
}));
