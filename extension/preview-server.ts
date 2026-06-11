import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = parseInt(process.env.PORT || "3457");
const EXT_DIR = path.dirname(new URL(import.meta.url).pathname);

const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(EXT_DIR, "..");

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

function buildPreviewHtml(data: Record<string, unknown>): string {
  const template = fs.readFileSync(
    path.join(EXT_DIR, "webview", "preview.html"),
    "utf-8"
  );
  const dataScript = `<script>const PREVIEW_DATA = ${JSON.stringify(data)};</script>`;
  return template.replace(
    '<script src="../out/webview.js"></script>',
    `${dataScript}\n  <script src="/webview.js"></script>`
  );
}

if (!fs.existsSync(vibeDir)) {
  console.error(`No .vibe-reading/ found at ${vibeDir}. Run analyze first.`);
  process.exit(1);
}

const analysisData = loadAnalysisData();
const previewHtml = buildPreviewHtml(analysisData);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(previewHtml);
  } else if (url.pathname === "/webview.js") {
    const jsPath = path.join(EXT_DIR, "out", "webview.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(fs.readFileSync(jsPath));
    } else {
      res.writeHead(404);
      res.end("webview.js not found — run: node esbuild.webview.mjs");
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

server.listen(PORT, () => {
  console.log(`[preview] Vibe Reading preview: http://localhost:${PORT}`);
  console.log(`[preview] Project: ${projectRoot}`);
  console.log(`[preview] Loaded ${Object.keys(analysisData).length} analysis files`);
  console.log(`[preview] Press Ctrl+C to stop`);
});
