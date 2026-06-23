import * as fs from "fs";
import * as path from "path";
import type { Manifest, FileAnalysis, DataEntity, LoC, EntityType } from "./types.js";

const VALID_ENTITY_TYPES: EntityType[] = ["concept", "flow", "history", "jump"];

function validateLoC(loc: unknown, label: string): string[] {
  const errors: string[] = [];
  if (!loc || typeof loc !== "object") return [`${label}: not an object`];
  const a = loc as Record<string, unknown>;
  if (typeof a.file !== "string" || a.file.length === 0)
    errors.push(`${label}.file: must be a non-empty string`);
  for (const field of ["start_line", "start_col", "end_line"] as const) {
    if (typeof a[field] !== "number" || !Number.isInteger(a[field] as number))
      errors.push(`${label}.${field}: must be an integer`);
  }
  if (typeof a.start_line === "number" && a.start_line < 1)
    errors.push(`${label}.start_line: must be >= 1 (got ${a.start_line})`);
  if (
    typeof a.start_line === "number" &&
    typeof a.end_line === "number" &&
    a.end_line < a.start_line
  )
    errors.push(`${label}.end_line (${a.end_line}) < start_line (${a.start_line})`);
  return errors;
}

function validateEntity(entity: unknown, idx: number): string[] {
  const errors: string[] = [];
  const label = `entity[${idx}]`;
  if (!entity || typeof entity !== "object") return [`${label}: not an object`];
  const e = entity as Record<string, unknown>;

  errors.push(...validateLoC(e.anchor, `${label}.anchor`));

  if (typeof e.type !== "string" || !(VALID_ENTITY_TYPES as string[]).includes(e.type))
    errors.push(`${label}.type: must be one of ${VALID_ENTITY_TYPES.join(", ")} (got "${e.type}")`);
  if (typeof e.summary !== "string")
    errors.push(`${label}.summary: must be a string`);
  if (!e.detail || typeof e.detail !== "object" || Array.isArray(e.detail))
    errors.push(`${label}.detail: must be a plain object`);

  return errors;
}

// --- Knowledge Fields Gate ---

interface KnowledgeReport {
  total: number;
  withKnowledge: number;
  missing: { file: string; name: string; line: number }[];
}

function assessKnowledgeFields(projectRoot: string): KnowledgeReport {
  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  const report: KnowledgeReport = { total: 0, withKnowledge: 0, missing: [] };

  if (!fs.existsSync(filesDir)) return report;

  for (const f of fs.readdirSync(filesDir).filter((x) => x.endsWith(".json"))) {
    let data: FileAnalysis;
    try {
      data = JSON.parse(fs.readFileSync(path.join(filesDir, f), "utf-8"));
    } catch {
      continue;
    }

    if (!Array.isArray(data.entities)) continue;
    for (const entity of data.entities) {
      report.total++;
      const d = (entity?.detail ?? {}) as Record<string, unknown>;
      const hasLevel = typeof d.level === "string" && (d.level === "basic" || d.level === "advanced");
      const hasWhy = typeof d.why === "string" && (d.why as string).length > 10;
      const takeaway = d.takeaway as unknown[] | undefined;
      const hasTakeaway = Array.isArray(takeaway) && takeaway.length > 0;
      const hasExplainedTakeaway = hasTakeaway && takeaway!.some(
        (t) => typeof t === "object" && t !== null && "explain" in (t as Record<string, unknown>)
      );

      if (hasLevel && (hasWhy || hasExplainedTakeaway)) {
        report.withKnowledge++;
      } else {
        report.missing.push({
          file: data.file,
          name: (d.name as string) || "",
          line: entity.anchor.start_line,
        });
      }
    }
  }

  return report;
}

// --- Enrichment Quality Gate ---

interface EnrichmentReport {
  total: number;
  deep: number;
  shallow: number;
  shallowEntities: { file: string; name: string; line: number; summary: string }[];
}

const SHALLOW_PATTERNS = [
  /^Defined in .+ \(.*\)\.?\s*(Class|Function)?\s*(spanning \d+ lines)?\.?$/,
  /^(class|function|interface|type|enum|module|struct|trait|impl):?\s/i,
];

function isShallowDescription(desc: string): boolean {
  if (!desc || desc.length < 30) return true;
  return SHALLOW_PATTERNS.some((p) => p.test(desc.trim()));
}

