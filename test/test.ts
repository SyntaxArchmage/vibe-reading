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
  const fixed = cmd.replace(/\bnpx tsx\b/g, path.join(CLI_DIR, "node_modules", ".bin", "tsx"));
  return execSync(fixed, { cwd: CLI_DIR, encoding: "utf-8" });
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
assert(jsonFiles.length === 3, `3 JSON files created (got ${jsonFiles.length})`);
assert(jsonFiles.some(f => f.includes("scheduler.ts")), "scheduler.ts JSON exists");
assert(jsonFiles.some(f => f.includes("engine.py")), "engine.py JSON exists");
assert(jsonFiles.some(f => f.includes("utils.js")), "utils.js JSON exists");

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
assert(schedulerClass && schedulerClass.anchor.start_line === 7, `Scheduler class starts at L7 (got L${schedulerClass?.anchor?.start_line})`);

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
assert(manifest.total_files === 3, `Total files is 3 (got ${manifest.total_files})`);
assert(manifest.analyzed_files === 3, `Analyzed files is 3 (got ${manifest.analyzed_files})`);
assert(manifest.coverage === 1, `Coverage is 1.0 (got ${manifest.coverage})`);
assert(manifest.files.every((f: { status: string }) => f.status === "analyzed"), "All files have status 'analyzed'");

// === Test 8: Harness passes ===
console.log("\nTest 8: Harness verification");
const harnessOut = run(`npx tsx harness.ts ${FIXTURE_DIR}`);
assert(harnessOut.includes("Coverage: 100.0%"), "Harness reports 100% coverage");
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

// === Test 10: Harness rejects invalid schemas ===
console.log("\nTest 10: Harness schema validation (negative cases)");

function harnessExitCode(fixtureDir: string): number {
  try {
    run(`npx tsx harness.ts ${fixtureDir}`);
    return 0;
  } catch (e: any) {
    return e.status ?? 1;
  }
}

// Re-analyze to get clean data
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);

const schedulerJsonPath = path.join(VIBE_DIR, "files", "src__scheduler.ts.json");
const originalScheduler = fs.readFileSync(schedulerJsonPath, "utf-8");

// 10a: Missing entity type
const badType = JSON.parse(originalScheduler);
badType.entities[0].type = "bogus";
fs.writeFileSync(schedulerJsonPath, JSON.stringify(badType));
const harnessOutBadType = (() => {
  try { return run(`npx tsx harness.ts ${FIXTURE_DIR}`); } catch (e: any) { return e.stdout || ""; }
})();
assert(harnessOutBadType.includes("schema") || harnessOutBadType.includes("Schema"), "Harness detects invalid entity type");

// 10b: Missing anchor field
const badAnchor = JSON.parse(originalScheduler);
delete badAnchor.entities[0].anchor.start_line;
fs.writeFileSync(schedulerJsonPath, JSON.stringify(badAnchor));
const harnessOutBadAnchor = (() => {
  try { return run(`npx tsx harness.ts ${FIXTURE_DIR}`); } catch (e: any) { return e.stdout || ""; }
})();
assert(harnessOutBadAnchor.includes("start_line"), "Harness detects missing start_line");

// 10c: Negative start_line
const badLine = JSON.parse(originalScheduler);
badLine.entities[0].anchor.start_line = 0;
fs.writeFileSync(schedulerJsonPath, JSON.stringify(badLine));
const harnessOutBadLine = (() => {
  try { return run(`npx tsx harness.ts ${FIXTURE_DIR}`); } catch (e: any) { return e.stdout || ""; }
})();
assert(harnessOutBadLine.includes("start_line") && harnessOutBadLine.includes(">= 1"), "Harness detects start_line < 1");

// 10d: end_line < start_line
const badRange = JSON.parse(originalScheduler);
badRange.entities[0].anchor.start_line = 10;
badRange.entities[0].anchor.end_line = 5;
fs.writeFileSync(schedulerJsonPath, JSON.stringify(badRange));
const harnessOutBadRange = (() => {
  try { return run(`npx tsx harness.ts ${FIXTURE_DIR}`); } catch (e: any) { return e.stdout || ""; }
})();
assert(harnessOutBadRange.includes("end_line") && harnessOutBadRange.includes("start_line"), "Harness detects end_line < start_line");

