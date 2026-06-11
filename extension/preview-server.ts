import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = parseInt(process.env.PORT || "3457");
const EXT_DIR = path.dirname(new URL(import.meta.url).pathname);

function loadAnalysisData(vibeDir: string): Record<string, unknown> {
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

const vibeDir = process.argv[2]
  ? path.join(process.argv[2], ".vibe-reading")
  : path.join(EXT_DIR, "..", ".vibe-reading");

if (!fs.existsSync(vibeDir)) {
  console.error(`No .vibe-reading/ found at ${vibeDir}. Run analyze first.`);
  process.exit(1);
}

const analysisData = loadAnalysisData(vibeDir);
const previewHtml = buildPreviewHtml(analysisData);

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(previewHtml);
  } else if (req.url === "/webview.js") {
    const jsPath = path.join(EXT_DIR, "out", "webview.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(fs.readFileSync(jsPath));
    } else {
      res.writeHead(404);
      res.end("webview.js not found — run: node esbuild.webview.mjs");
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`[preview] Vibe Reading preview: http://localhost:${PORT}`);
  console.log(`[preview] Loaded ${Object.keys(analysisData).length} analysis files`);
  console.log(`[preview] Press Ctrl+C to stop`);
});
