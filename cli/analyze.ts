import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { extractConcepts } from "./extractors/concept.js";
import { extractFlow, type FlowData } from "./extractors/flow.js";
import { extractHistory } from "./extractors/history.js";
import { extractJumps } from "./extractors/jump.js";
import type { DataEntity, FileAnalysis, Manifest, ManifestEntry } from "./types.js";

interface CallGraphEntry {
  file: string;
  imports: { source: string; names: string[] }[];
  exports: string[];
  calls: { callee: string; inFunction: string | null }[];
}

const VIBE_DIR = ".vibe-reading";
const FILES_DIR = path.join(VIBE_DIR, "files");
const GLOBAL_DIR = path.join(VIBE_DIR, "global");

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.vibe-reading/**",
  "**/dist/**",
  "**/out/**",
  "**/build/**",
  "**/*.min.js",
  "**/*.map",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
];

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go",
  ".java", ".c", ".cpp", ".h", ".hpp", ".rb", ".php",
  ".swift", ".kt", ".scala", ".cs", ".lua", ".zig",
  ".vue", ".svelte", ".astro",
]);

async function main() {
  const projectRoot = process.argv[2] || process.cwd();
  console.log(`[vibe-reading] Analyzing: ${projectRoot}`);

  fs.mkdirSync(path.join(projectRoot, FILES_DIR), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, GLOBAL_DIR), { recursive: true });

  const files = await glob("**/*", {
    cwd: projectRoot,
    nodir: true,
    ignore: IGNORE_PATTERNS,
    dot: false,
  });

  const sourceFiles = files.filter((f) =>
    CODE_EXTENSIONS.has(path.extname(f).toLowerCase())
  );

  console.log(`[vibe-reading] Found ${sourceFiles.length} source files`);

  const manifestEntries: ManifestEntry[] = [];
  const callGraph: CallGraphEntry[] = [];

  for (const file of sourceFiles) {
    const absPath = path.join(projectRoot, file);
    try {
      const { analysis, flowData } = await analyzeFile(file, absPath, projectRoot, sourceFiles);
      const outName = file.replace(/[/\\]/g, "__") + ".json";
      const outPath = path.join(projectRoot, FILES_DIR, outName);
      fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2));

      manifestEntries.push({
        path: file,
        status: "analyzed",
        entity_count: analysis.entities.length,
      });

      callGraph.push({
        file,
        imports: flowData.imports.map((i) => ({ source: i.source, names: i.names })),
        exports: flowData.exports,
        calls: flowData.calls,
      });

      console.log(`  [ok] ${file} → ${analysis.entities.length} entities`);
    } catch (err) {
      manifestEntries.push({ path: file, status: "failed", entity_count: 0 });
      console.error(`  [fail] ${file}: ${err}`);
    }
  }

  const manifest: Manifest = {
    project: path.basename(projectRoot),
    analyzed_at: new Date().toISOString(),
    total_files: sourceFiles.length,
    analyzed_files: manifestEntries.filter((e) => e.status === "analyzed").length,
    coverage: sourceFiles.length > 0
      ? manifestEntries.filter((e) => e.status === "analyzed").length / sourceFiles.length
      : 1,
    files: manifestEntries,
  };

  fs.writeFileSync(
    path.join(projectRoot, VIBE_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  fs.writeFileSync(
    path.join(projectRoot, GLOBAL_DIR, "call-graph.json"),
    JSON.stringify({
      generated_at: new Date().toISOString(),
      files: callGraph,
    }, null, 2)
  );

  const totalEntities = manifestEntries.reduce((sum, e) => sum + e.entity_count, 0);

  console.log(
    `\n[vibe-reading] Done. Coverage: ${(manifest.coverage * 100).toFixed(1)}% ` +
    `(${manifest.analyzed_files}/${manifest.total_files})`
  );
  console.log(`[vibe-reading] Total entities: ${totalEntities}`);
  console.log(`[vibe-reading] Call graph: ${callGraph.length} files`);
}

async function analyzeFile(
  relativePath: string,
  absPath: string,
  projectRoot: string,
  allFiles: string[]
): Promise<{ analysis: FileAnalysis; flowData: FlowData }> {
  const content = fs.readFileSync(absPath, "utf-8");

  const concepts = await extractConcepts(relativePath, content);
  const flowData = await extractFlow(relativePath, content);
  const historyEntities = await extractHistory(relativePath, content, projectRoot);
  const jumpEntities = await extractJumps(relativePath, content, allFiles);

  const entities: DataEntity[] = [...concepts, ...flowData.entities, ...historyEntities, ...jumpEntities];

  return {
    analysis: {
      file: relativePath,
      entities,
      analyzed_at: new Date().toISOString(),
    },
    flowData,
  };
}

main().catch((err) => {
  console.error("[vibe-reading] Fatal:", err);
  process.exit(1);
});
