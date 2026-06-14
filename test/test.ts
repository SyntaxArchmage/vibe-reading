import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CLI_DIR = path.join(__dirname, "..", "cli");
const FIXTURE_DIR = path.join(__dirname, "fixture");
const VIBE_DIR = path.join(FIXTURE_DIR, ".vibe-reading");

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

function cleanOutput() {
  if (fs.existsSync(VIBE_DIR)) {
    fs.rmSync(VIBE_DIR, { recursive: true });
  }
}

function run(cmd: string): string {
  return execSync(cmd, { cwd: CLI_DIR, encoding: "utf-8" });
}

// === Test 1: analyze creates correct output structure ===
console.log("\nTest 1: Analyze creates correct output structure");
cleanOutput();
const analyzeOut = run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
assert(analyzeOut.includes("100.0%"), "Coverage is 100%");
assert(fs.existsSync(path.join(VIBE_DIR, "manifest.json")), "manifest.json exists");
assert(fs.existsSync(path.join(VIBE_DIR, "files")), "files/ directory exists");
assert(fs.existsSync(path.join(VIBE_DIR, "global")), "global/ directory exists");

// === Test 2: Per-file JSONs created for each source file ===
console.log("\nTest 2: Per-file JSONs created correctly");
const filesDir = path.join(VIBE_DIR, "files");
const jsonFiles = fs.readdirSync(filesDir);
assert(jsonFiles.length === 5, `5 JSON files created (got ${jsonFiles.length})`);
assert(jsonFiles.some(f => f.includes("scheduler.ts")), "scheduler.ts JSON exists");
assert(jsonFiles.some(f => f.includes("engine.py")), "engine.py JSON exists");
assert(jsonFiles.some(f => f.includes("utils.js")), "utils.js JSON exists");
assert(jsonFiles.some(f => f.includes("empty.ts")), "empty.ts JSON exists");

// === Test 3: TypeScript extraction accuracy ===
console.log("\nTest 3: TypeScript extraction accuracy (scheduler.ts)");
const schedulerData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const tsEntities = schedulerData.entities;
const tsNames = tsEntities.map((e: { summary: string }) => e.summary);
assert(tsEntities.length >= 5, `At least 5 entities (got ${tsEntities.length})`);
assert(tsNames.some((n: string) => n.includes("Task")), "Found interface Task");
assert(tsNames.some((n: string) => n.includes("Scheduler")), "Found class Scheduler");
assert(tsNames.some((n: string) => n.includes("enqueue")), "Found method enqueue");
assert(tsNames.some((n: string) => n.includes("run")), "Found method run");
assert(tsNames.some((n: string) => n.includes("createTask")), "Found function createTask");

// Verify anchors have correct line numbers
const schedulerClass = tsEntities.find((e: { summary: string }) => e.summary.includes("Scheduler"));
assert(schedulerClass && schedulerClass.anchor.start_line === 9, `Scheduler class starts at L9 (got L${schedulerClass?.anchor?.start_line})`);

// === Test 4: Python extraction accuracy ===
console.log("\nTest 4: Python extraction accuracy (engine.py)");
const engineData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__engine.py.json"), "utf-8")
);
const pyEntities = engineData.entities;
const pyNames = pyEntities.map((e: { summary: string }) => e.summary);
assert(pyEntities.length >= 5, `At least 5 entities (got ${pyEntities.length})`);
assert(pyNames.some((n: string) => n.includes("Config")), "Found class Config");
assert(pyNames.some((n: string) => n.includes("Engine")), "Found class Engine");
assert(pyNames.some((n: string) => n.includes("__init__")), "Found __init__");
assert(pyNames.some((n: string) => n.includes("create_engine")), "Found function create_engine");

// === Test 5: JavaScript extraction accuracy ===
console.log("\nTest 5: JavaScript extraction accuracy (utils.js)");
const utilsData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__utils.js.json"), "utf-8")
);
const jsEntities = utilsData.entities;
const jsNames = jsEntities.map((e: { summary: string }) => e.summary);
assert(jsEntities.length >= 3, `At least 3 entities (got ${jsEntities.length})`);
assert(jsNames.some((n: string) => n.includes("debounce")), "Found function debounce");
assert(jsNames.some((n: string) => n.includes("deepClone")), "Found function deepClone");
assert(jsNames.some((n: string) => n.includes("EventEmitter")), "Found class EventEmitter");

