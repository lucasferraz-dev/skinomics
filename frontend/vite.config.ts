import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    // Em desenvolvimento, /api/* vai para a API do docker compose: mesma origem, sem CORS. Sem Docker,
    // SKINOMICS_API_PROXY no .env.local aponta para a API publicada (changeOrigin: a Render roteia pelo Host).
    proxy: {
      "/api": {
        target: loadEnv(mode, ".", "SKINOMICS_").SKINOMICS_API_PROXY ?? "http://localhost:8080",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
}));
