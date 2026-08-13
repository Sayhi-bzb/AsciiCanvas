import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";

function docsDevRedirect(): Plugin {
  return {
    name: "chardesk-docs-dev-redirect",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url;
        if (
          requestUrl !== "/docs" &&
          !requestUrl?.startsWith("/docs?")
        ) {
          next();
          return;
        }

        response.statusCode = 307;
        response.setHeader("Location", `/docs/${requestUrl.slice(5)}`);
        response.end();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths by default to avoid blank pages on subpath deploys.
  base: process.env.VITE_BASE_PATH || "./",
  plugins: [docsDevRedirect(), react(), tailwindcss()],
  server: {
    proxy: {
      "/docs": {
        target: "http://127.0.0.1:5174",
        ws: true,
      },
    },
  },
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
        replacement: path.resolve(import.meta.dirname, "./packages/fonts/src/index.ts"),
      },
      {
        find: "@chardesk/protocol",
        replacement: path.resolve(
          import.meta.dirname,
          "./packages/protocol/src/index.ts"
        ),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
    ],
  },
});
