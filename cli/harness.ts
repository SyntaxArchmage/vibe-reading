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

  const totalErrors = failedFiles.length + missingCount + schemaErrors.length;
  if (totalErrors === 0 && manifest.coverage === 1) {
    console.log("\n[harness] ✓ All files analyzed. Schema valid. 100% coverage.");
    process.exit(0);
  } else {
    console.log(
      `\n[harness] ✗ ${failedFiles.length} failed, ${missingCount} missing, ` +
      `${schemaErrors.length} schema errors.`
    );
    process.exit(1);
  }
}

main();
