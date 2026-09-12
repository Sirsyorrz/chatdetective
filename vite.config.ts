import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites from /<repo>/, overridden to "/" for a custom domain.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/chatdetective/",
  plugins: [react()],
});