function isShallowSummary(summary: string, name: string): boolean {
  if (!summary) return true;
  const s = summary.toLowerCase().trim();
  const n = (name || "").toLowerCase();
  if (s === n) return true;
  if (s === `${n} class` || s === `${n} function`) return true;
  if (s.length < 8) return true;
  return false;
}

function assessEnrichmentQuality(projectRoot: string): EnrichmentReport {
  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  const report: EnrichmentReport = { total: 0, deep: 0, shallow: 0, shallowEntities: [] };

  if (!fs.existsSync(filesDir)) return report;

  for (const f of fs.readdirSync(filesDir).filter((x) => x.endsWith(".json"))) {
    let data: FileAnalysis;
    try {
      data = JSON.parse(fs.readFileSync(path.join(filesDir, f), "utf-8"));
    } catch {
      continue;
    }

    for (const entity of data.entities) {
      report.total++;
      const name = (entity.detail?.name as string) || "";
      const desc = (entity.detail?.description as string) || "";
      const summary = entity.summary || "";

      if (isShallowDescription(desc) || isShallowSummary(summary, name)) {
        report.shallow++;
        report.shallowEntities.push({
          file: data.file,
          name,
          line: entity.anchor.start_line,
          summary,
        });
      } else {
        report.deep++;
      }
    }
  }

  return report;
}

function validateFileAnalysis(data: unknown, filePath: string): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== "object") return [`${filePath}: not a JSON object`];
  const d = data as Record<string, unknown>;

  if (typeof d.file !== "string" || d.file.length === 0)
    errors.push(`${filePath}: .file must be a non-empty string`);
  if (!Array.isArray(d.entities))
    return [...errors, `${filePath}: .entities must be an array`];

  for (let i = 0; i < d.entities.length; i++) {
    errors.push(...validateEntity(d.entities[i], i).map((e) => `${filePath}: ${e}`));
  }
  return errors;
}

