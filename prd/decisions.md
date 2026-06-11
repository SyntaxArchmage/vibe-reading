# Vibe Reading — Decision Log

Decisions made during Socratic exploration, with context and rationale.

## 1. Source Code as Primary, Not Dashboard

- **Context**: Deciding the presentation model for code understanding
- **Options Considered**:
  - A: Standalone web dashboard (like Understand-Anything)
  - B: VS Code sidebar embedded in the editor
- **Decision**: B — VS Code sidebar
- **Rationale**: The core value proposition is "touch the code." A separate
  dashboard takes users away from source code, creating "fake understanding."
  The sidebar keeps source code visible at all times.
- **Trade-offs**: Limited rendering capabilities compared to a full web page.
  Complex visualizations (like large graph layouts) may be harder.

## 2. Offline Analysis + Static Presentation

- **Context**: Should analysis happen in real-time or offline?
- **Options Considered**:
  - A: Real-time — analyze as user navigates
  - B: Offline — `/learn` generates all data upfront
- **Decision**: B — Offline via `/learn`
- **Rationale**: Analysis requires LLM agent, which is expensive and slow.
  Offline batch processing is more reliable. VS Code extension only reads
  static JSON — simpler, faster, no LLM dependency at read time.
- **Trade-offs**: Data can become stale if code changes. User must re-run
  `/learn`.

## 3. LSP + Tree-sitter + LLM (Three-Layer Analysis)

- **Context**: What tools to use for code analysis?
- **Options Considered**:
  - A: Tree-sitter + LLM only (like Understand-Anything)
  - B: Tree-sitter + LSP + LLM
- **Decision**: B — Three-layer analysis
- **Rationale**: Tree-sitter provides syntax structure. LSP provides semantic
  information (type resolution, cross-file references, call hierarchy) that
  Tree-sitter cannot. This is our competitive advantage — compiler-grade
  accuracy in analysis.
- **Trade-offs**: LSP requires language server to be running. May not work
  for all languages equally.

## 4. Per-File JSON over Monolith Graph

- **Context**: How to organize analysis output data?
- **Options Considered**:
  - A: Single large knowledge-graph.json (like UA)
  - B: Per-file JSON in `.vibe-reading/files/`
- **Decision**: B — Per-file JSON
- **Rationale**: Aligned with "source code as primary" — each file has its
  own analysis data. Better load performance (only load active file's data).
  Simpler incremental updates.
- **Trade-offs**: Cross-file relationships need a separate global JSON.

## 5. Tab-Based Sidebar Organization

- **Context**: How to organize multiple card types in the sidebar?
- **Options Considered**:
  - A: Mixed feed sorted by code position
  - B: Tabs by information type
- **Decision**: B — Tabs by type (Concept / Flow / History / Jump)
- **Rationale**: Users decide what kind of information they need at any given
  moment. Sometimes they want call flow context, sometimes concept
  explanations. Tabs let users control focus.
- **Trade-offs**: May miss cross-type insights. Could add a "combined" tab
  later if needed.

## 6. Harness-Guaranteed Full Coverage

- **Context**: What if `/learn` misses some files?
- **Options Considered**:
  - A: Graceful degradation (sidebar shows nothing for unanalyzed files)
  - B: Harness tool guarantees 100% coverage
- **Decision**: B — Harness tool verifies and auto-retries
- **Rationale**: The product promise is "knowledge for every file you open."
  Partial coverage breaks trust. Harness catches gaps and re-analyzes.
- **Trade-offs**: First `/learn` run takes longer. Worth it for reliability.

## 7. One Feature Pipeline Per Phase

- **Context**: How to structure the development roadmap?
- **Options Considered**:
  - A: Build all features' data pipeline first, then all visualization
  - B: Each phase delivers one complete feature end-to-end
- **Decision**: B — One complete feature per phase
- **Rationale**: Each feature is a full pipeline (data generation → harness →
  visualization). Delivering end-to-end per phase means each phase produces
  a shippable, demonstrable increment.
- **Trade-offs**: Some pipeline infrastructure work is duplicated. Mitigated
  by Phase 0 setting up shared foundations.

## 8. Visual Quality as Core Requirement

- **Context**: How much to invest in visual polish?
- **Options Considered**:
  - A: Functional but plain UI
  - B: High-quality animations and visual effects
- **Decision**: B — Fancy visuals are a core requirement
- **Rationale**: The product will be used in livestream/screencast contexts.
  Visual impact is a competitive differentiator and marketing asset. This
  affects tech choices (animation libraries, CSS quality).
- **Trade-offs**: More development time per feature. Worth it for the
  product positioning.
