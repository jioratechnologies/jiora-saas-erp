import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 (Vite's default) is already held by an unrelated project on this
    // machine (periscope-frontend-dev) — see infra/docker-compose.yml's port note.
    port: 5174,
    strictPort: true,
  },
});
