import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Em desenvolvimento, /api/* vai para a API do docker compose: mesma origem, sem CORS.
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
});
