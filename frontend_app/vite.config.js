import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Docker publishes backend on 3001 in the root compose stack. Keep this configurable for
        // developers running backend directly on another port.
        target: process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
