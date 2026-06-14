import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

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
    try {
      const raw = fs.readFileSync(path.join(filesDir, file), "utf-8");
      data[file] = JSON.parse(raw);
    } catch (e) {
      console.warn(`[vibe-reading] Skipping malformed JSON: ${file}`);
    }
  }
  return data;
}

function loadCallGraph(): unknown {
  const cgPath = path.join(vibeDir, "global", "call-graph.json");
  if (!fs.existsSync(cgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cgPath, "utf-8"));
  } catch {
    return null;
  }
}

function buildHtml(data: Record<string, unknown>, callGraph: unknown): string {
  const template = fs.readFileSync(
    path.join(VIEWER_DIR, "index.html"),
    "utf-8"
  );
  const dataScript = `<script>const PREVIEW_DATA = ${JSON.stringify(data)};const CALL_GRAPH = ${JSON.stringify(callGraph)};</script>`;
  return template
    .replace("out/viewer.js", "/viewer.js")
    .replace("<div id=\"root\"></div>", `<div id="root"></div>\n  ${dataScript}`);
}

if (!fs.existsSync(vibeDir)) {
  console.error(`No .vibe-reading/ found at ${vibeDir}. Run analyze first.`);
  process.exit(1);
}

let analysisData = loadAnalysisData();
let callGraph = loadCallGraph();
let html = buildHtml(analysisData, callGraph);

const vibeFilesDir = path.join(vibeDir, "files");
if (fs.existsSync(vibeFilesDir)) {
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  fs.watch(vibeFilesDir, { persistent: false }, () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      analysisData = loadAnalysisData();
      callGraph = loadCallGraph();
      html = buildHtml(analysisData, callGraph);
      console.log(`[vibe-reading] Reloaded ${Object.keys(analysisData).length} analysis files`);
    }, 300);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      project: path.basename(projectRoot),
      files: Object.keys(analysisData).length,
    }));
    return;
  }

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
    const absPath = path.resolve(projectRoot, filePath);
    if (!absPath.startsWith(projectRoot + path.sep) || !fs.existsSync(absPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "file not found" }));
      return;
    }
    const content = fs.readFileSync(absPath, "utf-8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ file: filePath, content }));
  } else if (url.pathname === "/api/entities") {
    const filePath = url.searchParams.get("file");
    if (filePath) {
      const jsonName = filePath.replace(/[/\\]/g, "__") + ".json";
      const fileData = analysisData[jsonName];
      if (fileData) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fileData));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "no analysis data for file" }));
      }
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        files: Object.entries(analysisData).map(([key, data]: [string, any]) => ({
          key,
          file: data.file,
          entity_count: data.entities.length,
        })),
      }));
    }
  } else if (url.pathname === "/api/stats") {
    const fileCount = Object.keys(analysisData).length;
    let totalEntities = 0;
    const typeCounts: Record<string, number> = {};
    for (const [, data] of Object.entries(analysisData) as [string, any][]) {
      totalEntities += data.entities.length;
      for (const e of data.entities) {
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      project: path.basename(projectRoot),
      files: fileCount,
      total_entities: totalEntities,
      types: typeCounts,
      call_graph_files: callGraph ? (callGraph as any).files?.length ?? 0 : 0,
    }));
  } else if (url.pathname === "/api/search") {
    const query = (url.searchParams.get("q") || "").toLowerCase().trim();
    const typeFilter = url.searchParams.get("type") || null;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    if (!query && !typeFilter) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing ?q= or ?type= param" }));
      return;
    }
    const results: Array<{ file: string; name: string; type: string; kind: string; line: number; summary: string }> = [];
    for (const [, data] of Object.entries(analysisData) as [string, any][]) {
      for (const e of data.entities) {
        if (typeFilter && e.type !== typeFilter) continue;
        const name = (e.detail?.name || "").toLowerCase();
        const summary = (e.summary || "").toLowerCase();
        if (query && !name.includes(query) && !summary.includes(query)) continue;
        results.push({
          file: data.file,
          name: e.detail?.name || e.summary,
          type: e.type,
          kind: e.detail?.kind || "",
          line: e.anchor.start_line,
          summary: e.summary,
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ query, results, count: results.length }));
  } else if (url.pathname === "/api/blame") {
    const filePath = url.searchParams.get("file");
    if (!filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing ?file= param" }));
      return;
    }
    const absPath = path.resolve(projectRoot, filePath);
    if (!absPath.startsWith(projectRoot + path.sep) || !fs.existsSync(absPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "file not found" }));
      return;
    }
    try {
      const raw = execSync(
        `git blame --line-porcelain "${absPath}"`,
        { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" }
      );
      const lines: Array<{ line: number; author: string; date: string; sha: string; content: string }> = [];
      let cur: Record<string, string> = {};
      let lineNum = 0;
      for (const l of raw.split("\n")) {
        if (l.startsWith("\t")) {
          lineNum++;
          lines.push({
            line: lineNum,
            author: cur["author"] || "?",
            date: cur["author-time"] ? new Date(parseInt(cur["author-time"]) * 1000).toISOString().slice(0, 10) : "?",
            sha: cur["sha"] || "?",
            content: l.slice(1),
          });
          cur = {};
        } else {
          const m = l.match(/^([0-9a-f]{40}) /);
          if (m) cur["sha"] = m[1].slice(0, 8);
          const kv = l.match(/^(author|author-time|summary) (.+)/);
          if (kv) cur[kv[1]] = kv[2];
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ file: filePath, lines }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "git blame failed (not a git repo?)" }));
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`[vibe-reading] Viewer: http://localhost:${PORT}`);
  console.log(`[vibe-reading] Project: ${projectRoot}`);
  console.log(`[vibe-reading] Loaded ${Object.keys(analysisData).length} analysis files`);
  console.log(`[vibe-reading] Press Ctrl+C to stop`);
});
