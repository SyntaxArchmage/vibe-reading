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
  let maxEntities = 0;
  let maxFile = "";

  for (const entry of manifest.files) {
    if (entry.status !== "analyzed") continue;
    const jsonName = entry.path.replace(/[/\\]/g, "__") + ".json";
    const jsonPath = path.join(filesDir, jsonName);
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const data: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      for (const e of data.entities) {
        totalEntities++;
        if (e.type in typeCounts) typeCounts[e.type]++;
        if (e.type === "concept") {
          totalConcepts++;
          const desc = (e.detail as Record<string, unknown>)?.description;
          if (typeof desc === "string" && !desc.match(/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/)) {
            enrichedConcepts++;
          }
        }
      }
      if (data.entities.length > maxEntities) {
        maxEntities = data.entities.length;
        maxFile = entry.path;
      }
    } catch { /* skip malformed */ }
  }

  console.log(`Project: ${manifest.project}`);
  console.log(`Analyzed: ${manifest.analyzed_at}`);
  console.log(`Files: ${manifest.analyzed_files}/${manifest.total_files} (${(manifest.coverage * 100).toFixed(1)}%)`);
  console.log(`\nEntities: ${totalEntities}`);
  console.log(`  Concepts: ${typeCounts.concept}`);
  console.log(`  Flow:     ${typeCounts.flow}`);
  console.log(`  History:  ${typeCounts.history}`);
  console.log(`  Jump:     ${typeCounts.jump}`);
  console.log(`\nEnrichment: ${enrichedConcepts}/${totalConcepts} concepts (${totalConcepts > 0 ? ((enrichedConcepts / totalConcepts) * 100).toFixed(1) : "0.0"}%)`);
  if (maxFile) {
    console.log(`Largest file: ${maxFile} (${maxEntities} entities)`);
  }
}

main();
