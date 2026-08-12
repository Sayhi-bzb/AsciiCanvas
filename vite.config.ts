import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths by default to avoid blank pages on subpath deploys.
  base: process.env.VITE_BASE_PATH || "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const normalizedId = id.replaceAll("\\", "/");
          if (
            /\/node_modules\/(react|react-dom|scheduler)\//.test(normalizedId)
          ) {
            return "react-vendor";
          }
          if (normalizedId.includes("/node_modules/@radix-ui/")) {
            return "radix-ui";
          }
          if (
            /\/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(
              normalizedId
            )
          ) {
            return "motion";
          }
          if (normalizedId.includes("/node_modules/lucide-react/")) {
            return "icons";
          }
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@chardesk\/fonts$/,
        replacement: path.resolve(__dirname, "./packages/fonts/src/index.ts"),
      },
      {
        find: "@chardesk/protocol",
        replacement: path.resolve(
          __dirname,
          "./packages/protocol/src/index.ts"
        ),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
