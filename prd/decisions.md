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

## 13. Skills-First Distribution

- **Context**: How should users install and use Vibe Reading?
- **Options Considered**:
  - A: VS Code Extension (.vsix) — traditional extension marketplace
  - B: Cursor Skills — agent-native, cross-IDE
- **Decision**: B — Cursor Skills as primary distribution
- **Rationale**: Skills are the native unit for agent workflows. Users
  install with one command. Works with any agent environment (Cursor,
  Claude Code, Codex, etc). `/learn-code` and `/teach-me` are natural
  skill commands. VS Code extension locks us into one IDE.
- **Trade-offs**: Requires agent environment. Pure VS Code users without
  agent capabilities can't use it. Acceptable because our target user
  already uses AI agents.

## 14. Web Viewer, Not IDE

- **Context**: What is the visualization layer? Previous decision (#1)
  said "VS Code sidebar." Revisited after discovering agent cannot
  self-test VS Code webview UI.
- **Options Considered**:
  - A: VS Code webview (original plan)
  - B: Fork a Web IDE (Theia, OpenSumi) and ship as product
  - C: Lightweight web viewer — browser opens a URL, code + cards
- **Decision**: C — Web Viewer
- **Rationale**: (1) Agent can self-test with Playwright (autonomous
  E2E testing). (2) Zero-install for users — just open a URL. (3) No
  identity conflict with user's existing IDE. (4) Shareable URLs for
  team use. Technical implementation may use Monaco/OpenSumi components
  internally, but user-facing positioning is "a webpage," not "an IDE."
- **Trade-offs**: Less native than sidebar embedded in editor. User must
  switch to browser. Mitigated by automatic browser launch from skill.
- **Supersedes**: Decision #1 (sidebar-only) — expanded to web viewer
  as primary, sidebar as optional future enhancement.

## 15. Harness as Schema Contract

- **Context**: How to ensure CLI-generated data works with the viewer?
- **Options Considered**:
  - A: Trust the pipeline — viewer handles malformed data gracefully
  - B: Harness tools validate data matches viewer's expected schema
- **Decision**: B — Deterministic schema validation in harness
- **Rationale**: Non-deterministic LLM output must be validated
  deterministically before reaching the viewer. Field types, required
  fields, value constraints are all checked by harness tools. If data
  is wrong, the pipeline fails — not the viewer. This is a data
  contract between `/learn-code` (producer) and the web viewer (consumer).
- **Trade-offs**: More harness code to maintain. Worth it for reliability.

## 16. Playwright Autonomous Testing

- **Context**: How can the agent self-test and tune the UI?
- **Options Considered**:
  - A: Manual testing (agent writes code, human verifies)
  - B: Playwright E2E (agent launches headless browser, interacts, screenshots)
- **Decision**: B — Playwright E2E
- **Rationale**: The web viewer runs in a real browser. Playwright can
  launch headless Chromium, navigate to localhost, click cards, verify
  highlighting, take screenshots, and compare visual regression. This
  enables the agent to autonomously iterate on UI polish — change CSS,
  run Playwright, compare screenshots, repeat.
- **Trade-offs**: Playwright is a heavy dependency. Only needed in dev,
  not in user-installed skills.
