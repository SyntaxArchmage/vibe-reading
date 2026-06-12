# Vibe Reading — PRD

## 1. Problem Statement

现有代码理解工具（以 Understand-Anything 为代表）让开发者脱离源码，产生
"虚假理解"。

具体痛点：

- **代码不在场**：在独立的 dashboard 里看知识图谱，节点是摘要而非代码。想看
  实际代码还需要额外点击，上下文断裂。
- **导航逻辑错位**：以图谱拓扑（节点→边→节点）为导航，不是以开发者自然的
  源码阅读顺序（顺序+跳转）为导航。
- **虚假理解**：看了 AI 摘要和图谱后感觉"理解了"，但从未真正读过代码。
  用户没有 touch 到代码，技能没有同步成长。

## 2. Target Users

**对某个特定代码库是新手的开发者。**

不限经验级别。核心认知：大部分人对大部分项目都是新手。主场景是代码阅读与
学习，而不是给已经熟悉代码库的人用的工具。

### Primary Persona

- **Who**: 任何需要理解不熟悉代码库的开发者
- **Tech Level**: 不限（初级到资深都适用）
- **Context**: 打开一个不熟悉的项目，需要阅读和理解源码
- **Motivation**: 想真正理解代码，而不是看 AI 给的摘要就走

## 3. User Stories

### Story 1: First-time Codebase Exploration

**As** a developer new to a project, **I want to** read source code with
contextual knowledge pushed to a sidebar **so that** I understand the code
by reading it myself, with AI filling gaps.

**Given** I have installed the tool and run `/learn` on the project,
**when** I open a source file in VS Code,
**then** the sidebar displays relevant knowledge cards anchored to code
locations in the active file.

**Acceptance**: Sidebar shows cards per active file. Cards grouped by type
in separate tabs. Switching files updates cards.

### Story 2: Tab-based Information Filtering

**As** a reader exploring a codebase, **I want to** choose which type of
information to focus on (concepts, call flow, history, etc.) **so that**
I can control my reading focus.

**Given** the sidebar is open with multiple card types,
**when** I switch between tabs (Concept / Flow / History / Jump),
**then** only cards of that type are shown, anchored to relevant code
positions.

**Acceptance**: Tab switching is instant. Card count per tab is visible.
Active tab state persists across file switches.

### Story 3: Full-Coverage Analysis

**As** a user who ran `/learn`, **I want to** be sure every non-ignored
file has been analyzed **so that** I never open a file with missing data.

**Given** I run `/learn`,
**when** the analysis completes,
**then** a harness tool verifies every non-ignored file has generated data.
Missing files are re-analyzed automatically.

**Acceptance**: `ls .vibe-reading/files/ | wc -l` matches non-ignored
file count. A manifest file records coverage status.

### Edge Cases

- **Large monorepo**: `/learn` supports scoping to subdirectory
- **Binary/non-code files**: Ignored by default
- **Stale data**: If source changes after `/learn`, cards may be misaligned.
  User re-runs `/learn` to refresh

## 4. Interaction Design

### Modality

**Skills + Web Viewer.** Users install Cursor Skills and view results
in a browser. No IDE extension required.

### Core Flow

1. Install skills (one command: copy to `~/.cursor/skills/vibe-reading/`)
2. Open project in any agent environment (Cursor, Claude Code, etc.)
3. Run `/learn-code` — agent analyzes project, generates `.vibe-reading/` data
4. Run `/teach-me` — agent starts local web server, browser opens automatically
5. User reads code in web viewer with knowledge cards alongside
6. Switch files via searchable file picker
7. Click card → corresponding code lines highlighted
8. Click card to expand → description, metadata, architecture role
9. Close browser tab when done — nothing to uninstall

### Web Viewer Layout

- **Left panel**: Knowledge cards sidebar with tab-based filtering
  - Concept — design patterns, algorithms, architecture concepts
  - Flow — call chain, data flow, system position
  - History — git evolution, PR reasons, change frequency
  - Jump — semantic navigation suggestions