// === Test 6: Entity structure correctness ===
console.log("\nTest 6: Entity structure correctness");
const entity = tsEntities[0];
assert("anchor" in entity, "Entity has anchor");
assert("type" in entity, "Entity has type");
assert("summary" in entity, "Entity has summary");
assert("detail" in entity, "Entity has detail");
assert(entity.type === "concept", 'Entity type is "concept"');
assert(typeof entity.anchor.file === "string", "Anchor has file (string)");
assert(typeof entity.anchor.start_line === "number", "Anchor has start_line (number)");
assert(typeof entity.anchor.start_col === "number", "Anchor has start_col (number)");
assert(entity.anchor.start_line >= 1, "start_line is 1-based (>= 1)");

// === Test 7: Manifest correctness ===
console.log("\nTest 7: Manifest correctness");
const manifest = JSON.parse(
  fs.readFileSync(path.join(VIBE_DIR, "manifest.json"), "utf-8")
);
assert(manifest.total_files === 5, `Total files is 5 (got ${manifest.total_files})`);
assert(manifest.analyzed_files === 5, `Analyzed files is 5 (got ${manifest.analyzed_files})`);
assert(manifest.coverage === 1, `Coverage is 1.0 (got ${manifest.coverage})`);
assert(manifest.files.every((f: { status: string }) => f.status === "analyzed"), "All files have status 'analyzed'");

// === Test 8: Harness passes ===
console.log("\nTest 8: Harness verification");
const harnessOut = run(`npx tsx harness.ts ${FIXTURE_DIR}`);
assert(harnessOut.includes("100% coverage"), "Harness reports 100% coverage");
assert(harnessOut.includes("✓"), "Harness passes with checkmark");

// === Test 9: Enrich tool updates entity data ===
console.log("\nTest 9: Enrich tool");
const enrichJson = JSON.stringify([
  { name: "Task", summary: "Task contract for scheduler", description: "Defines the unit of work." },
]);
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${enrichJson}'`);
const enrichedData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const taskEntity = enrichedData.entities.find((e: { detail: { name: string } }) => e.detail.name === "Task");
assert(taskEntity?.summary === "Task contract for scheduler", `Enriched summary (got "${taskEntity?.summary}")`);
assert(taskEntity?.detail?.description === "Defines the unit of work.", `Enriched description (got "${taskEntity?.detail?.description}")`);

// Non-enriched entities should keep placeholder
const otherEntity = enrichedData.entities.find((e: { detail: { name: string } }) => e.detail.name === "Scheduler");
assert(otherEntity?.summary.includes("Scheduler"), `Non-enriched entity keeps name (got "${otherEntity?.summary}")`);

