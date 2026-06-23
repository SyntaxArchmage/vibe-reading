/**
 * Quick stats overview of .vibe-reading analysis data.
 * Usage: npx tsx stats.ts <project-root>
 */
import * as fs from "fs";
import * as path from "path";
import type { Manifest, FileAnalysis } from "./types.js";

function main() {
  const projectRoot = process.argv[2] || process.cwd();
  const vibeDir = path.join(projectRoot, ".vibe-reading");
  const manifestPath = path.join(vibeDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(`No .vibe-reading/ found at ${vibeDir}. Run analyze first.`);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const filesDir = path.join(vibeDir, "files");

  const typeCounts: Record<string, number> = { concept: 0, flow: 0, history: 0, jump: 0 };
  let totalEntities = 0;
  let enrichedConcepts = 0;
  let totalConcepts = 0;
  const fileStats: Array<{ path: string; count: number; concepts: number }> = [];

  for (const entry of manifest.files) {
    if (entry.status !== "analyzed") continue;
    const jsonName = entry.path.replace(/[/\\]/g, "__") + ".json";
    const jsonPath = path.join(filesDir, jsonName);
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const data: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      let fileConcepts = 0;
      for (const e of data.entities) {
        totalEntities++;
        if (e.type in typeCounts) typeCounts[e.type]++;
        if (e.type === "concept") {
          totalConcepts++;
          fileConcepts++;
          const desc = (e.detail as Record<string, unknown>)?.description;
          if (typeof desc === "string" && !desc.match(/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/)) {
            enrichedConcepts++;
          }
        }
      }
      fileStats.push({ path: entry.path, count: data.entities.length, concepts: fileConcepts });
    } catch { /* skip malformed */ }
  }

  fileStats.sort((a, b) => b.count - a.count);

  console.log(`Project: ${manifest.project}`);
  console.log(`Analyzed: ${manifest.analyzed_at}`);
  console.log(`Files: ${manifest.analyzed_files}/${manifest.total_files} (${(manifest.coverage * 100).toFixed(1)}%)`);
  console.log(`\nEntities: ${totalEntities}`);
  console.log(`  Concepts: ${typeCounts.concept}`);
  console.log(`  Flow:     ${typeCounts.flow}`);
  console.log(`  History:  ${typeCounts.history}`);
  console.log(`  Jump:     ${typeCounts.jump}`);
  console.log(`\nEnrichment: ${enrichedConcepts}/${totalConcepts} concepts (${totalConcepts > 0 ? ((enrichedConcepts / totalConcepts) * 100).toFixed(1) : "0.0"}%)`);
  if (fileStats.length > 0) {
    const avg = (totalEntities / fileStats.length).toFixed(1);
    console.log(`\nAverage: ${avg} entities/file`);
    console.log(`\nTop files by entity count:`);
    for (const f of fileStats.slice(0, 5)) {
      console.log(`  ${f.count.toString().padStart(3)} entities  ${f.path}`);
    }
  }

  const extCounts: Record<string, number> = {};
  for (const f of fileStats) {
    const ext = path.extname(f.path).toLowerCase() || "(none)";
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  }
  const extEntries = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
  if (extEntries.length > 0) {
    console.log(`\nBy extension:`);
    for (const [ext, count] of extEntries) {
      console.log(`  ${ext}: ${count} files`);
    }
  }

  const cgPath = path.join(vibeDir, "global", "call-graph.json");
  if (fs.existsSync(cgPath)) {
    try {
      const cg = JSON.parse(fs.readFileSync(cgPath, "utf-8"));
      const files = cg.files as Array<{ file: string; imports: Array<{ source: string }>; exports: string[] }>;
      const totalImports = files.reduce((s, f) => s + f.imports.length, 0);
      const totalExports = files.reduce((s, f) => s + f.exports.length, 0);
      const isolatedFiles = files.filter(f => f.imports.length === 0 && f.exports.length === 0);
      console.log(`\nDependency graph:`);
      console.log(`  Total imports: ${totalImports}`);
      console.log(`  Total exports: ${totalExports}`);
      console.log(`  Isolated files: ${isolatedFiles.length}`);

      const adj = new Map<string, string[]>();
      for (const f of files) {
        const deps: string[] = [];
        for (const imp of f.imports) {
          if (!imp.source.startsWith(".")) continue;
          const src = imp.source.replace(/^\.\//, "");
          const target = files.find(t =>
            t.file.endsWith(src) || t.file.endsWith(src + ".ts") || t.file.endsWith(src + ".js") || t.file.endsWith(src + ".tsx")
          );
          if (target) deps.push(target.file);
        }
        adj.set(f.file, deps);
      }

      let longestChain = 0;
      let longestStart = "";
      function dfs(file: string, visited: Set<string>, depth: number) {
        if (depth > longestChain) { longestChain = depth; longestStart = file; }
        for (const dep of adj.get(file) || []) {
          if (!visited.has(dep)) {
            visited.add(dep);
            dfs(dep, visited, depth + 1);
            visited.delete(dep);
          }
        }
      }
      for (const f of files) {
        dfs(f.file, new Set([f.file]), 0);
      }
      if (longestChain > 0) {
        console.log(`  Longest dep chain: ${longestChain} (from ${longestStart})`);
      }
    } catch { /* skip */ }
  }
}

main();