// 10e: Entities not an array
const badEntities = JSON.parse(originalScheduler);
badEntities.entities = "not_an_array";
fs.writeFileSync(schedulerJsonPath, JSON.stringify(badEntities));
const harnessOutBadEntities = (() => {
  try { return run(`npx tsx harness.ts ${FIXTURE_DIR}`); } catch (e: any) { return e.stdout || ""; }
})();
assert(harnessOutBadEntities.includes("array"), "Harness detects entities not an array");

// Restore valid data
fs.writeFileSync(schedulerJsonPath, originalScheduler);
assert(harnessExitCode(FIXTURE_DIR) === 0, "Harness passes after restoring valid data");

// === Test 11: Enrich with start_line disambiguation ===
console.log("\nTest 11: Enrich with start_line disambiguation");

// Re-analyze to get fresh data
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);

// First, enrich without start_line (name-only, old behavior)
const enrichNameOnly = JSON.stringify([
  { name: "enqueue", summary: "Enqueue (name-only)", description: "Name-only match." },
]);
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${enrichNameOnly}'`);
const afterNameOnly = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const enqueueEntity = afterNameOnly.entities.find((e: any) => e.detail.name === "enqueue");
assert(enqueueEntity?.summary === "Enqueue (name-only)", `Name-only enrich works (got "${enqueueEntity?.summary}")`);

// Re-analyze to reset
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);

// Now enrich with start_line (precise match)
const schedulerFresh = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const enqueueLine = schedulerFresh.entities.find((e: any) => e.detail.name === "enqueue")?.anchor.start_line;
const enrichPrecise = JSON.stringify([
  { name: "enqueue", start_line: enqueueLine, summary: "Enqueue (precise)", description: "Precise match." },
]);
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${enrichPrecise}'`);
const afterPrecise = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const enqueuePrecise = afterPrecise.entities.find((e: any) => e.detail.name === "enqueue");
assert(enqueuePrecise?.summary === "Enqueue (precise)", `start_line enrich works (got "${enqueuePrecise?.summary}")`);

// Non-matching start_line should NOT enrich
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);
const enrichWrongLine = JSON.stringify([
  { name: "enqueue", start_line: 999, summary: "Wrong line", description: "Should not match." },
]);
run(`npx tsx enrich.ts ${FIXTURE_DIR} src/scheduler.ts '${enrichWrongLine}'`);
const afterWrong = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const enqueueWrong = afterWrong.entities.find((e: any) => e.detail.name === "enqueue");
assert(enqueueWrong?.summary !== "Wrong line", `Wrong start_line does not match (got "${enqueueWrong?.summary}")`);

// === Test 12: Auto-enrich integration (analyze → auto-enrich → harness) ===
console.log("\nTest 12: Auto-enrich pipeline integration");

// Re-analyze to get skeleton data
run(`npx tsx analyze.ts ${FIXTURE_DIR}`);

// Verify entities are unenriched (placeholder summaries)
const preEnrich = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const preEntity = preEnrich.entities.find((e: any) => e.detail.name === "Scheduler");
assert(
  preEntity?.summary === "class: Scheduler",
  `Pre-enrich summary is placeholder (got "${preEntity?.summary}")`
);

// Run auto-enrich
const autoEnrichOut = run(`npx tsx auto-enrich.ts ${FIXTURE_DIR}`);
assert(autoEnrichOut.includes("entities enriched"), "Auto-enrich completes successfully");

// Verify enrichment happened
const postEnrich = JSON.parse(fs.readFileSync(schedulerJsonPath, "utf-8"));
const postEntity = postEnrich.entities.find((e: any) => e.detail.name === "Scheduler");
assert(
  postEntity?.summary !== "class: Scheduler",
  `Auto-enrich updated summary (got "${postEntity?.summary}")`
);
assert(
  postEntity?.detail?.description && !postEntity.detail.description.startsWith('class "Scheduler" spanning'),
  `Auto-enrich updated description`
);

// Harness should still pass
const harnessAfterAutoEnrich = run(`npx tsx harness.ts ${FIXTURE_DIR}`);
assert(harnessAfterAutoEnrich.includes("✓"), "Harness passes after auto-enrich");

// Auto-enrich is idempotent: running again should not change enriched entities
const preIdempotent = fs.readFileSync(schedulerJsonPath, "utf-8");
run(`npx tsx auto-enrich.ts ${FIXTURE_DIR}`);
const postIdempotent = fs.readFileSync(schedulerJsonPath, "utf-8");
assert(preIdempotent === postIdempotent, "Auto-enrich is idempotent (no changes on re-run)");

// === Summary ===
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
