import * as fs from "fs";
import * as path from "path";
import type { Manifest, DataEntity, FileAnalysis } from "./types.js";

const VALID_TYPES = new Set(["concept", "flow", "history", "jump"]);

function validateEntity(entity: unknown, fileLabel: string, idx: number): string[] {
  const errors: string[] = [];
  const prefix = `[${fileLabel}] entity[${idx}]`;

  if (typeof entity !== "object" || entity === null) {
    return [`${prefix}: not an object`];
  }
  const e = entity as Record<string, unknown>;

  if (typeof e.type !== "string" || !VALID_TYPES.has(e.type)) {
    errors.push(`${prefix}: invalid type "${e.type}"`);
  }
  if (typeof e.summary !== "string" || e.summary.length === 0) {
    errors.push(`${prefix}: missing or empty summary`);
  }
  if (typeof e.detail !== "object" || e.detail === null) {
    errors.push(`${prefix}: missing detail object`);
  }

  if (typeof e.anchor !== "object" || e.anchor === null) {
    errors.push(`${prefix}: missing anchor`);
  } else {
    const a = e.anchor as Record<string, unknown>;
    if (typeof a.file !== "string" || a.file.length === 0) {
      errors.push(`${prefix}: anchor.file missing`);
    }
    if (typeof a.start_line !== "number" || a.start_line < 1) {
      errors.push(`${prefix}: anchor.start_line must be ≥ 1`);
    }
    if (typeof a.start_col !== "number" || a.start_col < 0) {
      errors.push(`${prefix}: anchor.start_col must be ≥ 0`);
    }
    if (typeof a.end_line !== "number" || a.end_line < 1) {
      errors.push(`${prefix}: anchor.end_line must be ≥ 1`);
    }
    if (typeof a.start_line === "number" && typeof a.end_line === "number" && a.end_line < a.start_line) {
      errors.push(`${prefix}: end_line (${a.end_line}) < start_line (${a.start_line})`);
    }
  }

  return errors;
}

function validateFileJson(filePath: string, fileLabel: string): string[] {
  const errors: string[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [`[${fileLabel}]: cannot read file`];
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [`[${fileLabel}]: invalid JSON`];
  }

  if (typeof data !== "object" || data === null) {
    return [`[${fileLabel}]: root is not an object`];
  }
  const d = data as Record<string, unknown>;

  if (typeof d.file !== "string" || d.file.length === 0) {
    errors.push(`[${fileLabel}]: missing "file" field`);
  }
  if (!Array.isArray(d.entities)) {
    errors.push(`[${fileLabel}]: missing "entities" array`);
  } else {
    for (let i = 0; i < d.entities.length; i++) {
      errors.push(...validateEntity(d.entities[i], fileLabel, i));
    }
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
    } else {
      schemaErrors.push(...validateFileJson(jsonPath, entry.path));
    }
  }

  if (schemaErrors.length > 0) {
    console.log(`\n[harness] Schema errors (${schemaErrors.length}):`);
    for (const e of schemaErrors) {
      console.log(`  ${e}`);
    }
  }

  if (failedFiles.length === 0 && missingCount === 0 && schemaErrors.length === 0 && manifest.coverage === 1) {
    console.log("\n[harness] ✓ All files analyzed. Schema valid. 100% coverage.");
    process.exit(0);
  } else {
    console.log(
      `\n[harness] ✗ Coverage incomplete. ` +
      `${failedFiles.length} failed, ${missingCount} missing, ${schemaErrors.length} schema errors.`
    );
    process.exit(1);
  }
}

main();
