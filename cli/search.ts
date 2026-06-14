/**
 * Search entities across all analyzed files.
 * Usage: npx tsx search.ts <project-root> <query> [--type concept|flow|history|jump] [--limit N]
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis, DataEntity } from "./types.js";

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const query = args[1]?.toLowerCase() || "";
  const typeFlag = args.find(a => a.startsWith("--type="))?.slice(7) || null;
  const kindFlag = args.find(a => a.startsWith("--kind="))?.slice(7)?.toLowerCase() || null;
  const limitFlag = args.find(a => a.startsWith("--limit="));
  const limit = limitFlag ? parseInt(limitFlag.slice(8)) : 20;
  const useRegex = args.includes("--regex");

  if (!query && !typeFlag && !kindFlag) {
    console.error("Usage: npx tsx search.ts <project-root> <query> [--type=concept] [--kind=function] [--limit=20] [--regex]");
    process.exit(1);
  }

  let regex: RegExp | null = null;
  if (useRegex && query) {
    try { regex = new RegExp(query, "i"); } catch { console.error(`Invalid regex: ${query}`); process.exit(1); }
  }

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error("No .vibe-reading/files/ found. Run analyze first.");
    process.exit(1);
  }

  const results: Array<{ file: string; name: string; type: string; kind: string; line: number; summary: string }> = [];

  for (const f of fs.readdirSync(filesDir).filter(f => f.endsWith(".json"))) {
    try {
      const analysis: FileAnalysis = JSON.parse(
        fs.readFileSync(path.join(filesDir, f), "utf-8")
      );
      for (const e of analysis.entities) {
        if (typeFlag && e.type !== typeFlag) continue;
        if (kindFlag && String(e.detail?.kind || "").toLowerCase() !== kindFlag) continue;
        const name = String(e.detail?.name || "").toLowerCase();
        const summary = (e.summary || "").toLowerCase();
        if (regex) {
          if (!regex.test(name) && !regex.test(summary)) continue;
        } else if (query && !name.includes(query) && !summary.includes(query)) {
          continue;
        }
        results.push({
          file: analysis.file,
          name: String(e.detail?.name || e.summary),
          type: e.type,
          kind: String(e.detail?.kind || ""),
          line: e.anchor.start_line,
          summary: e.summary,
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    } catch { /* skip */ }
  }

  if (results.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log(`Found ${results.length} result${results.length > 1 ? "s" : ""}:\n`);
  for (const r of results) {
    console.log(`  ${r.file}:${r.line}  ${r.type}/${r.kind}  ${r.name}`);
    if (r.summary !== r.name) {
      console.log(`    ${r.summary}`);
    }
  }
}

main();
