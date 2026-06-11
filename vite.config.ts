import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/components/ui": resolve(__dirname, "src/shared/components/ui"),
      "@/components": resolve(__dirname, "src/shared/components"),
      "@/lib": resolve(__dirname, "src/lib"),
      "@/shared": resolve(__dirname, "src/shared"),
      "@/modules": resolve(__dirname, "src/modules"),
      "@/pages": resolve(__dirname, "src/pages"),
      "@/integrations": resolve(__dirname, "src/integrations"),
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