// === Test 9.5: Enrich --from-file ===
console.log("\nTest 9.5: Enrich --from-file");
const enrichFilePath = path.join(FIXTURE_DIR, ".vibe-reading", "tmp-enrich.json");
fs.writeFileSync(enrichFilePath, JSON.stringify([
  { name: "Scheduler", summary: "Priority task scheduler", description: "Manages async tasks by priority." },
]));
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts --from-file ${enrichFilePath}`);
const enrichedByFile = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const schedulerEnriched = enrichedByFile.entities.find((e: { detail: { name: string } }) => e.detail.name === "Scheduler");
assert(schedulerEnriched?.summary === "Priority task scheduler", `--from-file enriched summary (got "${schedulerEnriched?.summary}")`);
fs.unlinkSync(enrichFilePath);

// === Test 10: Flow entity extraction ===
console.log("\nTest 10: Flow entity extraction");
const schedulerFlow = schedulerData.entities.filter((e: { type: string }) => e.type === "flow");
assert(schedulerFlow.length >= 2, `At least 2 flow entities in scheduler.ts (got ${schedulerFlow.length})`);
const enqueueFlow = schedulerFlow.find((e: { summary: string }) => e.summary.includes("enqueue calls"));
assert(!!enqueueFlow, "Found enqueue call flow");
const runFlow = schedulerFlow.find((e: { summary: string }) => e.summary.includes("run calls"));
assert(!!runFlow, "Found run call flow");

const utilsFlow = jsEntities.filter((e: { type: string }) => e.type === "flow");
assert(utilsFlow.length >= 2, `At least 2 flow entities in utils.js (got ${utilsFlow.length})`);
const debounceFlow = utilsFlow.find((e: { summary: string }) => e.summary.includes("debounce calls"));
assert(!!debounceFlow, "Found debounce call flow (setTimeout, clearTimeout)");

// Re-read to get flow entities from the fresh analysis
const utilsDataFull = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__utils.js.json"), "utf-8")
);
const utilsFlowFull = utilsDataFull.entities.filter((e: { type: string }) => e.type === "flow");
const deepCloneFlow = utilsFlowFull.find((e: { summary: string }) => e.summary.includes("deepClone"));
assert(!!deepCloneFlow, "Found deepClone call flow (JSON.parse, JSON.stringify)");

// === Test 11: Call graph generation ===
console.log("\nTest 11: Call graph generation");
const callGraphPath = path.join(VIBE_DIR, "global", "call-graph.json");
assert(fs.existsSync(callGraphPath), "call-graph.json exists");
const callGraph = JSON.parse(fs.readFileSync(callGraphPath, "utf-8"));
assert(callGraph.files.length === 5, `Call graph has 5 files (got ${callGraph.files.length})`);
const cgScheduler = callGraph.files.find((f: { file: string }) => f.file.includes("scheduler.ts"));
assert(!!cgScheduler, "Call graph contains scheduler.ts");
assert(cgScheduler.exports.length > 0, "Scheduler has exports in call graph");
assert(cgScheduler.calls.length > 0, "Scheduler has calls in call graph");

// === Test 11.5: History entity extraction ===
console.log("\nTest 11.5: History entity extraction");
const reloadedScheduler = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const schedulerHist = reloadedScheduler.entities.filter((e: { type: string }) => e.type === "history");
assert(schedulerHist.length >= 1, `At least 1 history entity in scheduler.ts (got ${schedulerHist.length})`);
const fileHistory = schedulerHist.find((e: { detail: { kind: string } }) => e.detail.kind === "file_history");
assert(!!fileHistory, "Found file_history entity");
assert(typeof fileHistory.detail.total_commits === "number", "file_history has total_commits");

// === Test 11.7: Jump entity extraction ===
console.log("\nTest 11.7: Jump entity extraction");
// Re-analyze to pick up new local import in scheduler.ts
cleanOutput();
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
const reanalyzedScheduler = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const schedulerJumps = reanalyzedScheduler.entities.filter((e: { type: string }) => e.type === "jump");
assert(schedulerJumps.length >= 1, `At least 1 jump entity in scheduler.ts (got ${schedulerJumps.length})`);
if (schedulerJumps.length > 0) {
  const jumpEntity = schedulerJumps[0];
  assert(jumpEntity.type === "jump", "Jump entity has correct type");
  assert(typeof jumpEntity.detail.target_file === "string", "Jump entity has target_file");
  assert(jumpEntity.detail.kind === "import_jump", "Jump entity has kind import_jump");
}

// === Test 11.8: File analysis has analyzed_at timestamp ===
console.log("\nTest 11.8: File analysis has analyzed_at timestamp");
assert(typeof reanalyzedScheduler.analyzed_at === "string", "File analysis has analyzed_at (string)");
assert(!isNaN(Date.parse(reanalyzedScheduler.analyzed_at)), "analyzed_at is a valid ISO date");

// === Test 12: Edge case — empty file extraction ===
console.log("\nTest 12: Edge case — empty file extraction");
const emptyFile = jsonFiles.find((f: string) => f.includes("empty.ts"));
assert(!!emptyFile, "empty.ts JSON was created");
if (emptyFile) {
  const emptyData = JSON.parse(
    fs.readFileSync(path.join(filesDir, emptyFile), "utf-8")
  );
  assert(emptyData.entities.length === 0 || emptyData.entities.every(
    (e: { type: string }) => e.type === "history" || e.type === "flow"
  ), "Empty file has no concept entities (may have history/flow)");
}

// === Test 12.5: Auto-enrich generates descriptions from JSDoc ===
console.log("\nTest 12.5: Auto-enrich from JSDoc");
// Re-analyze first to reset enrichments
cleanOutput();
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
const autoEnrichOut = run(`npx tsx auto-enrich.ts ${FIXTURE_DIR}`);
assert(autoEnrichOut.includes("auto-enrich"), "Auto-enrich runs without error");

// Check that utils.js got enriched (it has JSDoc comments)
const utilsAfterAutoEnrich = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__utils.js.json"), "utf-8")
);
const debounceEntity = utilsAfterAutoEnrich.entities.find(
  (e: { detail: { name: string } }) => e.detail.name === "debounce"
);
assert(
  debounceEntity && !debounceEntity.summary.startsWith("function:"),
  `Auto-enrich updated debounce summary (got "${debounceEntity?.summary}")`
);

// === Test 13: Schema validation rejects malformed data ===
console.log("\nTest 13: Schema validation rejects malformed data");

// Create a malformed JSON file
const malformedDir = path.join(FIXTURE_DIR, ".vibe-reading-malformed");
const malformedFilesDir = path.join(malformedDir, "files");
fs.mkdirSync(malformedFilesDir, { recursive: true });

// Malformed: missing anchor, bad type
const malformedData = {
  file: "src/bad.ts",
  entities: [
    { type: "invalid_type", summary: "", detail: {} },
    { anchor: { file: "src/bad.ts", start_line: 0, start_col: -1, end_line: 0, end_col: 0 }, type: "concept", summary: "ok", detail: {} },
    { anchor: { file: "src/bad.ts", start_line: 5, start_col: 0, end_line: 3, end_col: 0 }, type: "concept", summary: "reversed lines", detail: {} },
  ],
};
fs.writeFileSync(path.join(malformedFilesDir, "src__bad.ts.json"), JSON.stringify(malformedData));

const malformedManifest = {
  project: "test-malformed",
  analyzed_at: new Date().toISOString(),
  total_files: 1,
  analyzed_files: 1,
  coverage: 1,
  files: [{ path: "src/bad.ts", status: "analyzed", entity_count: 3 }],
};
fs.writeFileSync(path.join(malformedDir, "manifest.json"), JSON.stringify(malformedManifest));

// Temporarily rename dirs so harness picks up malformed data
const origVibeDir = path.join(FIXTURE_DIR, ".vibe-reading");
const tempVibeDir = path.join(FIXTURE_DIR, ".vibe-reading-orig");
fs.renameSync(origVibeDir, tempVibeDir);
fs.renameSync(malformedDir, origVibeDir);

let harnessExit = 0;
try {
  run(`npx tsx harness.ts ${FIXTURE_DIR}`);
} catch {
  harnessExit = 1;
}
assert(harnessExit === 1, "Harness rejects malformed JSON (exit code 1)");

// Restore
fs.renameSync(origVibeDir, malformedDir);
fs.renameSync(tempVibeDir, origVibeDir);
fs.rmSync(malformedDir, { recursive: true });

// === Test 13: Schema validation passes valid data ===
console.log("\nTest 13: Schema validation passes valid data");
const harnessValidOut = run(`npx tsx harness.ts ${FIXTURE_DIR}`);
assert(harnessValidOut.includes("Schema valid"), "Harness reports schema valid for good data");

// === Test 14: Stats tool ===
console.log("\nTest 14: Stats tool");
const statsOut = run(`npx tsx stats.ts ${FIXTURE_DIR}`);
assert(statsOut.includes("Project:"), "Stats shows project name");
assert(statsOut.includes("Concepts:"), "Stats shows concept count");
assert(statsOut.includes("Flow:"), "Stats shows flow count");
assert(statsOut.includes("Top files by entity count"), "Stats shows top files");

// === Test 15: Enrichment detection ===
console.log("\nTest 15: Enrichment detection");
cleanOutput();
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
const preEnrichData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const placeholderEntity = preEnrichData.entities.find(
  (e: { detail: { name: string; description?: string } }) =>
    e.detail.name === "enqueue" && e.detail.description?.match(/^function ".+" spanning \d+ lines\.$/)
);
assert(!!placeholderEntity, "Non-enriched entity has placeholder description");

// Enrich one entity, then verify detection
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${JSON.stringify([
  { name: "Scheduler", summary: "Priority task scheduler", description: "Manages async tasks by priority." },
])}'`);
const postEnrichData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const enrichedEntity = postEnrichData.entities.find(
  (e: { detail: { name: string } }) => e.detail.name === "Scheduler"
);
assert(
  enrichedEntity?.detail?.description === "Manages async tasks by priority.",
  "Enriched entity has real description"
);

