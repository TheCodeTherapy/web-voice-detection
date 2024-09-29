import path from "path";

import { defineConfig } from "vite";

export default defineConfig({
  root: "./example",
  build: {
    outDir: "../dist/example",
  },
  server: {
    // open: true,
    port: 3000,
    fs: {
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "/dist/": path.resolve(__dirname, "../dist/"),
    },
  },
  publicDir: path.resolve(__dirname, "../dist"),
  plugins: [
    {
      name: "wasm-mime-type",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      },
    },
  ],
});
