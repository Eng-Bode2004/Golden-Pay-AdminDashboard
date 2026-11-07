import { copyFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The head office dashboard: its own entry page, port and build folder, sharing
 * the workspace's sign-in, design system and translations.
 */
const officeEntry = (): Plugin => {
  let outDir = join(__dirname, "dist-headoffice");
  return {
    name: "golden-pay-head-office-entry",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      // Any page address that is not a file opens the head office app.
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split("?")[0] ?? "/";
        if (req.headers.accept?.includes("text/html") && !path.includes(".")) req.url = "/headoffice.html";
        next();
      });
    },
    async closeBundle() {
      await rename(join(outDir, "headoffice.html"), join(outDir, "index.html")).catch(() => {});
      // Static hosts that serve 404.html for unknown paths then open the app at any page address.
      await copyFile(join(outDir, "index.html"), join(outDir, "404.html")).catch(() => {});
    },
  };
};

export default defineConfig({
  plugins: [react({ babel: { plugins: ["./localization.cjs"] } }), officeEntry()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.OFFICE_PORT ?? 4150),
    proxy: {
      // The live backend on Thalmet Cloud; set IDENTITY_API_URL=http://127.0.0.1:4001 to use a local one.
      "/api": { target: process.env.IDENTITY_API_URL ?? "https://golden-pay-backend-golden-pay-services.cloud.thalmet.com", changeOrigin: true, secure: true },
    },
  },
  build: {
    outDir: "dist-headoffice",
    rollupOptions: { input: join(__dirname, "headoffice.html") },
  },
});