// === Test 16: Re-analyze resets entities from source ===
console.log("\nTest 16: Re-analyze resets entities");
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
const afterReanalyze = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const schedulerAfter = afterReanalyze.entities.find(
  (e: { detail: { name: string } }) => e.detail.name === "Scheduler"
);
assert(
  schedulerAfter?.detail?.description?.includes("spanning"),
  "Re-analyze produces fresh placeholder descriptions"
);

// === Test 17: Python flow extraction ===
console.log("\nTest 17: Python flow extraction");
const pyFlowData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__engine.py.json"), "utf-8")
);
const pyFlowEntities = pyFlowData.entities.filter((e: { type: string }) => e.type === "flow");
const pyImportFlow = pyFlowEntities.find((e: { detail: { kind: string } }) => e.detail.kind === "imports");
assert(!!pyImportFlow, "Python has import flow entity");
assert(
  (pyImportFlow?.detail?.external_deps as string[])?.length >= 2,
  `Python has external deps (got ${(pyImportFlow?.detail?.external_deps as string[])?.length})`
);

// === Test 18: TypeScript export flow entity ===
console.log("\nTest 18: TypeScript export flow entity");
const tsFlowData = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
);
const tsExportFlow = tsFlowData.entities.find(
  (e: { type: string; detail: { kind: string } }) => e.type === "flow" && e.detail.kind === "exports"
);
assert(!!tsExportFlow, "TypeScript has export flow entity");
assert(
  (tsExportFlow?.detail?.names as string[])?.length > 0,
  "Export entity has exported names"
);

