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
assert(jsonFiles.length === 4, `4 JSON files created (got ${jsonFiles.length})`);
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
assert(manifest.total_files === 4, `Total files is 4 (got ${manifest.total_files})`);
assert(manifest.analyzed_files === 4, `Analyzed files is 4 (got ${manifest.analyzed_files})`);
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
assert(callGraph.files.length === 4, `Call graph has 4 files (got ${callGraph.files.length})`);
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
assert(statsOut.includes("Largest file:"), "Stats shows largest file");

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

// === Summary ===
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
