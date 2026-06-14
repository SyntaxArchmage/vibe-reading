# Vibe Reading — Handoff Document

Session: 2026-06-08 → 2026-06-15
Machines: 10.0.16.52 (original) → current machine (codes1gn)

## Quick Start (New Machine)

```bash
git clone git@github.com:SyntaxArchmage/vibe-reading.git
cd vibe-reading

# 1. Install CLI dependencies
cd cli && npm install && cd ..

# 2. Install viewer dependencies
cd viewer && npm install && cd ..

# 3. Run CLI tests (130 assertions)
npx tsx test/test.ts

# 4. Build viewer
cd viewer && node build.mjs && cd ..

# 5. Analyze test fixture
npx tsx cli/analyze.ts test/fixture

# 6. Start viewer
PORT=3460 npx tsx viewer/server.ts test/fixture
# Open http://localhost:3460

# 7. (Optional) Run E2E tests
playwright install chromium
PORT=3461 npx tsx viewer/server.ts test/fixture &
python3 test/e2e/test_viewer.py
```

## What Was Built

### Phase 0: Foundation ✅
- DataEntity JSON schema with LoC anchors
- `.vibe-reading/` directory convention (files/, global/, manifest.json)
- `cli/analyze.ts` — AST extraction orchestrator (Tree-sitter WASM)
- `cli/enrich.ts` — agent writes enriched concept data
- `cli/harness.ts` — coverage verification + schema validation
- `cli/stats.ts` — project stats (avg entities/file, extension breakdown)
- `cli/export-md.ts` — export analysis as Markdown summary
- `skills/learn-code/SKILL.md` — agent skill for data generation
- 187 automated tests in `test/test.ts`

### Phase 1: Concept Push ✅
- Tree-sitter extraction: TypeScript, TSX, JavaScript, Python
- Agent enrichment pipeline (agent IS the LLM)
- `cli/auto-enrich.ts` — batch enrichment from JSDoc (genericized)
- Polished Card component with kind badges, expand/collapse
- Demo: Pi agent project (663 files, 1465 entities enriched)

### Phase 1.5: Viewer Foundation ✅ (mostly)
- [x] `viewer/` extracted as standalone React app
- [x] `skills/learn-code/` and `skills/teach-me/` skills
- [x] Monaco Editor integrated (CDN-loaded, syntax highlighting)
- [x] Activity bar, file tree, multi-tab bar, command palette (Ctrl+P)
- [x] Card click → Monaco decoration highlighting
- [x] Schema validation in harness (rejects malformed JSON)
- [x] Navigation history with back/forward (Alt+←/→)
- [x] Status bar with keyboard shortcut hints
- [ ] Playwright E2E tests (written, blocked by system lib)
- [ ] Visual regression baseline screenshots

### Phase 2: Macro Flow ✅
- Flow extractor: imports, function calls, exports (Tree-sitter)
- Global call-graph.json for cross-file relationships
- FlowTab with categorized cards (imports/calls/exports)
- Visual flow diagram in FlowTab header (imports → file → exports)

### Phase 3: Evolve Map ✅
- History extractor: git log, change frequency, hot spots
- HistoryTab with commit timeline and hot spot indicators
- On-demand git blame via /api/blame endpoint
- Blame view with per-line author/date/sha annotations

### Phase 4: Vibe Jump ✅
- Jump extractor: local import resolution to target files
- JumpTab with one-click navigation to target files
- Jump card click navigates to target file in Monaco

### Code Quality
- Shared Tree-sitter parser module (eliminated ~200 lines of duplication)
- Server hardened: malformed JSON handling, path traversal protection
- Server auto-reloads analysis data when files change
- Genericized auto-enrich (removed project-specific hardcoding)
- Global entity search panel (Ctrl+Shift+F) across all files
- Entity search keyboard navigation (arrows + enter)
- Entity search: `t:` type filter, `f:` file filter, path search
- Card enrichment indicator (shows "enriched" chip)
- Card filter and sort controls in sidebar
- Monaco gutter entity markers (colored by type)
- Python docstring support in auto-enrich
- Rust `///`, Go `//`, Ruby `#` doc comment support in auto-enrich
- Debounced server file watcher for hot-reload
- Memoized allEntities/allFiles for render performance
- `.cursor/rules/` for AI session consistency
- File tree heat dots (commit frequency color-coded indicators)
- File tree folder entity counts (propagated from children)
- Clickable "Imported by" and "Depends on" cross-file navigation
- Type filtering in entity search (`t:concept`, `t:flow`)
- Entity type distribution in empty state
- Top 5 most complex files in empty state sidebar
- React error boundary for crash resilience
- Python `__all__` export extraction
- Breadcrumb: status bar shows entity at cursor position
- Clickable breadcrumb navigates to concept tab
- Commit count badge in file header
- Keyboard shortcuts help overlay (? key)
- `/api/stats` endpoint for project-level statistics
- `export-md.ts` tool for Markdown summaries
- Analyze reports entity counts by file extension
- Blame view shows source code alongside annotations
- Fix: export extractor no longer over-collects internal identifiers
- Fix: entity search closes on selection, safe end_line fallback
- Fix: summaryIsPlaceholder regex covers all entity kinds
- Fix: removed broken tree-sitter-wasms language entries

## Architecture Decisions (2026-06-12)