// === Test 19: Python decorated class extraction ===
console.log("\nTest 19: Python decorated class extraction");
const pyConfig = pyEntities.find(
  (e: { detail: { name: string } }) => e.detail.name === "Config"
);
assert(!!pyConfig, "Found @dataclass Config");
assert(
  pyConfig?.detail?.kind === "class" || pyConfig?.detail?.kind === "decorated",
  `Config kind is class or decorated (got ${pyConfig?.detail?.kind})`
);

// === Test 20: Empty file has no concept entities ===
console.log("\nTest 20: Empty file concept entities");
const emptyData2 = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__empty.ts.json"), "utf-8")
);
const emptyConcepts = emptyData2.entities.filter((e: { type: string }) => e.type === "concept");
assert(emptyConcepts.length === 0, "Empty file has zero concept entities");

// === Test 21: Python docstring auto-enrich ===
console.log("\nTest 21: Python docstring auto-enrich");
cleanOutput();
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
run(`npx tsx auto-enrich.ts ${FIXTURE_DIR}`);
const pyAfterEnrich = JSON.parse(
  fs.readFileSync(path.join(filesDir, "src__engine.py.json"), "utf-8")
);
const createEngineEntity = pyAfterEnrich.entities.find(
  (e: { detail: { name: string } }) => e.detail.name === "create_engine"
);
assert(
  createEngineEntity && !createEngineEntity.summary.startsWith("function:"),
  `Python docstring enriched create_engine (got "${createEngineEntity?.summary}")`
);

// === Test 22: Harness enrichment tracking ===
console.log("\nTest 22: Harness enrichment tracking");
{
  cleanOutput();
  run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
  run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${JSON.stringify([
    { name: "Task", summary: "Task interface", description: "Defines work units." },
  ])}'`);
  const harnessOut2 = run(`npx tsx harness.ts ${FIXTURE_DIR}`);
  assert(harnessOut2.includes("Enrichment:"), "Harness reports enrichment stats");
  assert(harnessOut2.includes("/"), "Enrichment shows X/Y format");
}

// === Test 23: Call graph correctness ===
console.log("\nTest 23: Call graph details");
{
  cleanOutput();
  run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
  const cg = JSON.parse(fs.readFileSync(path.join(VIBE_DIR, "global", "call-graph.json"), "utf-8"));
  assert(typeof cg.generated_at === "string", "Call graph has generated_at timestamp");
  const utilsCg = cg.files.find((f: { file: string }) => f.file.includes("utils.js"));
  assert(!!utilsCg, "Call graph contains utils.js");
  assert(utilsCg.calls.length > 0, "utils.js has calls in call graph");
}

// === Test 24: Entity anchor correctness ===
console.log("\nTest 24: Entity anchor consistency");
{
  cleanOutput();
  run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
  const allFiles = fs.readdirSync(path.join(VIBE_DIR, "files")).filter((f: string) => f.endsWith(".json"));
  let totalEntities = 0;
  let badAnchors = 0;
  for (const f of allFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(VIBE_DIR, "files", f), "utf-8"));
    for (const e of data.entities) {
      totalEntities++;
      if (e.anchor.start_line > e.anchor.end_line) badAnchors++;
      if (e.anchor.start_line < 1) badAnchors++;
    }
  }
  assert(totalEntities > 0, `Total entities across all files > 0 (got ${totalEntities})`);
  assert(badAnchors === 0, `No invalid anchors (got ${badAnchors})`);
}

// === Test 25: Manifest consistency ===
console.log("\nTest 25: Manifest consistency");
{
  const manifest = JSON.parse(
    fs.readFileSync(path.join(VIBE_DIR, "manifest.json"), "utf-8")
  );
  const jsonCount = fs.readdirSync(path.join(VIBE_DIR, "files")).filter((f: string) => f.endsWith(".json")).length;
  assert(
    manifest.analyzed_files === jsonCount,
    `Manifest analyzed_files matches JSON count (${manifest.analyzed_files} vs ${jsonCount})`
  );
  assert(
    typeof manifest.analyzed_at === "string" && !isNaN(Date.parse(manifest.analyzed_at)),
    "Manifest has valid analyzed_at timestamp"
  );
}

