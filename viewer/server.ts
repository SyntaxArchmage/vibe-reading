import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = parseInt(process.env.PORT || "3457");
const VIEWER_DIR = path.dirname(new URL(import.meta.url).pathname);

const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(VIEWER_DIR, "..");

const vibeDir = path.join(projectRoot, ".vibe-reading");

function loadAnalysisData(): Record<string, unknown> {
  const filesDir = path.join(vibeDir, "files");
  if (!fs.existsSync(filesDir)) return {};

  const data: Record<string, unknown> = {};
  for (const file of fs.readdirSync(filesDir)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(filesDir, file), "utf-8");
    data[file] = JSON.parse(raw);
  }
  return data;
}

function loadGlobalData(): Record<string, unknown> {
  const globalDir = path.join(vibeDir, "global");
  if (!fs.existsSync(globalDir)) return {};
  const data: Record<string, unknown> = {};
  for (const file of fs.readdirSync(globalDir)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(globalDir, file), "utf-8");
    const key = file.replace(/\.json$/, "");
    data[key] = JSON.parse(raw);
  }
  return data;
}

function buildHtml(data: Record<string, unknown>, globalData: Record<string, unknown>): string {
  const template = fs.readFileSync(
    path.join(VIEWER_DIR, "index.html"),
    "utf-8"
  );
  const dataScript = `<script>const PREVIEW_DATA = ${JSON.stringify(data)};\nconst GLOBAL_DATA = ${JSON.stringify(globalData)};</script>`;
  return template
    .replace("out/viewer.js", "/viewer.js")
    .replace("<div id=\"root\"></div>", `<div id="root"></div>\n  ${dataScript}`);
}

if (!fs.existsSync(vibeDir)) {
  console.error(`No .vibe-reading/ found at ${vibeDir}. Run analyze first.`);
  process.exit(1);
}

const analysisData = loadAnalysisData();
const globalData = loadGlobalData();
const html = buildHtml(analysisData, globalData);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } else if (url.pathname === "/viewer.js") {
    const jsPath = path.join(VIEWER_DIR, "out", "viewer.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(fs.readFileSync(jsPath));
    } else {
      res.writeHead(404);
      res.end("viewer.js not found — run: node build.mjs");
    }
  } else if (url.pathname === "/api/source") {
    const filePath = url.searchParams.get("file");
    if (!filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing ?file= param" }));
      return;
    }
    const absPath = path.join(projectRoot, filePath);
    if (!absPath.startsWith(projectRoot) || !fs.existsSync(absPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "file not found" }));
      return;
    }
    const content = fs.readFileSync(absPath, "utf-8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ file: filePath, content }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[vibe-reading] Viewer: http://localhost:${PORT}`);
  console.log(`[vibe-reading] Project: ${projectRoot}`);
  console.log(`[vibe-reading] Loaded ${Object.keys(analysisData).length} analysis files`);
  console.log(`[vibe-reading] Press Ctrl+C to stop`);
});
