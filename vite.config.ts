import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

// Plugin to inline all assets into HTML for Figma
function moveHtmlPlugin(): Plugin {
  return {
    name: "move-html",
    closeBundle() {
      const src = "dist/src/ui/index.html";
      const dest = "dist/ui.html";
      if (existsSync(src)) {
        let html = readFileSync(src, "utf-8");

        // Read the JS and CSS files
        const jsContent = existsSync("dist/ui.js") ? readFileSync("dist/ui.js", "utf-8") : "";
        const cssContent = existsSync("dist/ui.css") ? readFileSync("dist/ui.css", "utf-8") : "";

        // Remove external script/link tags
        html = html.replace(/type="module"\s+/g, '');
        html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
        html = html.replace(/<link[^>]*href="[^"]*\.css"[^>]*>/g, '');

        // Inline CSS in head
        if (cssContent) {
          html = html.replace('</head>', `<style>${cssContent}</style></head>`);
        }

        // Inline JS before </body>
        if (jsContent) {
          html = html.replace('</body>', `<script>${jsContent}</script></body>`);
        }

        writeFileSync(dest, html);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), moveHtmlPlugin()],
  base: "./",
  esbuild: {
    target: "es2018" // Transpile to es2018 for Figma
  },
  build: {
    target: "es2018", // Force older target for Figma compatibility
    minify: "terser", // Use terser instead of esbuild minifier (safer for Figma)
    sourcemap: false,
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/ui/index.html"),
      output: {
        entryFileNames: "ui.js",
        format: "iife",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "ui.css";
          }
          return "[name].[ext]";
        }
      }
    }
  }
});