// === Test 26: Python concept extraction depth ===
console.log("\nTest 26: Python method extraction");
{
  const data = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__engine.py.json"), "utf-8")
  );
  const pyConcepts = data.entities.filter((e: { type: string }) => e.type === "concept");
  const initMethod = pyConcepts.find((e: { detail: { name: string } }) => e.detail.name === "__init__");
  assert(!!initMethod, "Found __init__ method in Python");
  const startMethod = pyConcepts.find((e: { detail: { name: string } }) => e.detail.name === "start");
  assert(!!startMethod, "Found start method in Python");
  assert(pyConcepts.length >= 8, `At least 8 Python concepts (got ${pyConcepts.length})`);
}

// === Test 27: Multiple entity types per file ===
console.log("\nTest 27: Multiple entity types per file");
{
  const data = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const types = new Set(data.entities.map((e: { type: string }) => e.type));
  assert(types.has("concept"), "scheduler.ts has concept entities");
  assert(types.has("flow"), "scheduler.ts has flow entities");
  assert(types.has("jump"), "scheduler.ts has jump entities");
  assert(types.size >= 3, `At least 3 entity types (got ${types.size})`);
}

// --- Test 28: TSX component extraction ---
{
  console.log("\n--- Test 28: TSX component extraction ---");
  cleanOutput();
  run("npx tsx analyze.ts ../test/fixture");
  const buttonPath = path.join(filesDir, "src__Button.tsx.json");
  assert(fs.existsSync(buttonPath), "Button.tsx analysis file exists");
  const buttonData = JSON.parse(fs.readFileSync(buttonPath, "utf-8"));
  const concepts = buttonData.entities.filter((e: any) => e.type === "concept");
  const names = concepts.map((c: any) => c.detail.name);
  assert(names.includes("Button"), "TSX: Button function extracted");
  assert(names.includes("ButtonProps"), "TSX: ButtonProps interface extracted");
  const flows = buttonData.entities.filter((e: any) => e.type === "flow");
  const importEntity = flows.find((f: any) => f.detail.kind === "imports");
  assert(importEntity && importEntity.detail.all_names.includes("useState"), "TSX: useState import extracted");
  const exportEntity = flows.find((f: any) => f.detail.kind === "exports");
  assert(exportEntity !== undefined, "TSX: export entity exists");
  assert(exportEntity.detail.names.includes("Button"), "TSX: Button is exported");
  assert(!exportEntity.detail.names.includes("pressed"), "TSX: internal var 'pressed' not in exports");
  assert(!exportEntity.detail.names.includes("label"), "TSX: parameter 'label' not in exports");
}

// --- Test 29: export const extraction ---
{
  console.log("\n--- Test 29: export const extraction ---");
  const schedData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const exports = schedData.entities.find(
    (e: any) => e.type === "flow" && e.detail.kind === "exports"
  );
  assert(exports !== undefined, "scheduler.ts has exports entity");
  assert(exports.detail.names.includes("DEFAULT_PRIORITY"), "export const DEFAULT_PRIORITY extracted");
  assert(exports.detail.names.includes("Task"), "export interface Task extracted");
  assert(exports.detail.names.includes("Scheduler"), "export class Scheduler extracted");
  assert(exports.detail.names.includes("createTask"), "export function createTask extracted");
  assert(!exports.detail.names.includes("priority"), "parameter 'priority' not in exports");
}

// --- Test 30: History entity structure ---
{
  console.log("\n--- Test 30: History entity structure ---");
  const schedData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const histEntities = schedData.entities.filter((e: any) => e.type === "history");
  assert(histEntities.length >= 1, "scheduler.ts has history entities");
  const fileHist = histEntities.find((e: any) => e.detail.kind === "file_history");
  assert(fileHist !== undefined, "scheduler.ts has file_history entity");
  assert(typeof fileHist.detail.total_commits === "number", "file_history has total_commits number");
  assert(typeof fileHist.detail.last_modified === "string", "file_history has last_modified string");
  assert(typeof fileHist.detail.last_author === "string", "file_history has last_author string");
}

