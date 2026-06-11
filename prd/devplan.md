# Vibe Reading — Development Plan

## Overview

4 phases. Each phase delivers one complete feature pipeline:
data generation → harness validation → VS Code sidebar tab.

A shared "Phase 0" creates the foundational infrastructure that all
phases depend on.

---

## Phase 0: Foundation

**Goal**: VS Code extension skeleton + data schema + `/learn` skill
framework + harness tool.

### Tasks

- [ ] Initialize VS Code extension project (TypeScript + Webview + React)
- [ ] Define DataEntity JSON schema with LoC anchor
- [ ] Create `.vibe-reading/` directory structure convention
- [ ] Implement sidebar panel provider with tab skeleton (empty tabs)
- [ ] Create `/learn` Cursor skill that orchestrates analysis pipeline
- [ ] Implement harness tool: verify every non-ignored file has a JSON
- [ ] Implement manifest.json generation (file list, coverage status)
- [ ] Per-file JSON loading in extension (active file → load its JSON)
- [ ] File-switch listener: auto-update sidebar when active editor changes

### Verify

- [ ] `code --install-extension vibe-reading.vsix` succeeds
- [ ] Opening extension shows empty sidebar with 4 tab headers
- [ ] Running `/learn` on a small test project creates `.vibe-reading/files/`
      with one JSON per source file
- [ ] Harness reports 100% coverage on test project
- [ ] Switching files in editor triggers sidebar data reload (visible in
      debug console)

### Files

- `extension/` — VS Code extension scaffolding
- `extension/webview/` — React sidebar app
- `cli/analyze.ts` — Analysis orchestrator
- `cli/harness.ts` — Coverage verification tool
- `skills/learn/SKILL.md` — Cursor skill definition

### Depends On

None (first phase)

---

## Phase 1: Concept Push

**Goal**: When reading code, sidebar Concept tab shows knowledge cards
explaining design patterns, algorithms, and architecture concepts found
in the current file.

### Tasks

- [ ] Implement concept extractor: AST + LLM pipeline
  - Tree-sitter extracts function/class/pattern nodes with LoC
  - LLM generates concept explanation for each node
  - Output: DataEntity with type "concept"
- [ ] Integrate concept extractor into `/learn` pipeline
- [ ] Implement ConceptTab.tsx: render concept cards sorted by code position
- [ ] Card component: summary (collapsed) + detail (expanded on click)
- [ ] Anchor highlighting: clicking a card highlights the corresponding
      code range in the editor
- [ ] Visual polish: card animations, transitions, typography
- [ ] Harness: verify concept data exists for every analyzed file

### Verify

- [ ] Run `/learn` on vLLM or similar project → concept data generated
- [ ] Open a file → Concept tab shows relevant cards
- [ ] Click card → corresponding code range highlighted in editor
- [ ] Card expand/collapse animation is smooth (60fps)
- [ ] Harness reports all files have concept data

### Files

- `cli/extractors/concept.ts`
- `extension/webview/tabs/ConceptTab.tsx`
- `extension/webview/components/Card.tsx`
- `extension/src/decorations.ts`

### Depends On

Phase 0

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
- [ ] Integrate flow extractor into `/learn` pipeline
- [ ] Implement FlowTab.tsx: vertical call chain visualization
  - Current function in center
  - Callers above, callees below
  - Click to navigate to caller/callee location
- [ ] Visual polish: animated flow diagram, layer color coding
- [ ] Harness: verify flow data exists for every analyzed file

### Verify

- [ ] Run `/learn` → flow data + call-graph.json generated
- [ ] Open a function → Flow tab shows callers and callees
- [ ] Click caller → editor navigates to caller's location
- [ ] Call chain visualization renders correctly for functions with 5+
      callers/callees
- [ ] Harness reports all files have flow data

### Files

- `cli/extractors/flow.ts`
- `extension/webview/tabs/FlowTab.tsx`
- `.vibe-reading/global/call-graph.json`

### Depends On

Phase 1 (card component reuse, pipeline infrastructure)

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
- [ ] Integrate history extractor into `/learn` pipeline
- [ ] Implement HistoryTab.tsx:
  - Timeline view: major changes over time
  - Hot spots: highlight frequently-changed code regions
  - Change summary cards
- [ ] Visual polish: timeline animations, heat map overlay
- [ ] Harness: verify history data exists for files with git history

### Verify

- [ ] Run `/learn` → history data generated for files with commits
- [ ] Open a file → History tab shows change timeline
- [ ] Hot spots are visually marked
- [ ] Timeline shows meaningful PR/commit summaries (not just hashes)
- [ ] Harness reports coverage (new files without history get empty cards)

### Files

- `cli/extractors/history.ts`
- `extension/webview/tabs/HistoryTab.tsx`

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
- [ ] Integrate jump extractor into `/learn` pipeline
- [ ] Implement JumpTab.tsx:
  - Navigation suggestion cards with reasoning
  - One-click jump to suggested location
  - Breadcrumb trail of previously visited locations
- [ ] Inline ghost text hints (optional editor decorations)
- [ ] Visual polish: smooth scroll animation on jump
- [ ] Harness: verify jump data exists for analyzed files

### Verify

- [ ] Run `/learn` → jump data generated
- [ ] Open a file → Jump tab shows relevant suggestions
- [ ] Click suggestion → editor navigates to target with smooth scroll
- [ ] Suggestions are contextually relevant (not random)
- [ ] Breadcrumb trail tracks navigation history

### Files

- `cli/extractors/jump.ts`
- `extension/webview/tabs/JumpTab.tsx`
- `extension/src/decorations.ts` (ghost text)

### Depends On

Phase 3

---

## Phase Summary

| Phase | Name | Goal | Verify Count |
|-------|------|------|-------------|
| 0 | Foundation | Extension + schema + /learn + harness | 5 checks |
| 1 | Concept Push | Concept cards in sidebar | 5 checks |
| 2 | Macro Flow | Call chain visualization | 5 checks |
| 3 | Evolve Map | Git evolution timeline | 5 checks |
| 4 | Vibe Jump | Semantic navigation suggestions | 5 checks |