- **Right panel**: Source code with line numbers and syntax highlighting
- **File picker**: Searchable, sorted by entity count, Ctrl+P quick-open
- **Within each tab**: Cards ordered by code position (top to bottom)
- **Each card**: Anchored to a code location (LoC), shows summary,
  click to expand detail, click to highlight corresponding code

### Error Handling

- No data yet → viewer shows "Run /learn-code to analyze this project"
- File has no entities → viewer shows empty state with guidance
- Source file missing → code panel shows "Source file not found"

## 5. Data Model

### Core Abstraction: DataEntity

Inspired by compiler debug info (DWARF). Every piece of knowledge is a
DataEntity with a source code anchor.

```
DataEntity {
  anchor: LoC {
    file: string          // relative path
    start_line: int
    start_col: int
    end_line: int
    end_col: int
  }
  type: "concept" | "flow" | "history" | "jump"
  summary: string         // short text shown in collapsed card
  detail: object          // type-specific rich content
}
```

### Storage Structure

```
.vibe-reading/
├── manifest.json              # coverage status, analysis metadata
├── files/
│   ├── src__scheduler.py.json # per-file analysis data
│   ├── src__engine.py.json
│   └── ...
└── global/
    ├── call-graph.json        # cross-file call relationships
    └── project-overview.json  # project-level metadata
```

Each per-file JSON contains an array of DataEntity objects sorted by
anchor position. The VS Code extension loads only the JSON for the
active file — no large global graph in memory.

### Anchor Granularity

- **File-level**: Overall file role/purpose
- **Function/class-level**: Call chain, concept cards (from AST nodes)
- **Statement/expression-level**: Specific patterns, idioms

LoC information derived from AST (Tree-sitter) and LSP, both of which
provide exact source positions.

## 6. Architecture

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Distribution | Cursor Skills | Agent-native, cross-IDE, zero-install for users |
| Analysis — AST | Tree-sitter (WASM) | Fast, multi-language, deterministic |
| Analysis — Semantic | LSP (Phase 2+) | Type info, cross-file refs, call hierarchy |
| Analysis — History | Git (Phase 3+) | Commit history, PR context, change frequency |
| Analysis — AI | Agent IS the LLM | Zero external API cost — agent reads code and generates explanations |
| Viewer | Web Viewer (standalone) | Zero-install, browser-based, Playwright-testable |
| Viewer Tech | React + Monaco components | Code display with line numbers, syntax highlighting |
| UI Framework | React + Framer Motion | Card animations, expand/collapse, layout transitions |
| Data Storage | Per-file JSON | Load only active file's data, git-committable |
| Data Contract | CLI harness tools | Deterministic schema validation between pipeline and viewer |
| Testing | Playwright E2E | Agent can autonomously test and tune UI |

### Key Architectural Decisions

1. **Skills-first, not extension-first**: Users install Cursor Skills,
   not a VS Code extension. Skills work with any agent environment.
   See Decision #13.

2. **Web Viewer, not IDE**: Visualization is a browser-based web viewer,
   not an IDE. Zero-install, shareable URLs, cross-platform. Agent can
   self-test with Playwright. See Decision #14.

3. **Agent IS the LLM**: No external API calls for concept generation.
   The agent running `/learn-code` reads the code itself and generates
   explanations. Zero additional token cost vs UA's multi-agent pipeline.