// --- Test 31: Auto-enrich preserves non-concept entities ---
{
  console.log("\n--- Test 31: Auto-enrich preserves non-concept entities ---");
  cleanOutput();
  run("npx tsx analyze.ts ../test/fixture");
  const beforeFile = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const beforeFlowCount = beforeFile.entities.filter((e: any) => e.type === "flow").length;
  const beforeHistCount = beforeFile.entities.filter((e: any) => e.type === "history").length;
  run("npx tsx auto-enrich.ts ../test/fixture");
  const afterFile = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const afterFlowCount = afterFile.entities.filter((e: any) => e.type === "flow").length;
  const afterHistCount = afterFile.entities.filter((e: any) => e.type === "history").length;
  assert(afterFlowCount === beforeFlowCount, `Flow entities preserved after auto-enrich (${afterFlowCount})`);
  assert(afterHistCount === beforeHistCount, `History entities preserved after auto-enrich (${afterHistCount})`);
}

// --- Test 32: Jump entity target file resolution ---
{
  console.log("\n--- Test 32: Jump entity target file resolution ---");
  const buttonData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__Button.tsx.json"), "utf-8")
  );
  const jumpEntities = buttonData.entities.filter((e: any) => e.type === "jump");
  for (const j of jumpEntities) {
    assert(typeof j.detail.target_file === "string", `Jump has target_file: ${j.detail.target_file}`);
    assert(typeof j.detail.reason === "string", `Jump has reason`);
  }
}

// --- Test 33: Python __all__ export extraction ---
{
  console.log("\n--- Test 33: Python __all__ export extraction ---");
  const engineData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__engine.py.json"), "utf-8")
  );
  const exports = engineData.entities.find(
    (e: any) => e.type === "flow" && e.detail.kind === "exports"
  );
  assert(exports !== undefined, "Python file has exports entity");
  assert(exports.detail.names.includes("Config"), "Python __all__ includes Config");
  assert(exports.detail.names.includes("Engine"), "Python __all__ includes Engine");
  assert(exports.detail.names.includes("create_engine"), "Python __all__ includes create_engine");
  assert(exports.detail.names.length === 3, `Python __all__ has exactly 3 names (got ${exports.detail.names.length})`);
}

// --- Test 34: Call graph has correct import/export data ---
{
  console.log("\n--- Test 34: Call graph data correctness ---");
  const cgPath = path.join(VIBE_DIR, "global", "call-graph.json");
  const cg = JSON.parse(fs.readFileSync(cgPath, "utf-8"));
  const scheduler = cg.files.find((f: any) => f.file === "src/scheduler.ts");
  assert(scheduler !== undefined, "Call graph has scheduler.ts");
  assert(scheduler.exports.includes("Scheduler"), "Call graph: Scheduler exported");
  assert(scheduler.exports.includes("DEFAULT_PRIORITY"), "Call graph: DEFAULT_PRIORITY exported");
  const engine = cg.files.find((f: any) => f.file === "src/engine.py");
  assert(engine !== undefined, "Call graph has engine.py");
  assert(engine.exports.includes("Config"), "Call graph: Config in Python __all__");
  assert(engine.imports.length >= 2, `Call graph: engine.py has imports (${engine.imports.length})`);
}

// --- Test 35: Viewer build produces output ---
{
  console.log("\n--- Test 35: Viewer build produces output ---");
  const viewerOut = path.join(__dirname, "..", "viewer", "out", "viewer.js");
  assert(fs.existsSync(viewerOut), "viewer.js build artifact exists");
  const viewerSize = fs.statSync(viewerOut).size;
  assert(viewerSize > 1000, `viewer.js is non-trivial (${(viewerSize / 1024).toFixed(0)} KB)`);
}

// --- Test 36: Entity type distribution per file ---
{
  console.log("\n--- Test 36: Entity type distribution ---");
  const schedData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const types = new Set(schedData.entities.map((e: any) => e.type));
  assert(types.has("concept"), "scheduler.ts has concept entities");
  assert(types.has("flow"), "scheduler.ts has flow entities");
  assert(types.has("history"), "scheduler.ts has history entities");
  assert(types.size >= 3, `scheduler.ts has at least 3 entity types (got ${types.size})`);
}

// --- Test 37: Re-analyze cleans stale files ---
{
  console.log("\n--- Test 37: Re-analyze cleans stale files ---");
  const stalePath = path.join(filesDir, "stale__file.ts.json");
  fs.writeFileSync(stalePath, JSON.stringify({ file: "stale/file.ts", entities: [] }));
  assert(fs.existsSync(stalePath), "Stale file created");
  run("npx tsx analyze.ts ../test/fixture");
  assert(!fs.existsSync(stalePath), "Stale file removed after re-analyze");
}

