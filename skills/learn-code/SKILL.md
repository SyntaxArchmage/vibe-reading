---
name: learn-code
description: Analyze a codebase and generate Vibe Reading data — concept cards, call flow, git history, and navigation jumps. Three-step pipeline — AST extraction, automatic enrichment, then optional deep enrichment by the agent for important entities.
---

# /learn-code — Generate Vibe Reading Data

## What This Does

Generates knowledge data for every source file in a project:
- **Concept cards**: What each function, class, interface does
- **Flow cards**: Import dependencies, function call chains, exports
- **History cards**: Git commit history, change frequency, hot spots
- **Jump suggestions**: Navigation links to related files via imports

The data powers the Vibe Reading web viewer.

## Prerequisites

```bash
cd <vibe-reading-repo>/cli && npm install  # first time only
```

## Pipeline (Execute These Steps In Order)

### Step 1: AST Extraction

```bash
cd <vibe-reading-repo>/cli && npx tsx analyze.ts <target-project-root>
```

This creates `<target-project-root>/.vibe-reading/` with:
- `files/*.json` — per-file entities (concepts, flow, history, jumps)
- `global/call-graph.json` — cross-file call relationships
- `manifest.json` — coverage status

Concept summaries are placeholders like `"function: foo"` that need enrichment. Flow, history, and jump entities are auto-generated.

### Step 2: Auto-Enrich (Tier 1 — Instant)

```bash
cd <vibe-reading-repo>/cli && npx tsx auto-enrich.ts <target-project-root>
```

Generates heuristic descriptions from source structure: function signatures, parameters, return types, docstrings, file context. No LLM needed — runs in seconds on any project size. Produces usable descriptions for all entities immediately.

After this step, every entity has a meaningful summary and description. For many projects, this is sufficient.

### Step 3: Deep Enrich (Tier 2 — Agent-Powered, Optional)

For important or complex entities, you can add richer descriptions by reading the actual source code. Focus on:
- Core architecture classes (entry points, engines, schedulers)
- Complex algorithms (non-obvious logic, performance-sensitive code)
- Public API surfaces (what users call directly)

Skip trivial entities (getters, constructors, simple wrappers) — auto-enrich already covers them.

For each file you want to deep-enrich:

1. **Read the JSON** to see which entities exist and their current descriptions
2. **Read the source file** to understand the code
3. **Generate better enrichments** for the entities that deserve it
4. **Write enrichment** using the enrich CLI:

```bash
cd <vibe-reading-repo>/cli && npx tsx enrich.ts <target-project-root> <relative-file-path> '<enrichments-json>'
# Or use --from-file for large enrichments (avoids shell escaping issues):
cd <vibe-reading-repo>/cli && npx tsx enrich.ts <target-project-root> <relative-file-path> --from-file /tmp/enrichments.json
```

Enrichments JSON format:
```json
[
  {
    "name": "Scheduler",
    "start_line": 7,
    "summary": "Priority task scheduler with sequential execution",
    "description": "A simple priority-based task scheduler. Maintains an internally sorted queue where higher-priority tasks run first. Uses Priority Queue + sequential consumer pattern."
  }
]
```

**Include `start_line`** to disambiguate entities with the same name (e.g., multiple `forward` methods or `__init__` in different classes). The value comes from `anchor.start_line` in the JSON file.

#### Writing Good Concept Cards

- **Summary**: Action-oriented, max 80 chars. "Parse config and validate fields", not "This function parses config".
- **Description**: 2-4 sentences for someone reading code for the first time. Mention design patterns, performance characteristics, non-obvious behavior.
- **Don't repeat the name**: If the function is `parseConfig`, don't say "Parses the configuration". Say what it actually does.
- **Mention architecture role**: "Entry point for the HTTP handler chain", "Called by the scheduler on tick".

### Step 4: Verify Coverage

```bash
cd <vibe-reading-repo>/cli && npx tsx harness.ts <target-project-root>
```

Must report 100% coverage and valid schema.

### Step 5: Report to User

Tell the user:
- Number of files analyzed and entities enriched
- Coverage percentage
- How to view: run `/teach-me` or `PORT=3460 npx tsx viewer/server.ts <target-project-root>`

### Step 2.5 (Optional): Auto-Enrich from JSDoc/Docstrings

Before manual enrichment, run auto-enrich to handle entities that already
have good documentation:

```bash
cd <vibe-reading-repo>/cli && npx tsx auto-enrich.ts <target-project-root>
```

This extracts JSDoc comments (JS/TS) and Python docstrings to generate
summaries and descriptions automatically. Only unenriched entities are
updated.

### Quick Stats

Check analysis metrics without opening the viewer:

```bash
cd <vibe-reading-repo>/cli && npx tsx stats.ts <target-project-root>
```

Shows entity counts, enrichment percentage, and largest file.

## Batch Processing

For deep enrichment of large projects, process files in batches of 3-5. Focus on the most architecturally important files first — entry points, core engines, public APIs. Less critical files already have auto-enrich descriptions.

## Example: Full Run

```bash
# Step 1: AST extraction
cd ~/workspace/vibe-reading/cli && npx tsx analyze.ts ~/workspace/my-project

# Step 2: Auto-enrich (instant Tier 1 descriptions)
cd ~/workspace/vibe-reading/cli && npx tsx auto-enrich.ts ~/workspace/my-project

# Step 3 (optional): Deep-enrich important files
# Read .vibe-reading/files/src__scheduler.ts.json → see entities
# Read src/scheduler.ts → understand the code
# Write richer descriptions for key entities:
cd ~/workspace/vibe-reading/cli && npx tsx enrich.ts ~/workspace/my-project src/scheduler.ts '[
  {"name": "Scheduler", "start_line": 7, "summary": "Priority task scheduler with sequential execution", "description": "Priority-based scheduler. Sorted queue, higher priority first. Sequential execution — each task awaits before next starts."}
]'

# Step 4: Verify
cd ~/workspace/vibe-reading/cli && npx tsx harness.ts ~/workspace/my-project
```
