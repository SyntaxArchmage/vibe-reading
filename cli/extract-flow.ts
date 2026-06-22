/**
 * Extract call graph / flow data from a project.
 * Requires analyze.ts to have been run first.
 *
 * Usage: npx tsx extract-flow.ts <project-root>
 *
 * Output: <project-root>/.vibe-reading/global/flow.json
 */
import * as fs from "fs";
import * as path from "path";
import { extractFlow } from "./extractors/flow.js";

async function main() {
  const projectRoot = process.argv[2];
  if (!projectRoot) {
    console.error("Usage: npx tsx extract-flow.ts <project-root>");
    process.exit(1);
  }

  const resolved = path.resolve(projectRoot);
  const globalDir = path.join(resolved, ".vibe-reading", "global");
  fs.mkdirSync(globalDir, { recursive: true });

  console.log(`[flow] Extracting call graph from: ${resolved}`);

  const flow = await extractFlow(resolved);

  console.log(`[flow] Nodes: ${flow.nodes.length}`);
  console.log(`[flow] Edges: ${flow.edges.length}`);
  console.log(`[flow] Segments: ${flow.segments.length}`);

  if (flow.segments.length > 0) {
    console.log(`[flow] Detected flows:`);
    for (const seg of flow.segments) {
      console.log(`  • ${seg.name} (${seg.path.length} steps)`);
    }
  }

  const outPath = path.join(globalDir, "flow.json");
  fs.writeFileSync(outPath, JSON.stringify(flow, null, 2));
  console.log(`[flow] Written to: ${outPath}`);
}

main().catch((err) => {
  console.error("[flow] Fatal:", err);
  process.exit(1);
});
