---
name: learn-code
description: Analyze a codebase and generate Vibe Reading concept cards. Three-step pipeline — AST extraction, automatic enrichment, then optional deep enrichment by the agent for important entities.
---

# /learn-code — Generate Vibe Reading Data

## What This Does

Generates concept cards for every source file in a project. Each card explains what a function, class, or interface does — purpose, patterns, architecture role. The data powers the Vibe Reading web viewer.

## Prerequisites

```bash
cd <vibe-reading-repo>/cli && npm install  # first time only
```

## Pipeline (Execute These Steps In Order)

### Step 1: AST Extraction

```bash
cd <vibe-reading-repo>/cli && npx tsx analyze.ts <target-project-root>
```

Creates `<target-project-root>/.vibe-reading/files/*.json` with skeleton entities — names, line numbers, AST types. Summaries are placeholders like `"function: foo"`.

### Step 2: Auto-Enrich (Tier 1 — Instant)

```bash
cd <vibe-reading-repo>/cli && npx tsx auto-enrich.ts <target-project-root>
```

Generates heuristic descriptions from source structure: function signatures, parameters, return types, docstrings, file context. No LLM needed — runs in seconds on any project size. Produces usable descriptions for all entities immediately.

After this step, every entity has a meaningful summary and description. For many projects, this is sufficient.

### Step 3: Deep Enrich (Tier 2 — Agent-Powered, MANDATORY)

**This step is NOT optional.** The harness enforces a 90% deep-enrichment threshold. Every entity must have a meaningful summary and description that teaches the reader something they cannot infer from the function name alone.

Process **ALL** shallow entities (those flagged by `harness.ts`):
- Core architecture classes (entry points, engines, schedulers)
- Complex algorithms (non-obvious logic, performance-sensitive code)
- Public API surfaces (what users call directly)
- Even "simple" functions — explain their role in the system, not just what they do