// --- Test 38: Empty file produces minimal entities ---
{
  console.log("\n--- Test 38: Empty file produces minimal entities ---");
  const emptyData = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__empty.ts.json"), "utf-8")
  );
  assert(emptyData.entities.length >= 0, "empty.ts has non-negative entity count");
  assert(emptyData.file === "src/empty.ts", "empty.ts file field correct");
  const concepts = emptyData.entities.filter((e: any) => e.type === "concept");
  assert(concepts.length <= 1, `Empty file has at most 1 concept (got ${concepts.length})`);
}

// --- Test 39: Anchor consistency across all files ---
{
  console.log("\n--- Test 39: Anchor consistency ---");
  const allJsonFiles = fs.readdirSync(filesDir).filter((f: string) => f.endsWith(".json"));
  let anchorErrors = 0;
  for (const jf of allJsonFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(filesDir, jf), "utf-8"));
    for (const e of data.entities) {
      if (e.anchor.start_line > e.anchor.end_line) anchorErrors++;
      if (e.anchor.start_line < 1) anchorErrors++;
      if (e.anchor.file !== data.file && e.type !== "jump") anchorErrors++;
    }
  }
  assert(anchorErrors === 0, `No anchor consistency errors (found ${anchorErrors})`);
}

// --- Test 40: Auto-enrich JSDoc extraction updates summary ---
{
  console.log("\n--- Test 40: Auto-enrich JSDoc extraction ---");
  // Re-run analyze + auto-enrich to have enriched data
  run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
  run(`npx tsx auto-enrich.ts ${FIXTURE_DIR}`);
  const data = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__utils.js.json"), "utf-8")
  );
  const enriched = data.entities.filter(
    (e: any) => e.type === "concept" && !/^(function|class|type|interface|enum|method|decorated): /.test(e.summary)
  );
  assert(enriched.length > 0, `utils.js has enriched summaries (${enriched.length})`);
  for (const e of enriched) {
    assert(typeof e.summary === "string" && e.summary.length > 0, `Enriched entity ${e.detail.name} has summary`);
  }
}

// --- Test 41: Concept entities have expected fields ---
{
  console.log("\n--- Test 41: Concept entity field completeness ---");
  const data = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const concepts = data.entities.filter((e: any) => e.type === "concept");
  for (const c of concepts) {
    assert(typeof c.detail.kind === "string", `Concept ${c.detail.name}: has kind`);
    assert(typeof c.detail.name === "string" && c.detail.name.length > 0, `Concept ${c.detail.name}: has name`);
    assert(typeof c.detail.body_lines === "number" && c.detail.body_lines > 0, `Concept ${c.detail.name}: has body_lines`);
    assert(typeof c.detail.node_type === "string", `Concept ${c.detail.name}: has node_type`);
  }
}

// --- Test 42: Flow entities have expected kinds ---
{
  console.log("\n--- Test 42: Flow entity kind distribution ---");
  const data = JSON.parse(
    fs.readFileSync(path.join(filesDir, "src__scheduler.ts.json"), "utf-8")
  );
  const flows = data.entities.filter((e: any) => e.type === "flow");
  const kinds = new Set(flows.map((e: any) => e.detail.kind));
  assert(kinds.has("imports"), "Flow entities include imports");
  assert(kinds.has("exports"), "Flow entities include exports");
}

// --- Test 43: export-md produces valid markdown ---
{
  console.log("\n--- Test 43: export-md tool ---");
  const mdOut = run(`npx tsx export-md.ts ${FIXTURE_DIR}`);
  assert(mdOut.includes("# fixture"), "export-md has project title");
  assert(mdOut.includes("## src/scheduler.ts"), "export-md has scheduler section");
  assert(mdOut.includes("### Concept"), "export-md has concept section");
  assert(mdOut.includes("### Flow"), "export-md has flow section");
  // Single file export
  const mdSingle = run(`npx tsx export-md.ts ${FIXTURE_DIR} --file src/engine.py`);
  assert(mdSingle.includes("## src/engine.py"), "single file export works");
  assert(!mdSingle.includes("## src/scheduler.ts"), "single file excludes other files");
}

// --- Test 44: Full pipeline (analyze → auto-enrich → harness) ---
{
  console.log("\n--- Test 33: Full pipeline ---");
  cleanOutput();
  run("npx tsx analyze.ts ../test/fixture");
  run("npx tsx auto-enrich.ts ../test/fixture");
  const harnessOut = run("npx tsx harness.ts ../test/fixture");
  assert(harnessOut.includes("100.0%"), "Harness shows 100% coverage after full pipeline");
  assert(harnessOut.includes("Schema valid"), "Harness reports valid schema");
  assert(!harnessOut.includes("schema errors"), "No schema errors in harness output");
}

// === Summary ===
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
