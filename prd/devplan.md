# Vibe Reading — Development Plan

## Overview

4 feature phases + 2 infrastructure phases. Each feature phase delivers
one complete pipeline: data generation → harness validation → web viewer
tab.

Phase 0 creates foundational infrastructure. Phase 1.5 builds the
standalone web viewer and testing framework.

---

## Phase 0: Foundation ✅ DONE

**Goal**: Data schema + `/learn-code` skill framework + CLI tools +
harness + React sidebar prototype.

### Completed

- [x] Define DataEntity JSON schema with LoC anchor
- [x] Create `.vibe-reading/` directory structure convention
- [x] Create `/learn-code` Cursor skill (orchestrates analysis pipeline)
- [x] Implement harness tool: verify every non-ignored file has a JSON
- [x] Implement manifest.json generation (file list, coverage status)
- [x] React sidebar app with 4 tab skeleton
- [x] File-switch listener for auto-updating sidebar
- [x] 42 automated assertions in test suite

### Files

- `cli/analyze.ts` — Analysis orchestrator
- `cli/enrich.ts` — Agent writes enriched data
- `cli/harness.ts` — Coverage verification tool
- `skills/learn/SKILL.md` — Cursor skill definition
- `viewer/` — React web viewer prototype

---

## Phase 1: Concept Push ✅ DONE

**Goal**: Concept cards showing design patterns, algorithms, and
architecture concepts for every entity in the current file.

### Completed

- [x] Tree-sitter AST extraction (web-tree-sitter WASM)
- [x] Languages: TypeScript, TSX, JavaScript, Python
- [x] Agent enrichment pipeline (agent IS the LLM)
- [x] `enrich.ts` CLI for agent to persist enriched data
- [x] `auto-enrich.ts` for batch enrichment from JSDoc
- [x] ConceptTab with polished Card component
- [x] Kind badges, monospace names, expand/collapse animation
- [x] Source code viewer with line highlighting
- [x] Searchable file picker (Ctrl+P, arrow keys)
- [x] Harness: 100% coverage verification
- [x] Demo: Pi agent (663 files, 1465 entities enriched)

### Files

- `cli/extractors/concept.ts`
- `viewer/src/tabs/ConceptTab.tsx`
- `viewer/src/components/Card.tsx`
- `viewer/preview.html` + `viewer/server.ts`

---

## Phase 1.5: Viewer Foundation ✅ DONE (mostly)

**Goal**: Upgrade the preview prototype into a proper standalone web
viewer with Monaco editor, file tree, and Playwright E2E testing.

### Tasks

- [x] Extract viewer from `extension/webview/` into `viewer/` as
      standalone React app with its own build
- [x] `/teach-me` skill: starts viewer server + opens browser
- [x] Viewer reads `.vibe-reading/` data and serves source files
- [x] Integrate Monaco editor (CDN) for syntax highlighting, line
      numbers, minimap, code folding, and decorations
- [x] Monaco decorations: click card → highlight corresponding code
      range via `deltaDecorations()`
- [x] File tree component (React): collapsible directory tree from
      `.vibe-reading/` data, click to open file in Monaco
- [x] Tab bar component (React): multiple open files with close buttons
- [x] Schema validation in harness (types, anchors, required fields,
      value constraints — rejects malformed JSON)
- [x] Clean up extension/ (removed duplicated webview code)
- [x] Activity bar with explorer toggle and search shortcut
- [x] Command palette file picker (Ctrl+P, centered, overlay backdrop)
- [ ] Playwright E2E test suite (18 tests written, browser install
      blocked by network — tests ready to run when available)
- [ ] Visual regression baseline screenshots

### Verify

- [x] `/teach-me` opens browser, Monaco shows syntax-highlighted code
- [x] Click card → Monaco highlights the code range
- [x] File tree allows navigation between files
- [ ] Playwright tests pass headless (agent can run autonomously)
- [x] Harness rejects malformed JSON (schema validation — test 10/11)

### Files