function main() {
  const projectRoot = process.argv[2] || process.cwd();
  const manifestPath = path.join(projectRoot, ".vibe-reading", "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error("[harness] No manifest.json found. Run analyze first.");
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  console.log(`[harness] Project: ${manifest.project}`);
  console.log(`[harness] Analyzed at: ${manifest.analyzed_at}`);
  console.log(`[harness] Total files: ${manifest.total_files}`);
  console.log(`[harness] Analyzed: ${manifest.analyzed_files}`);
  console.log(`[harness] Coverage: ${(manifest.coverage * 100).toFixed(1)}%`);

  const failedFiles = manifest.files.filter((f) => f.status === "failed");
  if (failedFiles.length > 0) {
    console.log(`\n[harness] FAILED files (${failedFiles.length}):`);
    for (const f of failedFiles) {
      console.log(`  - ${f.path}`);
    }
  }

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  let missingCount = 0;
  const schemaErrors: string[] = [];

  for (const entry of manifest.files) {
    if (entry.status !== "analyzed") continue;
    const jsonName = entry.path.replace(/[/\\]/g, "__") + ".json";
    const jsonPath = path.join(filesDir, jsonName);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  [missing] ${entry.path} → expected ${jsonName}`);
      missingCount++;
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    } catch {
      schemaErrors.push(`${entry.path}: invalid JSON`);
      continue;
    }

    schemaErrors.push(...validateFileAnalysis(data, entry.path));
  }

  if (schemaErrors.length > 0) {
    console.log(`\n[harness] Schema violations (${schemaErrors.length}):`);
    for (const err of schemaErrors) {
      console.log(`  ✗ ${err}`);
    }
  }

  // --- Enrichment Quality Gate ---
  const enrichReport = assessEnrichmentQuality(projectRoot);
  const deepRatio = enrichReport.total > 0
    ? enrichReport.deep / enrichReport.total
    : 0;

  console.log(`\n[harness] Enrichment quality:`);
  console.log(`  Total entities: ${enrichReport.total}`);
  console.log(`  Deeply enriched: ${enrichReport.deep} (${(deepRatio * 100).toFixed(0)}%)`);
  console.log(`  Shallow/template: ${enrichReport.shallow}`);

  const qualityThreshold = parseFloat(process.env.ENRICH_THRESHOLD || "0");
  const qualityPass = deepRatio >= qualityThreshold;

  if (!qualityPass && enrichReport.shallowEntities.length > 0) {
    const showMax = Math.min(enrichReport.shallowEntities.length, 15);
    console.log(`\n[harness] Shallow entities (showing ${showMax}/${enrichReport.shallow}):`);
    for (const e of enrichReport.shallowEntities.slice(0, showMax)) {
      console.log(`  ⚠ ${e.file}:${e.line} [${e.name}] — "${e.summary}"`);
    }
    console.log(`\n[harness] ✗ Enrichment quality ${(deepRatio * 100).toFixed(0)}% < threshold ${(qualityThreshold * 100).toFixed(0)}%.`);
    console.log(`  Run deep enrichment on the above entities before viewing.`);
  }

  // --- Knowledge Fields Gate ---
  const knowledgeReport = assessKnowledgeFields(projectRoot);
  const knowledgeRatio = knowledgeReport.total > 0
    ? knowledgeReport.withKnowledge / knowledgeReport.total
    : 0;

  const knowledgeThreshold = parseFloat(process.env.KNOWLEDGE_THRESHOLD || "0");
  const knowledgePass = knowledgeRatio >= knowledgeThreshold;

  console.log(`\n[harness] Knowledge fields:`);
  console.log(`  With knowledge (level + why/takeaway): ${knowledgeReport.withKnowledge}/${knowledgeReport.total} (${(knowledgeRatio * 100).toFixed(0)}%)`);

  if (!knowledgePass && knowledgeReport.missing.length > 0) {
    const showMax = Math.min(knowledgeReport.missing.length, 15);
    console.log(`  Missing knowledge (showing ${showMax}/${knowledgeReport.missing.length}):`);
    for (const e of knowledgeReport.missing.slice(0, showMax)) {
      console.log(`    ⚠ ${e.file}:${e.line} [${e.name}]`);
    }
    console.log(`  ✗ Knowledge coverage ${(knowledgeRatio * 100).toFixed(0)}% < threshold ${(knowledgeThreshold * 100).toFixed(0)}%.`);
  }

  // --- Takeaway Quality Report (informational) ---
  let totalTakeaway = 0;
  let withRationale = 0;
  let withCrossLang = 0;
  const tFilesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (fs.existsSync(tFilesDir)) {
    for (const f of fs.readdirSync(tFilesDir).filter(x => x.endsWith(".json"))) {
      try {
        const data: FileAnalysis = JSON.parse(fs.readFileSync(path.join(tFilesDir, f), "utf-8"));
        if (!Array.isArray(data.entities)) continue;
        for (const entity of data.entities) {
          const takeaway = (entity?.detail as Record<string, unknown>)?.takeaway;
          if (!Array.isArray(takeaway)) continue;
          for (const t of takeaway) {
            if (typeof t === "object" && t !== null && "explain" in (t as Record<string, unknown>)) {
              totalTakeaway++;
              const obj = t as Record<string, unknown>;
              if (obj.rationale && typeof obj.rationale === "string") withRationale++;
              if (obj.cross_lang && typeof obj.cross_lang === "string") withCrossLang++;
            }
          }
        }
      } catch { continue; }
    }
  }

  if (totalTakeaway > 0) {
    console.log(`\n[harness] Takeaway quality:`);
    console.log(`  Total takeaway entries: ${totalTakeaway}`);
    console.log(`  With rationale: ${withRationale}/${totalTakeaway} (${(100 * withRationale / totalTakeaway).toFixed(0)}%)`);
    console.log(`  With cross_lang: ${withCrossLang}/${totalTakeaway} (${(100 * withCrossLang / totalTakeaway).toFixed(0)}%)`);
  }

  const totalErrors = failedFiles.length + missingCount + schemaErrors.length;
  const structurePass = totalErrors === 0 && manifest.coverage === 1;
  const fullPass = structurePass && qualityPass && knowledgePass;

  if (fullPass) {
    console.log("\n[harness] ✓ All checks passed. Schema valid. Coverage. Enrichment + Knowledge gates passed.");
    process.exit(0);
  } else {
    if (!structurePass) {
      console.log(
        `\n[harness] ✗ Structure: ${failedFiles.length} failed, ${missingCount} missing, ` +
        `${schemaErrors.length} schema errors.`
      );
    }
    if (!qualityPass) {
      console.log(`[harness] ✗ Enrichment quality FAILED: ${(deepRatio * 100).toFixed(0)}% < ${(qualityThreshold * 100).toFixed(0)}% threshold.`);
    }
    if (!knowledgePass) {
      console.log(`[harness] ✗ Knowledge gate FAILED: ${(knowledgeRatio * 100).toFixed(0)}% < ${(knowledgeThreshold * 100).toFixed(0)}% threshold.`);
    }
    process.exit(1);
  }
}

main();
