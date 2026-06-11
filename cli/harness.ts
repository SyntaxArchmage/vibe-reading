import * as fs from "fs";
import * as path from "path";
import type { Manifest } from "./types.js";

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

  const failed = manifest.files.filter((f) => f.status === "failed");
  if (failed.length > 0) {
    console.log(`\n[harness] FAILED files (${failed.length}):`);
    for (const f of failed) {
      console.log(`  - ${f.path}`);
    }
  }

  // Verify JSON files exist on disk
  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  let missingCount = 0;
  for (const entry of manifest.files) {
    if (entry.status !== "analyzed") continue;
    const jsonName = entry.path.replace(/[/\\]/g, "__") + ".json";
    const jsonPath = path.join(filesDir, jsonName);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  [missing] ${entry.path} → expected ${jsonName}`);
      missingCount++;
    }
  }

  if (failed.length === 0 && missingCount === 0 && manifest.coverage === 1) {
    console.log("\n[harness] ✓ All files analyzed. 100% coverage.");
    process.exit(0);
  } else {
    console.log(
      `\n[harness] ✗ Coverage incomplete. ` +
      `${failed.length} failed, ${missingCount} missing JSON files.`
    );
    process.exit(1);
  }
}

main();
