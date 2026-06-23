/**
 * Compare two analysis snapshots and report changes.
 * Usage: npx tsx diff.ts <project-root> <snapshot-path>
 * 
 * If no snapshot, saves current state. If snapshot exists, compares.
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

interface Snapshot {
  timestamp: string;
  files: Record<string, { entityCount: number; names: string[]; types: Record<string, number> }>;
}

function takeSnapshot(projectRoot: string): Snapshot {
  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  const files: Snapshot["files"] = {};

  for (const f of fs.readdirSync(filesDir).filter(f => f.endsWith(".json"))) {
    try {
      const analysis: FileAnalysis = JSON.parse(
        fs.readFileSync(path.join(filesDir, f), "utf-8")
      );
      const names = analysis.entities
        .filter(e => e.detail.name)
        .map(e => String(e.detail.name));
      const types: Record<string, number> = {};
      for (const e of analysis.entities) {
        types[e.type] = (types[e.type] || 0) + 1;
      }
      files[analysis.file] = { entityCount: analysis.entities.length, names, types };
    } catch { /* skip */ }
  }

  return { timestamp: new Date().toISOString(), files };
}

function main() {
  const projectRoot = process.argv[2] || process.cwd();
  const snapshotPath = process.argv[3] || path.join(projectRoot, ".vibe-reading", "snapshot.json");

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const current = takeSnapshot(projectRoot);

  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2));
    console.log(`Snapshot saved to ${snapshotPath}`);
    console.log(`Files: ${Object.keys(current.files).length}`);
    console.log(`Run again after changes to see diff.`);
    return;
  }

  const previous: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  console.log(`Comparing against snapshot from ${previous.timestamp}\n`);

  const prevFiles = new Set(Object.keys(previous.files));
  const currFiles = new Set(Object.keys(current.files));

  const added = [...currFiles].filter(f => !prevFiles.has(f));
  const removed = [...prevFiles].filter(f => !currFiles.has(f));
  const common = [...currFiles].filter(f => prevFiles.has(f));

  if (added.length > 0) {
    console.log(`Added files (${added.length}):`);
    for (const f of added) console.log(`  + ${f} (${current.files[f].entityCount} entities)`);
  }

  if (removed.length > 0) {
    console.log(`Removed files (${removed.length}):`);
    for (const f of removed) console.log(`  - ${f}`);
  }

  let changed = 0;
  for (const f of common) {
    const prev = previous.files[f];
    const curr = current.files[f];
    const addedNames = curr.names.filter(n => !prev.names.includes(n));
    const removedNames = prev.names.filter(n => !curr.names.includes(n));
    const entityDiff = curr.entityCount - prev.entityCount;

    if (addedNames.length > 0 || removedNames.length > 0 || entityDiff !== 0) {
      changed++;
      console.log(`\nChanged: ${f} (${entityDiff > 0 ? "+" : ""}${entityDiff} entities)`);
      if (addedNames.length > 0) console.log(`  + entities: ${addedNames.join(", ")}`);
      if (removedNames.length > 0) console.log(`  - entities: ${removedNames.join(", ")}`);
    }
  }

  console.log(`\nSummary: ${added.length} added, ${removed.length} removed, ${changed} changed, ${common.length - changed} unchanged`);

  fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2));
  console.log(`Snapshot updated.`);
}

main();
