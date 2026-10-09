import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the build works on GitHub Pages
// under any repo name (https://<user>.github.io/<repo>/) without edits.
export default defineConfig({ plugins: [react()], base: "./" });
