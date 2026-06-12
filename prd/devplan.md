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

## Phase 1.5: Viewer Foundation (NEXT)

**Goal**: Upgrade the preview prototype into a proper standalone web
viewer with Monaco editor, file tree, and Playwright E2E testing.

### Tasks

- [x] Extract viewer from `extension/webview/` into `viewer/` as
      standalone React app with its own build
- [x] `/teach-me` skill: starts viewer server + opens browser
- [x] Viewer reads `.vibe-reading/` data and serves source files
- [ ] Integrate `@monaco-editor/react` for syntax highlighting, line
      numbers, minimap, code folding, and decorations (replaces current
      plain `<pre>` code display)
- [ ] Monaco decorations: click card → highlight corresponding code
      range via `editor.createDecorationsCollection()`
- [ ] File tree component (React): renders project structure from
      `.vibe-reading/` manifest, click to open file in Monaco
- [ ] Tab bar component (React): multiple open files with tab switching
- [ ] Playwright E2E test suite:
  - Launch headless browser → open viewer
  - Verify file list renders with correct count
  - Click card → verify code line highlighting (Monaco decoration)
  - Expand card → verify description renders
  - Screenshot comparison for visual regression
- [ ] Schema validation in harness (not just coverage — field types,
      required fields, value constraints)
- [ ] Clean up extension/ (remove duplicated webview code)

### Verify

- [ ] `/teach-me` opens browser, Monaco shows syntax-highlighted code
- [ ] Click card → Monaco highlights the code range
- [ ] File tree allows navigation between files
- [ ] Playwright tests pass headless (agent can run autonomously)
- [ ] Harness rejects malformed JSON (schema validation)

### Files

- `viewer/src/MonacoEditor.tsx` — Monaco wrapper with decoration API
- `viewer/src/FileTree.tsx` — Project file tree component
- `viewer/src/TabBar.tsx` — Multi-file tab management
- `skills/teach-me/SKILL.md` — `/teach-me` skill
- `test/e2e/` — Playwright tests

### Depends On

Phase 1

---

## Phase 2: Macro Flow

**Goal**: Flow tab shows the current code's position in the system —
call chain (who calls this, what this calls), data flow, and
architectural layer.

### Tasks

- [ ] Implement flow extractor:
  - LSP call hierarchy (incoming/outgoing calls) for functions
  - Tree-sitter import analysis for module-level dependencies
  - LLM: architectural layer assignment + data flow description
  - Output: DataEntity with type "flow"
- [ ] Global call-graph.json: cross-file call relationships
- [ ] Integrate flow extractor into `/learn-code` pipeline
- [ ] Implement FlowTab in web viewer: vertical call chain visualization
  - Current function in center
  - Callers above, callees below
  - Click to navigate to caller/callee file + highlight
- [ ] Visual polish: animated flow diagram, layer color coding
- [ ] Harness: verify flow data schema + coverage
- [ ] Playwright E2E: test flow card interactions

### Verify

- [ ] Run `/learn-code` → flow data + call-graph.json generated
- [ ] Open a function → Flow tab shows callers and callees
- [ ] Click caller → code viewer navigates to caller's file + line
- [ ] Playwright visual regression passes
- [ ] Harness reports all files have flow data

### Files

- `cli/extractors/flow.ts`
- `viewer/src/tabs/FlowTab.tsx`
- `.vibe-reading/global/call-graph.json`

### Depends On

Phase 1.5 (viewer foundation, Playwright infrastructure)

---

## Phase 3: Evolve Map

**Goal**: History tab shows git evolution of the current code — change
frequency, recent PRs, design decisions.

### Tasks

- [ ] Implement history extractor:
  - Git log per-file: commit history, change frequency
  - Git blame: per-line last-change info
  - PR description extraction (if available via GitHub API or local)
  - LLM: summarize evolution narrative
  - Output: DataEntity with type "history"
- [ ] Integrate history extractor into `/learn-code` pipeline
- [ ] Implement HistoryTab in web viewer:
  - Timeline view: major changes over time
  - Hot spots: highlight frequently-changed code regions
  - Change summary cards
- [ ] Visual polish: timeline animations, heat map overlay
- [ ] Harness: verify history data schema + coverage
- [ ] Playwright E2E: test timeline interactions

### Verify

- [ ] Run `/learn-code` → history data generated for files with commits
- [ ] Open a file → History tab shows change timeline
- [ ] Hot spots are visually marked
- [ ] Playwright visual regression passes
- [ ] Harness reports coverage (new files without history get empty cards)

### Files

- `cli/extractors/history.ts`
- `viewer/src/tabs/HistoryTab.tsx`

### Depends On

Phase 2

---

## Phase 4: Vibe Jump

**Goal**: Jump tab shows semantic navigation suggestions — "you might
want to read this next" based on the code you're currently viewing.

### Tasks

- [ ] Implement jump extractor:
  - LSP: go-to-definition targets, type definition locations
  - LLM: semantic relationship inference
  - Output: DataEntity with type "jump"
- [ ] Integrate jump extractor into `/learn-code` pipeline
- [ ] Implement JumpTab in web viewer:
  - Navigation suggestion cards with reasoning
  - One-click jump to suggested file + line
  - Breadcrumb trail of previously visited locations
- [ ] Visual polish: smooth scroll animation on jump
- [ ] Harness: verify jump data schema + coverage
- [ ] Playwright E2E: test jump navigation

### Verify

- [ ] Run `/learn-code` → jump data generated
- [ ] Open a file → Jump tab shows relevant suggestions
- [ ] Click suggestion → code viewer navigates to target file + line
- [ ] Playwright visual regression passes
- [ ] Breadcrumb trail tracks navigation history

### Files

- `cli/extractors/jump.ts`
- `viewer/src/tabs/JumpTab.tsx`

### Depends On

Phase 3

---

## Phase Summary

| Phase | Name | Status | Goal |
|-------|------|--------|------|
| 0 | Foundation | ✅ Done | Schema + /learn-code + harness + CLI |
| 1 | Concept Push | ✅ Done | Concept cards in web viewer |
| 1.5 | Viewer Foundation | Next | Standalone viewer + Playwright + /teach-me |
| 2 | Macro Flow | Pending | Call chain visualization |
| 3 | Evolve Map | Pending | Git evolution timeline |
| 4 | Vibe Jump | Pending | Semantic navigation suggestions |