4. **Per-file JSON over monolith graph**: UA uses one large
   knowledge-graph.json. We split by file for:
   - Better load performance (load only active file's data)
   - Simpler incremental updates
   - Natural alignment with "source code as primary" philosophy

5. **Harness as schema contract**: CLI harness tools validate that
   generated JSON matches the viewer's expected schema. Data contract
   is enforced deterministically. See Decision #15.

6. **LSP deferred to Phase 2**: Phase 1 uses Tree-sitter + agent LLM.
   LSP call hierarchy is needed in Phase 2 (Macro Flow). See Decision #10.

### Module Structure (Development Repo)

```
vibe-reading/
├── skills/                     # Cursor skills
│   ├── learn-code/
│   │   └── SKILL.md            # /learn-code entry point
│   └── teach-me/
│       └── SKILL.md            # /teach-me entry point
├── cli/                        # CLI tools (harness + analysis)
│   ├── analyze.ts              # AST extraction orchestrator
│   ├── enrich.ts               # Agent writes enriched data
│   ├── harness.ts              # Coverage + schema verification
│   ├── auto-enrich.ts          # Batch enrichment from JSDoc
│   └── extractors/
│       ├── concept.ts          # Tree-sitter AST extraction
│       ├── flow.ts             # LSP call analysis (Phase 2)
│       ├── history.ts          # Git history (Phase 3)
│       └── jump.ts             # Semantic jump (Phase 4)
├── viewer/                     # Web Viewer (standalone web app)
│   ├── src/
│   │   ├── App.tsx             # Main React app
│   │   ├── tabs/               # Tab components
│   │   └── components/         # Card, code viewer, file picker
│   ├── server.ts               # Local web server
│   └── preview.html            # Standalone preview page
├── test/                       # Automated tests
│   ├── test.ts                 # CLI pipeline tests
│   └── fixture/                # Test fixtures
└── prd/                        # Product docs
    ├── prd.md
    ├── devplan.md
    ├── decisions.md
    └── value-insight.md
```

### Installed Layout (User's Machine)

```
~/.cursor/skills/vibe-reading/
├── learn-code/SKILL.md         # /learn-code skill
├── teach-me/SKILL.md           # /teach-me skill
├── cli/                        # Analysis tools
│   ├── analyze.ts
│   ├── enrich.ts
│   └── harness.ts
├── bin/                        # Pre-built viewer binary/bundle
│   └── serve                   # Lightweight web server
└── INSTALL.md                  # Setup guide (handles $SKILL_DIR)
```

## 7. Scope Boundary

### In Scope (V1 — 4 phases, one feature pipeline per phase)

- **Phase 1**: Concept Push — concept data generation + harness + web viewer
- **Phase 2**: Macro Flow — call chain data from LSP/Tree-sitter + Flow tab
- **Phase 3**: Evolve Map — git history analysis + History tab
- **Phase 4**: Vibe Jump — semantic navigation + Jump tab

Each phase delivers a complete pipeline: data generation → harness
validation → web viewer visualization.

### Also In Scope

- **Web Viewer**: Standalone browser-based code viewer with knowledge
  cards. This IS the visualization layer (replaces previous VS Code-only scope).
- **Cross-IDE via Skills**: Works with any agent environment that
  supports skills — Cursor, Claude Code, Codex, etc.
- **Playwright E2E testing**: Agent can autonomously test and tune UI.
- **Searchable file picker**: For large projects (600+ files).

### Out of Scope

- **Real-time analysis**: All analysis is offline via `/learn-code`. No
  real-time LLM calls during reading.
- **Team collaboration features**: Single-user tool in V1.
- **Auto-trigger analysis**: User must explicitly run `/learn-code`.
- **Hosted cloud mode**: V2+ feature. V1 is local-only.
- **VS Code sidebar extension**: Deferred. Web viewer is the primary
  visualization. Sidebar can be added later as optional enhancement.

### Future Considerations (V2+)

- **Hosted mode**: Upload `.vibe-reading/` → shareable URL for team use
- Dual-direction anchor lines (animated connections between code and cards)
- Incremental `/learn-code` (only re-analyze changed files)
- Custom card types (user-defined information extractors)
- VS Code sidebar extension (optional, for users who prefer in-editor)
- Syntax highlighting in viewer (Shiki or highlight.js)
- Auto-update on git commit

## 8. Non-Functional Requirements

- **Visual Quality**: Animations and visual effects must be polished enough
  for livestream/screencast demonstration. This is a core competitive
  differentiator, not a nice-to-have.
- **Performance**: Sidebar must load per-file data in < 200ms. No perceptible
  lag when switching files.
- **Analysis Coverage**: Harness tool guarantees every non-ignored file has
  generated data. Zero gaps.
