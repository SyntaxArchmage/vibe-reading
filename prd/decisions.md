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

## 9. Animation Library: Framer Motion

- **Context**: Which animation library to use in VS Code webview?
- **Options Considered**:
  - A: CSS-only (transitions + animations)
  - B: Framer Motion (motion/react)
  - C: Motion One (@motionone/dom, WAAPI-based)
- **Decision**: B — Framer Motion (motion/react)
- **Rationale**: Motion One lacks official React binding (imperative API
  via useRef/useEffect). Framer Motion is declarative, has AnimatePresence
  for enter/exit, layout animations, stagger — exactly what card UI needs.
  Already validated in production VS Code extensions (Vox Foundation 2026).
  Tree-shakable, ~30KB gzipped.
- **Trade-offs**: Larger than CSS-only. Known memory leak in visualElement
  (fixed in latest). Must respect `vscode-reduce-motion` class manually.

## 10. LSP Deferred to Phase 2

- **Context**: When to integrate LSP for semantic analysis?
- **Options Considered**:
  - A: From Phase 0 — set up LSP infrastructure early
  - B: Phase 2 — when call hierarchy is actually needed
- **Decision**: B — Phase 0 uses Tree-sitter + LLM only
- **Rationale**: Phase 0 is foundation (extension skeleton, schema, harness).
  Phase 1 (Concept Push) only needs AST + LLM. LSP call hierarchy is
  needed in Phase 2 (Macro Flow). Deferring reduces Phase 0 complexity
  and lets the extension framework stabilize before adding LSP communication.
- **Trade-offs**: May need to refactor pipeline when LSP is added.

## 11. /learn Skill Independence

- **Context**: Does /learn depend on the Socratic skill?
- **Decision**: No — /learn is an independent Cursor skill within vibe-reading
- **Rationale**: Socratic's mission was PRD generation (completed). /learn
  orchestrates the analysis pipeline (Tree-sitter, LLM, harness). Different
  purpose, different lifecycle.

## 12. Demo Project Strategy

- **Context**: Which project to use for testing /learn during development?
- **Decision**: Toy project for development, vLLM for demo/showcase
- **Rationale**: Small controlled project (10-20 files) enables fast
  iteration and deterministic testing. vLLM is the showcase target but
  too large for rapid dev cycles.
