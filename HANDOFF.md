# Vibe Reading — Handoff Document

Session: 2026-06-08 → 2026-06-11
Agent: Cursor (Opus 4.6) on 10.0.16.52

## What Was Done

### 1. Socratic Skill Created (separate repo)

**Repo**: https://github.com/SyntaxArchmage/socratic
**Location on 52**: `/home/albert/workspace/socratic/`
**Dev symlink**: `~/.cursor/skills/socratic` → source

A Cursor agent skill for dynamic PRD generation through Socratic
questioning. Features:
- Coverage Matrix: 8 mandatory dimensions with sufficiency conditions
- Fixed-Point Convergence: hidden prediction + consecutive hit detection
- Dynamic question generation (not fixed question list)
- PRD + DevPlan + Decisions output template

### 2. Vibe Reading PRD Completed (this repo)

**Repo**: https://github.com/SyntaxArchmage/vibe-reading (private)
**Location on 52**: `/home/albert/workspace/vibe-reading/`

Full Socratic exploration completed. All 8 dimensions LOCKED:

| Dimension | Summary |
|-----------|---------|
| Problem & Value | Existing tools create "fake understanding" by pulling users away from source code |
| Target Users | Any developer new to a codebase (everyone is a beginner on most projects) |
| Core Scenarios | Install → `/learn` → toggle sidebar → read code with knowledge cards |
| Interaction Model | Tab-based sidebar (Concept / Flow / History / Jump), cards anchored to LoC |
| Data Model | DataEntity with LoC anchor (compiler debug info inspired), per-file JSON |
| Tech & Architecture | Tree-sitter + LSP + LLM + Git → VS Code Extension (Webview) |
| Scope Boundary | 4 phases, each a complete pipeline; no web dashboard, no real-time, no multi-IDE |
| DevPlan | Phase 0 (foundation) → Phase 1-4 (one feature per phase), 25 verify checks total |

### Key Decisions Made

1. Source code as primary (not dashboard) — "touch the code"
2. Offline `/learn` + static JSON (no real-time LLM)
3. LSP + Tree-sitter + LLM three-layer analysis (competitive advantage over UA)
4. Per-file JSON (not monolith graph)
5. Tab-based sidebar (user controls focus)
6. Harness-guaranteed 100% file coverage
7. One complete feature pipeline per dev phase
8. Visual quality as core requirement (livestream/screencast ready)

## Files in This Repo

```
prd/
├── prd.md          # Complete PRD (8 sections, ~200 lines)
├── devplan.md      # 5-phase plan with 25 verify conditions
└── decisions.md    # 8 key decisions with rationale
```

## What To Do Next

### Immediate Next Step

Start **Phase 0: Foundation** — see `prd/devplan.md` for full task list.

Key tasks:
1. Initialize VS Code extension project (TypeScript + Webview + React)
2. Define DataEntity JSON schema
3. Create `/learn` Cursor skill
4. Implement harness tool
5. Sidebar panel with empty tab skeleton

### To Clone This Repo on Another Machine

```bash
# Clone both repos
git clone git@github.com:SyntaxArchmage/socratic.git ~/workspace/socratic
git clone git@github.com:SyntaxArchmage/vibe-reading.git ~/workspace/vibe-reading

# Install Socratic skill (dev mode)
mkdir -p ~/.cursor/skills
ln -sfn ~/workspace/socratic/.cursor/skills/socratic ~/.cursor/skills/socratic
```

### Open Questions for Next Session

- Which feature pipeline to implement first (Concept Push is recommended)
- Specific animation library for "fancy" visuals (Framer Motion? CSS-only?)
- LSP integration strategy for `/learn` (use VS Code's built-in LSP, or
  standalone language server?)
- Demo project choice (vLLM? smaller project for faster iteration?)

## Context That May Be Lost

- The "Vibe Reading" name comes from idea.docx in
  `/home/albert/workspace/croqtile-tuner-paper/idea.docx` (original
  brainstorm document with full design rationale)
- User's core philosophy: AI should help you read code, not read it for
  you. "虚假理解" (fake understanding) is the anti-pattern to avoid.
- Visual quality is non-negotiable — product will be shown in livestreams
- The compiler/LSP advantage is the key differentiator vs Understand-Anything
