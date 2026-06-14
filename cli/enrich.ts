import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

/**
 * CLI tool for the agent to write enriched entity data back to a file's JSON.
 *
 * Usage:
 *   npx tsx enrich.ts <project-root> <relative-file-path> '<enrichments-json>'
 *   npx tsx enrich.ts <project-root> <relative-file-path> --from-file <path-to-json>
 *
 * The enrichments JSON is an array of objects:
 *   [{ "name": "Scheduler", "summary": "...", "description": "..." }, ...]
 *
 * Each enrichment is matched to an entity by name. If matched, summary and
 * detail.description are updated.
 */

interface Enrichment {
  name: string;
  summary: string;
  description: string;
}

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0];
  const relPath = args[1];
  let enrichmentsRaw: string | undefined;

  if (args[2] === "--from-file" && args[3]) {
    try {
      enrichmentsRaw = fs.readFileSync(args[3], "utf-8");
    } catch {
      console.error(`[enrich] Cannot read file: ${args[3]}`);
      process.exit(1);
    }
  } else {
    enrichmentsRaw = args[2];
  }

  if (!projectRoot || !relPath || !enrichmentsRaw) {
    console.error(
      "Usage: npx tsx enrich.ts <project-root> <relative-file-path> '<enrichments-json>'\n" +
      "       npx tsx enrich.ts <project-root> <relative-file-path> --from-file <path>"
    );
    process.exit(1);
  }

  const jsonFileName = relPath.replace(/[/\\]/g, "__") + ".json";
  const jsonPath = path.join(projectRoot, ".vibe-reading", "files", jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    console.error(`[enrich] No analysis file found: ${jsonPath}`);
    console.error("[enrich] Run analyze.ts first.");
    process.exit(1);
  }

  const analysis: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  let enrichments: Enrichment[];
  try {
    enrichments = JSON.parse(enrichmentsRaw);
  } catch (e) {
    console.error("[enrich] Failed to parse enrichments JSON:", e);
    process.exit(1);
  }

  const enrichMap = new Map<string, Enrichment>();
  for (const e of enrichments) {
    enrichMap.set(e.name, e);
  }

  let matched = 0;
  for (const entity of analysis.entities) {
    const name = entity.detail.name as string | undefined;
    if (!name) continue;

    const enrichment = enrichMap.get(name);
    if (enrichment) {
      entity.summary = enrichment.summary;
      (entity.detail as Record<string, unknown>).description = enrichment.description;
      matched++;
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  console.log(
    `[enrich] ${relPath}: ${matched}/${analysis.entities.length} entities enriched`
  );
}

main();
