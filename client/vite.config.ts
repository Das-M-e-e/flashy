import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Explizit IPv4: der Server bindet nur an 127.0.0.1, "localhost" kann
      // aber zuerst auf ::1 auflösen und der Proxy liefe ins Leere.
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
});