**What "deeply enriched" means:**
- Summary ≥ 8 characters, NOT just the entity name or kind
- Description ≥ 30 characters, NOT a template like "Defined in X. Class spanning N lines."
- Describes PURPOSE (why it exists), ROLE (where it fits), and BEHAVIOR (what it does that isn't obvious)

For each file you want to deep-enrich:

1. **Run the harness** to see which entities are shallow: `npx tsx harness.ts <target>`
2. **Read the JSON** to see which entities exist and their current descriptions
3. **Read the source file** to understand the code
4. **Generate better enrichments** for ALL shallow entities
5. **Write enrichment** using the enrich CLI:

```bash
cd <vibe-reading-repo>/cli && npx tsx enrich.ts <target-project-root> <relative-file-path> '<enrichments-json>'
```

Enrichments JSON format:
```json
[
  {
    "name": "Scheduler",
    "start_line": 7,
    "summary": "Priority task scheduler with sequential execution",
    "description": "Priority-based scheduler. Sorted queue, higher priority first. Sequential execution — each task awaits before next starts.",
    "why": "Multiple tasks compete for single execution thread — need ordering policy",
    "pattern": "Priority Queue + sequential consumer",
    "teaches": [
      {"tag": "Object Pool", "explain": "Pre-allocate N objects at startup, hand them out on request, reclaim when done. Avoids allocation overhead in hot paths."},
      {"tag": "FCFS Scheduling", "explain": "First-Come-First-Served: process in arrival order. Fair but can cause head-of-line blocking."}
    ],
    "level": "advanced",
    "design": "Priority queue rather than FIFO — allows urgent tasks to bypass waiting",
    "convention": "All state mutation inside step() — external code only enqueues"
  }
]
```

**Include `start_line`** to disambiguate entities with the same name (e.g., multiple `forward` methods or `__init__` in different classes). The value comes from `anchor.start_line` in the JSON file.

#### Knowledge Fields (MANDATORY)

Every entity MUST include these fields alongside summary/description:

| Field | Required | Description |
|-------|----------|-------------|
| `why` | YES | Why this entity exists — the problem it solves. 1-2 sentences. |
| `teaches` | YES | Array of `{tag, explain}` objects — real programming concepts the reader can learn here. |
| `level` | YES | `"basic"` (entry-level/data/helpers) or `"advanced"` (architecture/optimization/internals). |
| `pattern` | No | Design pattern or architectural approach used. |
| `analogy` | No | Real-world analogy for complex concepts. |
| `design` | No | Why this specific design was chosen over alternatives. |
| `convention` | No | Project-specific coding conventions demonstrated here. |
| `smell` | No | Known tradeoffs, tech debt, or scalability limits. |
| `perf` | No | Performance characteristics (complexity, hot path, memory). |

#### Teaches Rules (CRITICAL)

`teaches` entries MUST be **real programming knowledge concepts**, NOT code identifiers:

✅ Good teaches (with all optional context fields):
- `{"tag": "Object Pool", "explain": "Pre-allocate N objects, hand out on demand. Avoids allocation overhead.", "rationale": "GPU memory allocation is extremely slow. Pool amortizes this cost.", "cross_lang": "Go sync.Pool, Java ThreadPoolExecutor, Rust arena allocator", "gotcha": "Pool exhaustion under load — must handle 'no available objects' gracefully"}`
- `{"tag": "__slots__", "explain": "Python: replaces __dict__ with fixed tuple. Saves ~100 bytes per instance.", "rationale": "Thousands of Block instances created — memory savings compound.", "cross_lang": "C struct (fixed fields by default), Java record, Rust (default behavior)"}`
- `{"tag": "CUDA Graph", "explain": "Record GPU ops, replay without CPU. Eliminates kernel launch overhead.", "rationale": "Decode path has fixed tensor shapes, making it graphable. ~50% latency reduction.", "gotcha": "Only works with fixed shapes — dynamic prefill cannot use graphs"}`

Teaches entry fields:
- `tag` (required): Name of the concept being taught
- `explain` (required): 1-3 sentences explaining the concept independently
- `rationale` (encouraged): Why THIS code uses this concept. What would happen without it.
- `cross_lang` (encouraged): Equivalent in other languages (Java, Rust, Go, TS, C++)
- `gotcha` (optional): Common pitfall or trap related to this concept in this context

❌ Bad teaches (BANNED):
- `"ColumnParallelLinear"` — this is a code class name, not a concept
- `"nn.Module forward contract"` — too vague, doesn't teach anything
- `"constructor pattern"` — meaningless without explanation
- Any string without `explain` — BANNED for core concepts

Categories of valid teaches:
1. **Language features**: `__slots__`, `@property`, `dataclass`, `generator`, `contextmanager`
2. **Design patterns**: Object Pool, Facade, Actor, Observer, Strategy
3. **CS fundamentals**: Reference Counting, Content-Addressable Storage, Paged Memory
4. **Domain concepts**: Flash Attention, Tensor Parallelism, CUDA Graph, KV Cache
5. **Algorithms**: FCFS Scheduling, Preemption, Ring All-Reduce

Each `explain` should be 1-3 sentences that teach the concept **independently of the code**. A reader should understand the concept even without seeing the source.

#### Knowledge Exploration Dimensions (MANDATORY)

When enriching entities, the agent MUST explore ALL applicable dimensions from the knowledge taxonomy. See `docs/brainstorm-knowledge-dimensions.md` for the full reference. Key dimensions to check for EVERY entity:

1. **Language features**: Does this code demonstrate a language-specific feature (dunder methods, decorators, type hints, context managers, slots, enums)? If yes → teaches it with cross-language equivalents.
2. **Design patterns**: Is there a recognizable pattern (Facade, Object Pool, Actor, Strategy, Factory, State Machine, Composition)? If yes → explain the pattern with name origin, when to use, and anti-patterns.
3. **Data structures**: Does it use a specific data structure choice (deque, dict, set, priority queue)? If yes → explain what it is + complexity.
4. **Engineering practices**: Is there a notable practice (graceful shutdown, idempotency, warmup, benchmarking, config-driven)? If yes → explain why.
5. **Domain concepts**: Are there domain-specific concepts (KV Cache, Flash Attention, Tensor Parallelism)? If yes → explain for newcomers.
6. **Gotchas/Pitfalls**: Is there a non-obvious bug trap in this code (mutability + caching, thread safety, stale state)? If yes → embed as ⚠️ warning.
7. **Cross-language**: ALWAYS mention equivalent concepts in other mainstream languages (Java, Rust, Go, TypeScript, C++) to help polyglot users connect.

**Teaches must include RATIONALE**: Not just "what is X" but "why X is used HERE, what happens if NOT used, when NOT to use it."

#### Writing Good Concept Cards

- **Summary**: Action-oriented, max 80 chars. "Parse config and validate fields", not "This function parses config".
- **Description**: 2-4 sentences for someone reading code for the first time. Mention design patterns, performance characteristics, non-obvious behavior.
- **Don't repeat the name**: If the function is `parseConfig`, don't say "Parses the configuration". Say what it actually does.
- **Mention architecture role**: "Entry point for the HTTP handler chain", "Called by the scheduler on tick".

### Step 3.5: Illustration Generation (Optional but Encouraged)

For concepts that are significantly clearer with a diagram, generate illustrations:

**When to generate**: Matrix operations, memory layouts, communication topologies, state transitions, architecture diagrams, algorithm visualizations.

**When NOT to generate**: Simple one-liner concepts, pure text patterns, trivial data structures.

**Tool selection** (agent decides based on complexity):
- **Simple** (boxes + arrows, state machines): Node.js SVG script → `.svg`
- **Complex** (matrix ops, data flow, tiling): Manim Python scene → `.png`/`.svg`

**Output location**: `<target-project-root>/.vibe-reading/illustrations/<file-path>__<entity-name>.svg`

The viewer will automatically display illustrations in concept cards when the file exists.

See `docs/brainstorm-knowledge-dimensions.md` "Concept Illustrations" section for full guidance.

### Step 4: Verify Coverage, Quality, AND Knowledge

```bash
cd <vibe-reading-repo>/cli && ENRICH_THRESHOLD=0.9 KNOWLEDGE_THRESHOLD=0.9 npx tsx harness.ts <target-project-root>
```

Must report:
- 100% coverage (all files analyzed)
- Valid schema (no structural errors)
- **≥90% enrichment quality** (deep-enriched entities vs shallow/template)
- **≥90% knowledge coverage** (entities with `level` + `why`/`teaches` fields)

If ANY gate fails, go back to Step 3 and fix the listed entities. Repeat until the harness passes ALL gates.

**Harness environment variables:**
- `ENRICH_THRESHOLD=0.9` — minimum ratio of deep-enriched descriptions
- `KNOWLEDGE_THRESHOLD=0.9` — minimum ratio of entities with knowledge fields (level + why/teaches)

For WIP/draft runs you can lower thresholds. Without these env vars, harness only checks structure.

### Step 5: Report to User

Tell the user:
- Number of files analyzed and entities enriched
- Coverage percentage
- How to view: run `/teach-me` or `PORT=3460 npx tsx viewer/server.ts <target-project-root>`

## Batch Processing

For deep enrichment of large projects, process files in batches of 3-5. Start with the entities flagged by the harness (highest priority). Continue until the quality gate passes (≥90%).

**Iteration loop:**
1. Run `harness.ts` → see shallow entities
2. Deep-enrich a batch of 3-5 files
3. Run `harness.ts` again → check progress
4. Repeat until ≥90%

## Example: Full Run

```bash
# Step 1: AST extraction
cd ~/workspace/vibe-reading/cli && npx tsx analyze.ts ~/workspace/my-project

# Step 2: Auto-enrich (instant Tier 1 descriptions)
cd ~/workspace/vibe-reading/cli && npx tsx auto-enrich.ts ~/workspace/my-project

# Step 3: Check what needs deep enrichment
ENRICH_THRESHOLD=0.9 npx tsx harness.ts ~/workspace/my-project
# → Shows shallow entities that need attention

# Step 4: Deep-enrich ALL shallow entities (iterate until harness passes)
# Read .vibe-reading/files/src__scheduler.ts.json → see entities
# Read src/scheduler.ts → understand the code
# Write richer descriptions:
cd ~/workspace/vibe-reading/cli && npx tsx enrich.ts ~/workspace/my-project src/scheduler.ts '[
  {"name": "Scheduler", "start_line": 7, "summary": "Priority task scheduler with sequential execution", "description": "Priority-based scheduler. Sorted queue, higher priority first. Sequential execution — each task awaits before next starts."}
]'

# Step 5: Verify (must pass quality gate)
ENRICH_THRESHOLD=0.9 npx tsx harness.ts ~/workspace/my-project
# → Must show ✓ with ≥90% deep enrichment
```
