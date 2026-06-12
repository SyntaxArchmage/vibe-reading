import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

/**
 * CLI tool for the agent to write enriched entity data back to a file's JSON.
 *
 * Usage:
 *   npx tsx enrich.ts <project-root> <relative-file-path> '<enrichments-json>'
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
  start_line?: number;
}

function main() {
  const [projectRoot, relPath, enrichmentsRaw] = process.argv.slice(2);

  if (!projectRoot || !relPath || !enrichmentsRaw) {
    console.error(
      "Usage: npx tsx enrich.ts <project-root> <relative-file-path> '<enrichments-json>'"
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

  // Precise enrichments (with start_line) keyed by "name:line"
  const preciseMap = new Map<string, Enrichment>();
  // Name-only enrichments as fallback, stored as arrays for duplicates
  const nameMap = new Map<string, Enrichment[]>();
  for (const e of enrichments) {
    if (e.start_line != null) {
      preciseMap.set(`${e.name}:${e.start_line}`, e);
    } else {
      const arr = nameMap.get(e.name) || [];
      arr.push(e);
      nameMap.set(e.name, arr);
    }
  }

  // Track which name-only enrichments have been consumed
  const nameConsumed = new Map<string, number>();

  let matched = 0;
  for (const entity of analysis.entities) {
    const name = entity.detail.name as string | undefined;
    if (!name) continue;

    const line = entity.anchor.start_line;
    const preciseKey = `${name}:${line}`;

    // Try precise match first (name + start_line)
    let enrichment = preciseMap.get(preciseKey);
    if (!enrichment) {
      // Fall back to name-only, consuming entries in order
      const candidates = nameMap.get(name);
      if (candidates && candidates.length > 0) {
        const idx = nameConsumed.get(name) || 0;
        enrichment = candidates[Math.min(idx, candidates.length - 1)];
        nameConsumed.set(name, idx + 1);
      }
    }

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
