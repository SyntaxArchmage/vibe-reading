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

// === Summary ===
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
