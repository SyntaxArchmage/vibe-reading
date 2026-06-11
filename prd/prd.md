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

VS Code Extension — sidebar panel (Webview) + inline decorations.

### Core Flow

1. Install tool (skills + VS Code extension)
2. Open project in VS Code
3. Run `/learn` in Cursor/agent — agent invokes analysis pipeline
4. Wait for data ready (progress indicator in sidebar)
5. Toggle sidebar panel → knowledge cards appear for active file
6. Switch tabs to focus on different information types
7. Click card to expand details
8. Navigate to next file — sidebar auto-updates

### Sidebar Organization

- **Tab-based layout**: One tab per information type
  - Concept — design patterns, algorithms, architecture concepts
  - Flow — call chain, data flow, system position
  - History — git evolution, PR reasons, change frequency
  - Jump — semantic navigation suggestions
- **Within each tab**: Cards ordered by code position (top to bottom)
- **Each card**: Anchored to a code location (LoC), shows summary,
  click to expand detail

### Error Handling

- No data yet → sidebar shows "Run /learn to analyze this project"
- Analysis in progress → progress bar
- File not in analysis scope (ignored) → sidebar shows nothing

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
| Analysis — AST | Tree-sitter | Fast, multi-language, deterministic |
| Analysis — Semantic | LSP | Type info, cross-file refs, call hierarchy — compiler-grade accuracy |
| Analysis — History | Git | Commit history, PR context, change frequency |
| Analysis — AI | LLM (via agent) | Concept explanation, pattern recognition, intent inference |
| Frontend | VS Code Extension (Webview) | Embedded in editor, access to LSP, native performance |
| UI Framework | React + TypeScript (in Webview) | Mature ecosystem, animation libraries |
| Data Storage | Local JSON files | Simple, per-file granularity, git-committable |
| Trigger | Cursor Skill (`/learn`) | Agent-driven, can orchestrate all analysis tools |

### Key Architectural Decisions

1. **LSP over Tree-sitter-only**: Tree-sitter provides syntax structure.
   LSP provides semantic information (type resolution, cross-file refs,
   call hierarchy). This is our competitive advantage over UA.

2. **Per-file JSON over monolith graph**: UA uses one large
   knowledge-graph.json. We split by file for:
   - Better load performance (load only active file's data)
   - Simpler incremental updates
   - Natural alignment with "source code as primary" philosophy

3. **Agent-triggered analysis over auto-run**: `/learn` is explicitly
   invoked because it uses LLM agent capabilities. The VS Code extension
   only reads data, never triggers analysis.

### Module Structure

```
vibe-reading/
├── skills/                     # Cursor skills for /learn
│   └── learn/
│       └── SKILL.md
├── cli/                        # CLI tools for analysis pipeline
│   ├── analyze.ts              # Main analysis orchestrator
│   ├── extractors/             # Data extractors by type
│   │   ├── concept.ts          # LLM-based concept extraction
│   │   ├── flow.ts             # LSP + Tree-sitter call analysis
│   │   ├── history.ts          # Git history analysis
│   │   └── jump.ts             # Semantic jump suggestions
│   └── harness.ts              # Coverage verification
├── extension/                  # VS Code extension
│   ├── src/
│   │   ├── extension.ts        # Extension entry point
│   │   ├── sidebar.ts          # Sidebar panel provider
│   │   └── decorations.ts      # Inline code decorations
│   └── webview/                # React app for sidebar
│       ├── App.tsx
│       ├── tabs/
│       │   ├── ConceptTab.tsx
│       │   ├── FlowTab.tsx
│       │   ├── HistoryTab.tsx
│       │   └── JumpTab.tsx
│       └── components/
│           └── Card.tsx
└── prd/                        # This directory
```

## 7. Scope Boundary

### In Scope (V1 — 4 phases, one feature pipeline per phase)

- **Phase 1**: Concept Push — concept data generation + harness + sidebar tab
- **Phase 2**: Macro Flow — call chain data from LSP/Tree-sitter + Flow tab
- **Phase 3**: Evolve Map — git history analysis + History tab
- **Phase 4**: Vibe Jump — semantic navigation + Jump tab

Each phase delivers a complete pipeline: data generation → harness
validation → VS Code visualization.

### Out of Scope

- **Independent web dashboard**: Not building a standalone web page.
  All visualization in VS Code.
- **Real-time analysis**: All analysis is offline via `/learn`. No
  real-time LLM calls during reading.
- **Multi-IDE support**: VS Code only in V1. No JetBrains, Neovim, etc.
- **Team collaboration features**: Single-user tool in V1.
- **Auto-trigger analysis**: User must explicitly run `/learn`.

### Future Considerations (V2+)

- Dual-direction anchor lines (animated connections between code and cards)
- Incremental `/learn` (only re-analyze changed files)
- Custom card types (user-defined information extractors)
- Multi-IDE support via LSP protocol
- Auto-update on git commit (like UA's `--auto-update`)

## 8. Non-Functional Requirements

- **Visual Quality**: Animations and visual effects must be polished enough
  for livestream/screencast demonstration. This is a core competitive
  differentiator, not a nice-to-have.
- **Performance**: Sidebar must load per-file data in < 200ms. No perceptible
  lag when switching files.
- **Analysis Coverage**: Harness tool guarantees every non-ignored file has
  generated data. Zero gaps.
