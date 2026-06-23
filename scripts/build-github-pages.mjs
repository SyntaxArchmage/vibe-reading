#!/usr/bin/env node
/**
 * Build a static GitHub Pages site showcasing the nano-vllm learning results.
 *
 * Output: pages/
 *   index.html       — viewer shell + embedded PREVIEW_DATA / CALL_GRAPH
 *   viewer.js        — bundled React app
 *   source/*.json    — source files for Monaco editor
 *   .nojekyll
 *
 * Usage: node scripts/build-github-pages.mjs
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const VIEWER_DIR = path.join(REPO_ROOT, "viewer");
const PROJECT_ROOT = path.join(REPO_ROOT, "test/data/nano-vllm");
const VIBE_DIR = path.join(PROJECT_ROOT, ".vibe-reading");
const OUT_DIR = path.join(REPO_ROOT, "pages");
const SOURCE_DIR = path.join(OUT_DIR, "source");

function sourceKey(filePath) {
  return filePath.replace(/\//g, "__");
}

function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function loadAnalysisData() {
  const filesDir = path.join(VIBE_DIR, "files");
  if (!fs.existsSync(filesDir)) {
    console.error(`[pages] Missing ${filesDir}. Run analyze + enrich on test/data/nano-vllm first.`);
    process.exit(1);
  }
  const data = {};
  for (const file of fs.readdirSync(filesDir)) {
    if (!file.endsWith(".json")) continue;
    data[file] = JSON.parse(fs.readFileSync(path.join(filesDir, file), "utf-8"));
  }
  return data;
}

function loadCallGraph() {
  const cgPath = path.join(VIBE_DIR, "global", "call-graph.json");
  if (!fs.existsSync(cgPath)) {
    console.warn("[pages] Warning: call-graph.json missing — Flow/Jump tabs will be limited");
    return null;
  }
  return JSON.parse(fs.readFileSync(cgPath, "utf-8"));
}

function collectSourceFiles(analysisData) {
  const files = new Set();
  for (const entry of Object.values(analysisData)) {
    if (entry?.file) files.add(entry.file);
  }
  return [...files].sort();
}

function main() {
  console.log("[pages] Building viewer bundle...");
  execSync("node build.mjs", { cwd: VIEWER_DIR, stdio: "inherit" });

  const analysisData = loadAnalysisData();
  const callGraph = loadCallGraph();
  const sourceFiles = collectSourceFiles(analysisData);

  console.log(`[pages] Analysis files: ${Object.keys(analysisData).length}`);
  console.log(`[pages] Source files: ${sourceFiles.length}`);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  for (const file of sourceFiles) {
    const absPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(absPath)) {
      console.warn(`[pages] Warning: source missing: ${file}`);
      continue;
    }
    const content = fs.readFileSync(absPath, "utf-8");
    const outPath = path.join(SOURCE_DIR, `${sourceKey(file)}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ file, content }));
  }

  const viewerJs = fs.readFileSync(path.join(VIEWER_DIR, "out", "viewer.js"), "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "viewer.js"), viewerJs);

  const template = fs.readFileSync(path.join(VIEWER_DIR, "index.html"), "utf-8");
  const dataScript = `<script>
const VR_BASE = "/vibe-reading/";
const PREVIEW_DATA = ${safeJson(analysisData)};
const CALL_GRAPH = ${safeJson(callGraph)};
</script>`;

  const html = template
    .replace('src="out/viewer.js"', 'src="viewer.js"')
    .replace("<div id=\"root\"></div>", `<div id="root"></div>\n  ${dataScript}`)
    .replace(
      "<title>Vibe Reading</title>",
      "<title>Vibe Reading — nano-vllm Demo</title>"
    );

  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");

  console.log(`[pages] Done → ${OUT_DIR}`);
  console.log(`[pages] Local preview: cd pages && python3 -m http.server 8080`);
  console.log(`[pages] Live URL: https://syntaxarchmage.github.io/vibe-reading/`);
}

main();
