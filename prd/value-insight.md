# Vibe Reading — Value Insight

## Competitive Landscape (June 2026)

### Understand-Anything (UA)

56K GitHub stars. The incumbent in code understanding tools.

- Multi-agent pipeline: project-scanner → file-analyzer → architecture-analyzer → tour-builder → graph-reviewer → domain-analyzer
- Output: `.understand-anything/knowledge-graph.json` (single monolith file)
- Dashboard: force-directed graph visualization, color-coded by architecture layer (API, Service, Data, UI, Utility)
- Skills: `/understand`, `/understand-dashboard`, `/understand-chat`, `/understand-diff`, `/understand-explain`, `/understand-onboard`
- Works with: Claude Code, Cursor, Copilot, Codex, Gemini CLI
- Tagline: "Graphs that teach, not graphs that impress"

### Other Tools

- **Codebase Onboarding Agent**: generates 12-section onboarding report + AI context files (CLAUDE.md, copilot-instructions.md)
- **Checkpoint**: commit-time living documentation via GitHub Actions
- **Sourcegraph Cody**: cross-repo code search and AI chat with citation
- **DeepWiki**: auto-generated wiki for codebases
- **Augment Code**: enterprise repository-wide indexing and semantic search

## UA's Fundamental Problem (Our Opportunity)

UA solves **"where is everything?"** but not **"what does this code actually mean?"**

The UA workflow:
1. Open dashboard → see graph of nodes
2. Click node → read AI summary paragraph
3. Feel like you understand
4. Go back to IDE → open actual file → **realize you don't understand**

The user never touched the code. They formed a mental model from abstractions — summaries and graph topology — that breaks on contact with actual implementation.

This is architectural, not a bug. The knowledge graph inherently pulls users **away from** source code into a separate visualization space. Reading an AI summary of `parseConfig` is not the same as reading the 40-line function itself and understanding why it merges defaults in that specific order.

**UA is a map. Maps are useful. But you still have to drive the road.**

## Three User Segments

### Segment 1: Current UA Users

~56K+ stars worth of people who already want code understanding tools.

**Their experience**: Installed UA, ran `/understand`, saw the graph. The dashboard is impressive. But many have felt:
- "The graph is cool but I still don't understand the code"
- "I look at the dashboard, then go back to my editor, and the context is lost"
- "The summaries are too high-level"

**What we offer**: "You don't have to leave your code. Knowledge cards appear next to the code you're reading."

**Pitch**: UA is maps. We are GPS turn-by-turn navigation.

### Segment 2: Non-UA Users Who Need Code Understanding

Developers who:
- Join new teams and need to understand unfamiliar codebases
- Do code reviews on repos they don't own
- Explore open-source projects before contributing
- Need to debug or fix code they didn't write

They haven't used UA because:
- They don't want to install another tool / plugin
- The "knowledge graph" concept feels academic
- They just want to open the code and understand it

**What we offer**: "Install a skill. Run `/learn-code`. Open a link. Read code with explanations."

**Pitch**: Zero-install web viewer. Just a URL.

### Segment 3: AI Agent Workflows (Fastest-Growing)

The 2026 trend: developers use AI agents to write code, but need to understand what was written.

When an agent generates 500 lines of code across 10 files:
1. Developer needs to understand what was generated
2. Developer needs to verify correctness
3. Developer needs mental models for future maintenance

UA's pitch to this segment: "commit the knowledge graph JSON, agents can query it."
Our pitch: **"Teach me what you just wrote."**

**What we offer**: `/learn-code` runs on the agent's output → `/teach-me` opens a web viewer → developer reads AI-generated code with concept cards explaining each function, call chain, and design decisions.

## Key Differentiators

| | UA | Vibe Reading |
|--|--|--|
| Core metaphor | Map (bird's eye view) | GPS (turn-by-turn in code) |
| Where you read | Dashboard (separate from code) | Next to code (web viewer) |
| Source code visible? | No (click node → summary popup) | Yes (always primary, cards secondary) |
| Friction to try | Install plugin + run pipeline | Install skill + open URL |
| Output format | Single knowledge-graph.json | Per-file JSON (load only current file) |
| Anchoring | Nodes in a graph (abstract) | Line-of-code anchors (concrete) |
| Agent integration | Agent queries graph | Agent IS the analyzer (zero API cost) |
| Reusable by team | Commit JSON to repo | Commit .vibe-reading/ to repo |
| Visual experience | Force-directed graph (impressive) | Code + cards (useful) |
| Scalability | Single JSON grows with project | Per-file: viewer loads only what you read |

## The "Open a Link" Advantage

**UA workflow**:
1. Install plugin in AI coding environment
2. Run `/understand` (multi-agent pipeline, minutes)
3. Run `/understand-dashboard` (opens browser)
4. Navigate graph → find node → click → read summary
5. Go back to IDE to see actual code

**Our workflow**:
1. Install skill (one command)
2. Run `/learn-code` (agent analyzes)
3. Run `/teach-me` (browser opens automatically)
4. **You're already looking at code with explanations**

Steps 3-4 collapse into one: browser opens, code is there, knowledge cards are beside it. No graph navigation step. No "find the node." Just read.

## The "Web Viewer, Not IDE" Positioning

Critical positioning decision: we call it a **Web Viewer**, not an IDE.

1. **No identity conflict**: "I already have an IDE" → "This isn't replacing your IDE, it's a reading view"
2. **Zero commitment**: "Just open the URL. If you don't like it, close the tab."
3. **Shareable**: "Send the link to a teammate for code review"
4. **Cross-platform**: Works on any device with a browser — iPad, phone, meeting room screen
5. **Future hosted mode**: Upload `.vibe-reading/` → get a shareable URL → anyone can read annotated code, zero local setup

## Agent-Centric Value Propositions

For agent-workflow developers (the fastest-growing segment):

### 1. Agent IS the LLM — Zero Additional Token Cost

UA's multi-agent pipeline calls external LLMs to generate summaries. Our agent generates explanations as part of its normal workflow — the agent reading the code IS the analysis step. No additional API calls, no additional cost.

### 2. Per-File Granularity — Instant at Any Scale

UA's single `knowledge-graph.json` grows linearly with project size. A 1000-file project produces a multi-MB JSON that the dashboard must load entirely. Our per-file JSON means the viewer loads only the file you're reading — instant even on 10K-file repos.

### 3. "Teach Me What You Just Wrote"

After an agent generates code:
- `/learn-code` analyzes the generated files
- `/teach-me` opens a walkthrough of the generated code
- Developer sees each function with concept cards explaining purpose, patterns, architecture role

UA has no equivalent. Its pipeline treats all code the same regardless of authorship or recency.

### 4. Schema-Enforced Data Quality

Our harness tools validate that every generated JSON strictly matches the viewer's expected schema — field types, required fields, value constraints. If the data is wrong, the pipeline fails deterministically. UA has a `graph-reviewer` agent, but it's LLM-based (non-deterministic).

## Future Value Vectors

### Hosted Mode
Upload `.vibe-reading/` data → get `vibe-reading.dev/view?project=xxx` → shareable annotated code viewer. Useful for:
- Open-source project documentation
- Team onboarding (new hire opens a link, reads annotated code)
- Code review (reviewer opens annotated PR view)

### Incremental Learning
Agent runs `/learn-code` after each coding session → data stays fresh → `/teach-me` always shows current state. No stale graphs.

### Multi-Modal Knowledge
Current: concept cards (what does this do?).
Future: flow cards (who calls this?), history cards (how did this evolve?), jump cards (what should I read next?). Four knowledge dimensions, all anchored to source code lines.
