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

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0];
  if (!projectRoot) {
    console.error("Usage: npx tsx export-md.ts <project-root> [--file <path>]");
    process.exit(1);
  }

  const fileArg = args.indexOf("--file");
  const specificFile = fileArg >= 0 ? args[fileArg + 1] : null;

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(filesDir)
    .filter(f => f.endsWith(".json"))
    .sort();

  const lines: string[] = [`# ${path.basename(path.resolve(projectRoot))} — Analysis Summary\n`];

  for (const jf of jsonFiles) {
    const data: FileAnalysis = JSON.parse(fs.readFileSync(path.join(filesDir, jf), "utf-8"));
    if (specificFile && data.file !== specificFile) continue;

    lines.push(`## ${data.file}\n`);

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

  console.log(lines.join("\n"));
}

main();
