---
name: learn
description: Analyze a codebase and generate Vibe Reading knowledge data. Run this skill to populate .vibe-reading/ with per-file analysis data for the sidebar.
---

# /learn — Analyze Codebase for Vibe Reading

## What This Skill Does

Runs the Vibe Reading analysis pipeline on the current project:

1. Scans all source files (respects .gitignore)
2. Extracts knowledge entities per file (concepts, flow, history, jump)
3. Writes per-file JSON to `.vibe-reading/files/`
4. Generates `manifest.json` with coverage status
5. Runs harness to verify 100% coverage

## Usage

```
/learn
```

Or with a specific directory:

```
/learn src/
```

## Steps

### Step 1: Install dependencies (first run only)

```bash
cd <vibe-reading-repo>/cli && npm install
```

### Step 2: Run analysis

```bash
cd <vibe-reading-repo>/cli && npx tsx analyze.ts <target-project-root>
```

### Step 3: Verify coverage

```bash
cd <vibe-reading-repo>/cli && npx tsx harness.ts <target-project-root>
```

### Step 4: Report

Tell the user:
- How many files were analyzed
- Coverage percentage
- Any failed files

## Output Structure

```
<target-project>/.vibe-reading/
├── manifest.json
├── files/
│   ├── src__main.ts.json
│   ├── src__utils__helper.ts.json
│   └── ...
└── global/
    └── project-overview.json
```

## Notes

- Phase 0 uses a stub extractor (regex-based function/class detection)
- Phase 1 will replace this with Tree-sitter AST + LLM analysis
- The extension reads from `.vibe-reading/files/` — no further steps needed
  after analysis completes
