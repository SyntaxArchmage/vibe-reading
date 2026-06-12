---
name: learn-code
description: Analyze a codebase and generate Vibe Reading concept cards. Two-phase pipeline — AST extraction (CLI) then concept enrichment (you, the agent, reading code and generating explanations).
---

# /learn-code — Generate Vibe Reading Data

## What This Does

Generates concept cards for every source file in a project. Each card explains what a function, class, or interface does — purpose, patterns, architecture role. The data powers the Vibe Reading VS Code sidebar.

## Prerequisites

```bash
cd <vibe-reading-repo>/cli && npm install  # first time only
```

## Pipeline (Execute These Steps In Order)

### Step 1: Run AST Extraction

```bash
cd <vibe-reading-repo>/cli && npx tsx analyze.ts <target-project-root>
```

This creates `<target-project-root>/.vibe-reading/files/*.json` with skeleton entities — entity names, line numbers, AST types. Summaries are placeholders like `"function: foo"`. These need enrichment.

### Step 2: Enrich Each File (This Is Your Main Job)

For each JSON file in `<target-project-root>/.vibe-reading/files/`:

1. **Read the JSON** to get the entity list (names, line ranges)
2. **Read the corresponding source file** to understand the actual code
3. **For each entity**, generate:
   - `summary`: One sentence (max 80 chars) — what this does, written for a developer reading the code for the first time
   - `description`: 2-4 sentences — purpose, patterns used, architecture role, non-obvious behavior
4. **Write enrichment** using the enrich CLI:

```bash
cd <vibe-reading-repo>/cli && npx tsx enrich.ts <target-project-root> <relative-file-path> '<enrichments-json>'
```

The enrichments JSON format:
```json
[
  {
    "name": "Scheduler",
    "start_line": 7,
    "summary": "Priority task scheduler with sequential execution",
    "description": "A simple priority-based task scheduler. Maintains an internally sorted queue where higher-priority tasks run first. Uses Priority Queue + sequential consumer pattern."
  },
  {
    "name": "enqueue",
    "start_line": 10,
    "summary": "Insert task and re-sort by priority (descending)",
    "description": "Adds a task to the queue and immediately re-sorts. Note: sorting after every insert is O(n log n) — for high-throughput, a heap would be better."
  }
]
```

**Important**: Include `start_line` to disambiguate when a file has multiple entities with the same name (e.g., multiple `forward` methods or `__init__` in different classes). The `start_line` comes from the entity's `anchor.start_line` in the JSON file. Without `start_line`, all entities sharing a name get the same enrichment.

#### Writing Good Concept Cards

- **Summary**: Action-oriented, starts with verb or noun. "Parse config and validate fields", not "This function parses config".
- **Description**: Write for someone reading this code for the first time. Mention design patterns by name. Note performance characteristics. Flag non-obvious behavior.
- **Don't repeat the name**: If the function is called `parseConfig`, don't start with "Parses the configuration". Say what it actually does: "Deserialize YAML config, validate required fields, merge with defaults".
- **Mention architecture role**: "Entry point for the HTTP handler chain", "Called by the scheduler on tick", "Factory for database connections".

### Step 3: Verify Coverage

```bash
cd <vibe-reading-repo>/cli && npx tsx harness.ts <target-project-root>
```

Must report 100% coverage.

### Step 4: Report to User

Tell the user:
- Number of files analyzed and entities enriched
- Coverage percentage
- How to view: run `/teach-me` or `cd <vibe-reading-repo>/viewer && npm run dev -- <target-project-root>`

## Batch Processing

For large projects, process files in batches of 3-5 to avoid context overflow. Read source files, generate enrichments, write them, then move to the next batch.

## Example: Full Run on a Small Project

```bash
# Step 1: AST extraction
cd ~/workspace/vibe-reading/cli && npx tsx analyze.ts ~/workspace/my-project

# Step 2: Enrich file-by-file
# Read .vibe-reading/files/src__scheduler.ts.json → see entities Task, Scheduler, enqueue, run, pending, createTask
# Read src/scheduler.ts → understand the code
# Generate enrichments and write:
cd ~/workspace/vibe-reading/cli && npx tsx enrich.ts ~/workspace/my-project src/scheduler.ts '[
  {"name": "Task", "summary": "Task contract — id, priority, and async executor", "description": "Defines the unit of work. Each task has a string id, numeric priority, and async execute(). Classic Command pattern."},
  {"name": "Scheduler", "summary": "Priority task scheduler with sequential execution", "description": "Priority-based scheduler. Sorted queue, higher priority first. Sequential execution — each task awaits before next starts."}
]'

# Repeat for each file...

# Step 3: Verify
cd ~/workspace/vibe-reading/cli && npx tsx harness.ts ~/workspace/my-project
```
