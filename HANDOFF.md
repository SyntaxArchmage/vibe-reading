# Vibe Reading — Handoff Document

Session: 2026-06-08 → 2026-06-11
Machines: 10.0.16.52 (original) → current machine (codes1gn)

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Foundation | Done | Extension skeleton, schema, sidebar, harness, /learn skill |
| Phase 1: Concept Push | Done | AST extraction + agent enrichment + polished Card UI + source viewer |
| Testing | Done | 42 automated assertions + enrich test |
| Self-analysis | Done | /learn ran on vibe-reading itself — 21 files, 76 entities, 100% |
| Pi demo | Done | earendil-works/pi — 663 files, 1465 entities enriched (agent+ai) |
| Phase 2: Macro Flow | Not started | Call chain visualization |

## Architecture: /learn Pipeline

Two-phase, agent-driven:

```
Step 1:  npx tsx analyze.ts <project>    → .vibe-reading/files/*.json (AST skeleton)
Step 2:  Agent reads code, generates explanations, calls:
         npx tsx enrich.ts <project> <file> '<enrichments-json>'
Step 3:  npx tsx harness.ts <project>    → must report 100%
```

Key insight: The agent IS the LLM. No external API calls needed.

### CLI tools
| Tool | Purpose |
|------|---------|
| `cli/analyze.ts` | Tree-sitter AST extraction, writes per-file JSON |
| `cli/enrich.ts` | Agent writes enriched summary/description per entity |
| `cli/harness.ts` | Verifies 100% coverage |
| `cli/extractors/concept.ts` | web-tree-sitter WASM-based AST parser (TS/JS/Py) |

## What Was Built

### Phase 0: Foundation
- VS Code extension (TypeScript + React webview)
- DataEntity JSON schema with LoC anchor
- CLI analyzer with per-file JSON output
- Harness for 100% coverage verification
- `/learn` Cursor skill definition
- Sidebar with 4 tabs (Concept/Flow/History/Jump)
- File-switch listener for auto-updating sidebar

### Phase 1: Concept Push
- Tree-sitter AST extraction via web-tree-sitter (WASM)
- Languages: TypeScript, TSX, JavaScript, Python
- `enrich.ts` CLI for agent to persist enriched data
- Fixed Python duplicate entities (@dataclass/@property decorators)
- Polished Card UI:
  - Kind badges (Function/Class/Interface) with VS Code-themed colors
  - Monospace entity name, line range display
  - Expand chevron with rotation animation
  - Structured detail: description paragraph + metadata chips
- File header showing filename + entity count
- Pill-style tab bar
- Rich empty states with icons
- **Source code viewer in preview**: right panel shows source with line
  numbers, clicking a card highlights the corresponding line range

### Testing
- 42 automated assertions in `test/test.ts`
- 3-language fixture (scheduler.ts, engine.py, utils.js)
- Tests: output structure, entity accuracy, schema, manifest, harness, enrich tool

### Self-Analysis
- Ran `/learn` on vibe-reading itself: 21 files, 76 entities, 100% coverage
- All entities have real concept explanations (not placeholders)

## Preview

```bash
# Preview the self-analysis (vibe-reading analyzing itself)
cd extension && node esbuild.webview.mjs && PORT=3460 npx tsx preview-server.ts /home/albert/workspace/vibe-reading

# Preview the test fixture
cd extension && npm run preview -- /path/to/project
```

Features:
- Left panel: sidebar webview with concept cards
- Right panel: source code with line numbers
- Click card → highlights corresponding code lines
- File selector (bottom-right) switches between files
- Expand card → description + metadata chips

## Key Decisions

See `prd/decisions.md` for full log (12 decisions).

## Pi Demo

Downloaded `earendil-works/pi` (61K stars TypeScript agent toolkit) via
tarball. Ran full pipeline:
- AST extraction: 663 files, 5511 entities, 100% coverage
- Enrichment: 1465 entities across agent + ai packages (156 files)
- Preview: `http://localhost:3460` with 663 files loaded

Remaining unenriched: coding-agent (404 files) and tui (59 files) packages
still have placeholder summaries. Can be enriched on demand.

## How to Run

```bash
# Install deps
cd vibe-reading/extension && npm install
cd ../extension/webview && npm install
cd ../../cli && npm install

# Full /learn pipeline
cd cli && npx tsx analyze.ts /path/to/project
# Agent enriches each file via: npx tsx enrich.ts <project> <file> '<json>'
cd cli && npx tsx harness.ts /path/to/project

# Tests
cd cli && npm test  # 42 assertions

# Preview
cd extension && npm run preview -- /path/to/project
```

## What To Do Next

1. **Enrich remaining Pi packages** — coding-agent (404 files) and tui (59 files)
2. **Phase 2: Macro Flow** — LSP call hierarchy → Flow tab
3. **Consider**: syntax highlighting in preview source panel (Shiki or highlight.js)
