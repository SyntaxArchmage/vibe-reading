# Vibe Reading — Handoff Document

Session: 2026-06-08 → 2026-06-12
Machines: 10.0.16.52 (original) → current machine (codes1gn)

## Quick Start (New Machine)

```bash
git clone git@github.com:SyntaxArchmage/vibe-reading.git
cd vibe-reading

# 1. Dev-install: links skills + installs deps
bash scripts/dev-install.sh

# 2. Run CLI tests (57 assertions)
npx tsx test/test.ts

# 3. Build viewer
cd viewer && node build.mjs && cd ..

# 4. Analyze test fixture
npx tsx cli/analyze.ts test/fixture

# 5. Start viewer
PORT=3460 npx tsx viewer/server.ts test/fixture
# Open http://localhost:3460

# 6. (Optional) Run E2E tests
playwright install chromium
PORT=3461 npx tsx viewer/server.ts test/fixture &
python3 test/e2e/test_viewer.py
```

### Dev Install

`scripts/dev-install.sh` symlinks skills to `~/.cursor/skills/`:
- `learn-code` → `~/.cursor/skills/learn-code`
- `teach-me` → `~/.cursor/skills/teach-me`

After dev-install, subagents see skill changes immediately (no reinstall).

### Test Data

- `test/fixture` — lightweight deterministic data (3 files, committed)
- `test/data/nano-vllm` — real-world Python project (21 files, 1450 lines, gitignored)

```bash
# Fetch test data (clones nano-vllm if missing)
bash scripts/setup-test-data.sh

# Full pipeline: analyze → auto-enrich → verify
npx tsx cli/analyze.ts test/data/nano-vllm
npx tsx cli/auto-enrich.ts test/data/nano-vllm
npx tsx cli/harness.ts test/data/nano-vllm
```

## What Was Built

### Phase 0: Foundation ✅
- DataEntity JSON schema with LoC anchors
- `.vibe-reading/` directory convention (files/, global/, manifest.json)
- `cli/analyze.ts` — AST extraction orchestrator (Tree-sitter WASM)
- `cli/enrich.ts` — agent writes enriched concept data
- `cli/harness.ts` — coverage verification tool
- `skills/learn-code/SKILL.md` — agent skill for data generation
- 57 automated tests in `test/test.ts`

### Phase 1: Concept Push ✅
- Tree-sitter extraction: TypeScript, TSX, JavaScript, Python
- Agent enrichment pipeline (agent IS the LLM)
- `cli/auto-enrich.ts` — Tier 1 auto-enrichment (heuristic, no LLM)
- Polished Card component with kind badges, expand/collapse
- Demo: Pi agent project (663 files, 1465 entities enriched)

### Phase 1.5: Viewer Foundation 🟡 (In Progress)
- [x] `viewer/` extracted as standalone React app
- [x] `skills/learn-code/` and `skills/teach-me/` skills
- [x] Monaco Editor integrated (CDN-loaded, syntax highlighting)
- [x] Full React layout: sidebar + Monaco + floating file picker
- [x] Card click → Monaco decoration highlighting
- [x] Playwright E2E test script (18 tests)
- [x] Playwright browser install + 19/19 E2E tests passing
- [x] Schema validation in harness
- [ ] Visual regression baseline screenshots

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
│   ├── extractors/concept.ts   # Tree-sitter concept extractor
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
├── scripts/
│   ├── dev-install.sh          # Symlink skills + install deps
│   └── setup-test-data.sh      # Clone nano-vllm test data
├── test/
│   ├── test.ts                 # 57 CLI pipeline tests
│   ├── e2e/test_viewer.py      # 19 Playwright E2E tests
│   ├── e2e/screenshots/        # Visual regression baselines
│   ├── fixture/                # Deterministic test fixture (3 files)
│   └── data/                   # Larger test projects (gitignored)
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
└── global/                 # Cross-file data (future)
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

2. **extension/ has duplicated code**: The old `extension/webview/`
   still exists alongside the new `viewer/`. Can be cleaned up when
   we confirm extension is no longer needed.

## What To Do Next

1. **Phase 2: Macro Flow** — LSP call hierarchy → Flow tab
2. **Visual regression baseline screenshots** — diff against captured baselines
3. **Consider**: file tree component, multi-tab support
