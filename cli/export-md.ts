/**
 * Export analysis data as a Markdown summary.
 * Usage: npx tsx export-md.ts <project-root> [--file <relative-path>]
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis, DataEntity } from "./types.js";

function entityToMd(e: DataEntity): string {
  const name = (e.detail.name as string) || e.summary;
  const kind = (e.detail.kind as string) || e.type;
  const loc = `L${e.anchor.start_line}–${e.anchor.end_line}`;
  const desc = (e.detail.description as string) || "";
  return `- **${name}** (\`${kind}\`, ${loc}): ${e.summary}${desc ? `\n  > ${desc.split("\n")[0]}` : ""}`;
}

function isChild(e: DataEntity, all: DataEntity[]): boolean {
  return all.some(p => p !== e &&
    p.anchor.start_line <= e.anchor.start_line &&
    p.anchor.end_line >= e.anchor.end_line);
}

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0];
  if (!projectRoot) {
    console.error("Usage: npx tsx export-md.ts <project-root> [--file <path>]");
    process.exit(1);
  }

  const fileArg = args.indexOf("--file");
  const specificFile = fileArg >= 0 ? args[fileArg + 1] : null;
  const outlineMode = args.includes("--outline");

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(filesDir)
    .filter(f => f.endsWith(".json"))
    .sort();

  const lines: string[] = [`# ${path.basename(path.resolve(projectRoot))} — Analysis Summary\n`];
  let fileCount = 0, entityCount = 0, enrichedCount = 0;

  for (const jf of jsonFiles) {
    const data: FileAnalysis = JSON.parse(fs.readFileSync(path.join(filesDir, jf), "utf-8"));
    if (specificFile && data.file !== specificFile) continue;
    fileCount++;
    entityCount += data.entities.length;
    enrichedCount += data.entities.filter(e => e.detail.description).length;

    lines.push(`## ${data.file}\n`);

    if (outlineMode) {
      const sorted = [...data.entities].sort((a, b) => a.anchor.start_line - b.anchor.start_line);
      for (const e of sorted) {
        const indent = isChild(e, sorted) ? "  " : "";
        const name = (e.detail.name as string) || e.summary;
        const kind = (e.detail.kind as string) || e.type;
        lines.push(`${indent}- **${name}** (\`${kind}\`, L${e.anchor.start_line})`);
      }
      lines.push("");
    } else {
      const byType: Record<string, DataEntity[]> = {};
      for (const e of data.entities) {
        (byType[e.type] ??= []).push(e);
      }

      for (const [type, entities] of Object.entries(byType)) {
        lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} (${entities.length})\n`);
        for (const e of entities) {
          lines.push(entityToMd(e));
        }
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push(`**${fileCount} files · ${entityCount} entities · ${enrichedCount} enriched**\n`);

  console.log(lines.join("\n"));
}

main();