- `viewer/src/MonacoEditor.tsx` — Monaco wrapper with decoration API
- `viewer/src/FileTree.tsx` — Project file tree component
- `viewer/src/TabBar.tsx` — Multi-file tab management
- `skills/teach-me/SKILL.md` — `/teach-me` skill
- `test/e2e/` — Playwright tests

### Depends On

Phase 1

---

## Phase 2: Macro Flow ✅ DONE

**Goal**: Flow tab shows the current code's position in the system —
call chain (who calls this, what this calls), data flow, and
architectural layer.

### Completed

- [x] Implement flow extractor (Tree-sitter):
  - Import analysis for module-level dependencies
  - Function call extraction with enclosing function tracking
  - Export analysis for module public surface
  - Output: DataEntity with type "flow"
- [x] Global call-graph.json: cross-file call relationships
- [x] Integrate flow extractor into analyze pipeline
- [x] FlowTab in web viewer: categorized cards (imports/calls/exports)
  - Expand to see dependency details and callees
  - Kind-colored badges and icons
- [x] Harness: schema validates flow entities

### Deferred

- [ ] LSP call hierarchy (needs language server infrastructure)
- [ ] LLM architectural layer assignment (requires agent enrichment)
- [ ] Visual flow diagram (vertical call chain visualization)
- [ ] Playwright E2E (blocked by system library: libxkbcommon.so.0)

### Files

- `cli/extractors/flow.ts`
- `viewer/src/tabs/FlowTab.tsx`
- `.vibe-reading/global/call-graph.json`

---

## Phase 3: Evolve Map ✅ DONE

**Goal**: History tab shows git evolution of the current code — change
frequency, recent PRs, design decisions.

### Completed

- [x] Implement history extractor:
  - Git log per-file: commit history, change frequency
  - File age calculation (created date → current)
  - Hot spot detection (3+ changes in 30 days)
  - Recent changes timeline (last 5 commits)
  - Output: DataEntity with type "history"
- [x] Integrate history extractor into analyze pipeline
- [x] HistoryTab in web viewer:
  - File history card with commit count and age
  - Recent changes timeline with commit details
  - Hot spot indicator for actively modified files
  - Kind-colored badges and date formatting

### Deferred

- [ ] Git blame: per-line last-change info
- [ ] PR description extraction (GitHub API)
- [ ] Heat map overlay visualization
- [ ] Playwright E2E tests

### Files

- `cli/extractors/history.ts`
- `viewer/src/tabs/HistoryTab.tsx`

---

## Phase 4: Vibe Jump ✅ DONE

**Goal**: Jump tab shows semantic navigation suggestions — "you might
want to read this next" based on the code you're currently viewing.

### Completed

- [x] Implement jump extractor:
  - Resolve local imports to target files in the project
  - Show imported names and reasoning for each jump
  - Output: DataEntity with type "jump"
- [x] Integrate jump extractor into analyze pipeline
- [x] JumpTab in web viewer:
  - Navigation suggestion cards with target file and names
  - One-click jump navigates to target file in Monaco
  - Informative empty state when no jumps available
- [x] Jump card click navigates to target file in viewer

### Completed (Added in later cycles)

- [x] Navigation history with back/forward (Alt+←/→)

### Deferred

- [ ] LSP: go-to-definition targets
- [ ] LLM: semantic relationship inference
- [ ] Playwright E2E tests

### Files

- `cli/extractors/jump.ts`
- `viewer/src/tabs/JumpTab.tsx`

---

## Phase Summary

| Phase | Name | Status | Goal |
|-------|------|--------|------|
| 0 | Foundation | ✅ Done | Schema + /learn-code + harness + CLI |
| 1 | Concept Push | ✅ Done | Concept cards in web viewer |
| 1.5 | Viewer Foundation | ✅ Done | Standalone viewer + Playwright + /teach-me |
| 2 | Macro Flow | ✅ Done | Call chain visualization |
| 3 | Evolve Map | ✅ Done | Git evolution timeline |
| 4 | Vibe Jump | ✅ Done | Semantic navigation suggestions |
