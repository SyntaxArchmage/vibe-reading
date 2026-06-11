# Vibe Reading — Handoff Document

Session: 2026-06-08 → 2026-06-11
Machines: 10.0.16.52 (original) → current machine (codes1gn)

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Foundation | ✓ Complete | Extension skeleton, schema, sidebar, harness, /learn skill |
| Phase 1: Concept Push | ✓ Complete | AST extraction + agent enrichment + polished Card UI |
| Testing | ✓ Complete | 42 automated assertions, 3-language fixture + enrich test |
| Self-analysis | ✓ Complete | /learn ran on vibe-reading itself — 21 files, 76 entities |
| Phase 2: Macro Flow | Not started | Call chain visualization |
| Phase 3: Evolve Map | Not started | Git history timeline |
| Phase 4: Vibe Jump | Not started | Semantic navigation |

## Architecture: /learn Pipeline

The `/learn` skill is agent-driven with 2 phases:

1. **AST extraction** (CLI, automated):
   ```
   npx tsx analyze.ts <project>  →  .vibe-reading/files/*.json (skeleton)
   ```

2. **Concept enrichment** (agent, LLM-driven):
   ```
   Agent reads code → generates summaries/descriptions → calls:
   npx tsx enrich.ts <project> <file> '<enrichments-json>'
   ```

3. **Verification**:
   ```
   npx tsx harness.ts <project>  →  must report 100%
   ```

Key insight: The agent IS the LLM. No external API calls. The agent reads source code and generates concept explanations, then calls `enrich.ts` to persist them.

## What Was Built

### Phase 0: Foundation
- VS Code extension (TypeScript + React webview)
- DataEntity JSON schema with LoC anchor
- CLI analyzer (`cli/analyze.ts`) with per-file JSON output
- Harness tool (`cli/harness.ts`) for 100% coverage verification
- `/learn` Cursor skill definition
- Sidebar with 4 tabs (Concept/Flow/History/Jump)
- File-switch listener for auto-updating sidebar

### Phase 1: Concept Push
- Tree-sitter AST extraction via web-tree-sitter (WASM)
- Supports TypeScript, TSX, JavaScript, Python
- `enrich.ts` CLI for agent to write enriched data
- Polished Card component: kind badges, monospace names, line ranges,
  expand chevron, structured detail with chips
- File header showing filename + entity count
- Pill-style tab bar, rich empty states

### Testing
- Automated test suite (`test/test.ts`) — 42 assertions
- 3-language fixture project (scheduler.ts, engine.py, utils.js)
- Tests: output structure, entity accuracy, schema, manifest, harness, enrich

### Self-Analysis
- Ran `/learn` on vibe-reading itself: 21 files, 76 entities, 100% coverage
- Preview available at `http://localhost:3460`

## Key Decisions

See `prd/decisions.md` for full decision log (12 decisions).

## How to Run

```bash
# Clone
git clone git@github.com:SyntaxArchmage/vibe-reading.git

# Install deps
cd vibe-reading/extension && npm install
cd ../extension/webview && npm install
cd ../../cli && npm install

# Run /learn on any project (manual steps)
cd cli && npx tsx analyze.ts /path/to/project    # AST extraction
# Then: agent reads code and calls enrich.ts per file
cd cli && npx tsx harness.ts /path/to/project    # verify 100%

# Run tests
cd cli && npm test

# Preview UI
cd extension && npm run preview -- /path/to/project
# Open http://localhost:3457

# Build extension
cd extension && npm run compile && npm run build:webview
```

## What To Do Next

### Phase 2: Macro Flow
- Implement flow extractor using LSP call hierarchy
- Decision needed: use VS Code built-in LSP or standalone server
- FlowTab visualization: vertical call chain diagram
