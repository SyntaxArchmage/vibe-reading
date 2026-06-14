/**
 * Report file complexity scores ranked from highest to lowest.
 * Usage: npx tsx complexity.ts <project-root> [--top N]
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis, DataEntity } from "./types.js";

function main() {
  const args = process.argv.slice(2);
  const topArg = args.find(a => a.startsWith("--top="));
  const topN = topArg ? parseInt(topArg.slice(6)) : Infinity;
  const projectRoot = args.filter(a => !a.startsWith("--"))[0] || process.cwd();

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const results: Array<{
    file: string;
    concepts: number;
    imports: number;
    maxSpan: number;
    complexity: number;
  }> = [];

  for (const f of fs.readdirSync(filesDir).filter(f => f.endsWith(".json"))) {
    try {
      const analysis: FileAnalysis = JSON.parse(
        fs.readFileSync(path.join(filesDir, f), "utf-8")
      );
      const ents: DataEntity[] = analysis.entities;
      const concepts = ents.filter(e => e.type === "concept");
      const flows = ents.filter(e => e.type === "flow");
      const importEnts = flows.filter(e => e.detail.kind === "imports");
      const importCount = importEnts.reduce((sum, e) =>
        sum + ((e.detail.names as string[])?.length || 0), 0);
      const maxSpan = concepts.reduce((max, e) =>
        Math.max(max, e.anchor.end_line - e.anchor.start_line), 0);
      const complexity = Math.round(
        concepts.length * 2 + importCount * 1.5 + Math.sqrt(maxSpan) * 3
      );
      results.push({
        file: analysis.file,
        concepts: concepts.length,
        imports: importCount,
        maxSpan,
        complexity,
      });
    } catch { /* skip malformed */ }
  }

  results.sort((a, b) => b.complexity - a.complexity);
  const show = results.slice(0, topN);

  console.log("File Complexity Report");
  console.log("=".repeat(60));
  console.log(`${"Score".padStart(6)}  ${"Concepts".padStart(8)}  ${"Imports".padStart(7)}  ${"MaxSpan".padStart(7)}  File`);
  console.log("-".repeat(60));
  for (const r of show) {
    console.log(
      `${String(r.complexity).padStart(6)}  ${String(r.concepts).padStart(8)}  ${String(r.imports).padStart(7)}  ${String(r.maxSpan).padStart(7)}  ${r.file}`
    );
  }
  console.log("-".repeat(60));
  const avg = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.complexity, 0) / results.length)
    : 0;
  console.log(`Average: ${avg}  Files: ${results.length}`);
}

main();
