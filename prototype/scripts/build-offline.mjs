import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDirectory = path.join(root, "dist", "offline-assets");
const outputDirectory = path.resolve(root, "..", "offline");
const outputFile = path.join(outputDirectory, "ウェブ広告パフォーマンスシミュレーター_オフライン版.html");

await rm(assetsDirectory, { recursive: true, force: true });

await build({
  configFile: false,
  mode: "production",
  plugins: [react()],
  define: {
    "import.meta.env.VITE_OFFLINE": JSON.stringify("true"),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: assetsDirectory,
    emptyOutDir: true,
    lib: {
      entry: path.join(root, "src", "main.jsx"),
      name: "AdPerformanceSimulator",
      formats: ["iife"],
      fileName: "app",
      cssFileName: "app",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

const [css, javascript] = await Promise.all([
  readFile(path.join(assetsDirectory, "app.css"), "utf8"),
  readFile(path.join(assetsDirectory, "app.iife.js"), "utf8"),
]);
const offlineCss = css.replace(/^@import(?:\s*url\()?['"][^'"]+['"]\)?;\s*/m, "");
const safeJavascript = javascript.replaceAll("</script", "<\\/script");
const document = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="オフラインで使えるウェブ広告パフォーマンスシミュレーター" />
    <title>ウェブ広告パフォーマンスシミュレーター</title>
    <style>${offlineCss}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${safeJavascript}</script>
  </body>
</html>
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, document, "utf8");
await rm(assetsDirectory, { recursive: true, force: true });
console.log(`Created ${outputFile}`);
