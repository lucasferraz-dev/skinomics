import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    // Em desenvolvimento, /api/* vai para a API do docker compose: mesma origem, sem CORS.
    proxy: {
      "/api": {
        target: loadEnv(mode, ".", "SKINOMICS_").SKINOMICS_API_PROXY ?? "http://localhost:8080",
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
}));
