/**
 * One-line-per-file summary, suitable for piping to grep/sort/awk.
 * Usage: npx tsx summary.ts <project-root> [--sort=entities|complexity|commits] [--json]
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis, DataEntity } from "./types.js";

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args.filter(a => !a.startsWith("--"))[0] || process.cwd();
  const sortBy = args.find(a => a.startsWith("--sort="))?.slice(7) || "entities";
  const jsonMode = args.includes("--json");

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const results: Array<{
    file: string;
    entities: number;
    concepts: number;
    flow: number;
    history: number;
    jump: number;
    complexity: number;
    enriched: number;
  }> = [];

  for (const f of fs.readdirSync(filesDir).filter(f => f.endsWith(".json"))) {
    try {
      const analysis: FileAnalysis = JSON.parse(
        fs.readFileSync(path.join(filesDir, f), "utf-8")
      );
      const ents: DataEntity[] = analysis.entities;
      const concepts = ents.filter(e => e.type === "concept");
      const flows = ents.filter(e => e.type === "flow");
      const imports = flows.filter(e => e.detail.kind === "imports");
      const importCount = imports.reduce((sum, e) =>
        sum + ((e.detail.names as string[])?.length || 0), 0);
      const maxSpan = concepts.reduce((max, e) =>
        Math.max(max, e.anchor.end_line - e.anchor.start_line), 0);
      const enriched = concepts.filter(e => {
        const d = e.detail.description as string | undefined;
        return d && !/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/.test(d);
      });

      results.push({
        file: analysis.file,
        entities: ents.length,
        concepts: concepts.length,
        flow: flows.length,
        history: ents.filter(e => e.type === "history").length,
        jump: ents.filter(e => e.type === "jump").length,
        complexity: Math.round(concepts.length * 2 + importCount * 1.5 + Math.sqrt(maxSpan) * 3),
        enriched: enriched.length,
      });
    } catch { /* skip */ }
  }

  switch (sortBy) {
    case "complexity": results.sort((a, b) => b.complexity - a.complexity); break;
    case "commits": results.sort((a, b) => b.history - a.history); break;
    default: results.sort((a, b) => b.entities - a.entities);
  }

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`${r.file}\t${r.entities}e\t${r.concepts}c\t${r.complexity}cx\t${r.enriched}/${r.concepts}en`);
    }
  }
}

main();
