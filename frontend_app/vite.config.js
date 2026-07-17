import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendProxyTarget =
    env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Keep the dev proxy pointed at the backend, not the parser or another local service.
        target: backendProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  };
});