Key decisions recorded in `prd/decisions.md`:

| # | Decision | Rationale |
|---|----------|-----------|
| 13 | Skills-first distribution | Agent-native, cross-IDE |
| 14 | Web Viewer, not IDE | Zero-install, shareable URLs |
| 15 | Harness as schema contract | Deterministic validation |
| 16 | Playwright E2E testing | Agent can autonomously test UI |
| 17 | Monaco + React Shell | 100% sidebar control, ~5MB deps |

Positioning: "UA is maps (bird's eye). We are GPS (turn-by-turn in code)."

See `prd/value-insight.md` for full competitive analysis.

## Repository Structure

```
vibe-reading/
├── cli/                        # Analysis pipeline
│   ├── analyze.ts              # AST extraction (Tree-sitter WASM)
│   ├── enrich.ts               # Agent enrichment tool
│   ├── auto-enrich.ts          # Batch enrichment from JSDoc
│   ├── harness.ts              # Coverage verification
│   ├── extractors/parser.ts    # Shared Tree-sitter init/parse
│   ├── extractors/concept.ts   # Tree-sitter concept extractor
│   ├── extractors/flow.ts      # Import/call/export flow extractor
│   ├── extractors/history.ts   # Git history extractor
│   ├── extractors/jump.ts      # Navigation jump extractor
│   ├── types.ts                # Shared TypeScript types
│   └── package.json            # Dependencies: web-tree-sitter, tsx
├── viewer/                     # Standalone web viewer
│   ├── src/
│   │   ├── App.tsx             # Full layout (sidebar + Monaco + picker)
│   │   ├── MonacoEditor.tsx    # Monaco wrapper with decorations
│   │   ├── index.tsx           # React entry point
│   │   ├── shared-types.ts     # DataEntity type definitions
│   │   ├── tabs/               # ConceptTab, FlowTab, HistoryTab, JumpTab
│   │   └── components/Card.tsx # Knowledge card component
│   ├── index.html              # Entry HTML (Monaco from CDN)
│   ├── server.ts               # Lightweight HTTP server (~80 lines)
│   ├── build.mjs               # esbuild bundler config
│   ├── package.json            # Dependencies: react, motion
│   └── tsconfig.json
├── skills/                     # Cursor skills
│   ├── learn-code/SKILL.md     # /learn-code — analyze codebase
│   └── teach-me/SKILL.md       # /teach-me — launch viewer
├── extension/                  # VS Code extension (legacy, optional)
│   ├── src/                    # Extension entry + sidebar provider
│   ├── webview/                # Original webview (now in viewer/)
│   └── package.json
├── test/
│   ├── test.ts                 # 187 CLI pipeline tests
│   ├── e2e/test_viewer.py      # 18 Playwright E2E tests
│   └── fixture/                # Test fixture (5 source files)
├── prd/
│   ├── prd.md                  # Product requirements
│   ├── devplan.md              # Development plan (6 phases)
│   ├── decisions.md            # 17 design decisions
│   └── value-insight.md        # Competitive analysis vs UA
├── HANDOFF.md                  # This file
└── .gitignore
```

## Dependencies

### CLI (`cli/package.json`)
- `web-tree-sitter` — WASM-based AST parsing
- `tsx` — TypeScript execution
- `esbuild` — bundler

### Viewer (`viewer/package.json`)
- `react`, `react-dom` — UI framework
- `motion` (Framer Motion) — animations
- `esbuild` — bundler (dev)
- `tsx` — TypeScript execution (dev)
- Monaco Editor loaded from CDN (not bundled)

### E2E Tests
- Python `playwright` — headless browser testing
- Chromium browser (install: `playwright install chromium`)

## Data Format

`.vibe-reading/` directory produced by `/learn-code`:

```
.vibe-reading/
├── manifest.json           # File list, coverage stats
├── files/                  # Per-file analysis JSONs
│   ├── src__scheduler_ts.json
│   ├── src__engine_py.json
│   └── ...
└── global/                 # Cross-file data
    └── call-graph.json     # Import/export/call relationships
```

Each file JSON:
```json
{
  "file": "src/scheduler.ts",
  "entities": [
    {
      "anchor": {
        "file": "src/scheduler.ts",
        "start_line": 7,
        "start_col": 0,
        "end_line": 25
      },
      "type": "concept",
      "summary": "Task scheduler with priority queue",
      "detail": {
        "description": "Manages async tasks...",
        "kind": "class",
        "name": "Scheduler"
      }
    }
  ]
}
```

## Known Issues

1. **Network**: This machine has persistent connectivity issues.
   External CDN downloads (npm, Playwright browsers) frequently fail
   with ECONNRESET. Git push to GitHub works but is slow (~10-45s).

2. **Playwright browser not installed**: E2E tests written but can't
   run. Need `playwright install chromium` on a machine with good
   network.

3. **Playwright system lib missing**: `libxkbcommon.so.0` cannot be
   installed via apt on this machine. E2E tests are written and ready
   to run when the dependency is resolved.

## What To Do Next

1. **Install Playwright Chromium** — run E2E tests, capture baseline
   screenshots, iterate on UI
2. **LSP integration** — go-to-definition targets for jump tab
3. **LLM enrichment** — semantic relationship inference for jumps
4. **PR description extraction** — GitHub API integration for history
