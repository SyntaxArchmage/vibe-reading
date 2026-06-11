---
name: learn
description: Analyze a codebase and generate Vibe Reading knowledge data. The agent drives the full pipeline — scanning files, extracting AST structure via CLI, then enriching with LLM-generated concept explanations.
---

# /learn — Analyze Codebase for Vibe Reading

## Overview

`/learn` is an agent-driven analysis pipeline that generates knowledge cards for every source file in a project. The agent orchestrates two phases:

1. **AST extraction** (automated via CLI) — Tree-sitter parses code structure
2. **Concept enrichment** (agent-driven) — LLM generates explanations for each AST entity

## Execution Flow

### Step 1: Run AST Extraction

```bash
cd <vibe-reading-repo>/cli && npm install  # first time only
cd <vibe-reading-repo>/cli && npx tsx analyze.ts <target-project-root>
```

This creates `.vibe-reading/files/*.json` with AST-extracted entities (function names, class names, line numbers). These entities have placeholder descriptions.

### Step 2: Enrich with Concept Explanations

For each JSON file in `.vibe-reading/files/`:

1. Read the JSON file to get the list of entities
2. Read the corresponding source file
3. For each entity, generate a concept explanation:
   - What does this function/class/interface do?
   - What design patterns or algorithms are used?
   - What's the role in the broader architecture?
   - Any non-obvious behavior or edge cases?
4. Update the entity's `summary` and `detail.description` fields
5. Write the enriched JSON back

#### Enrichment Prompt Template

For each entity in a file, use this structure:

```
Given this source file: <file-path>
And this code element at line <start_line>-<end_line>:

<code snippet>

Generate a concise concept card:
- summary: One-sentence description (max 80 chars) of what this does
- description: 2-4 sentence explanation including:
  - Purpose and responsibility
  - Key design patterns or algorithms used
  - How it fits into the broader system
  - Any non-obvious behavior
```

#### Entity Update Format

Update each entity in the JSON:
```json
{
  "summary": "<one-sentence description>",
  "detail": {
    "kind": "<function|class|interface|...>",
    "name": "<entity name>",
    "body_lines": <number>,
    "node_type": "<AST node type>",
    "description": "<2-4 sentence explanation>"
  }
}
```

### Step 3: Verify Coverage

```bash
cd <vibe-reading-repo>/cli && npx tsx harness.ts <target-project-root>
```

Must report 100% coverage. If any files failed, re-analyze them.

### Step 4: Report

Tell the user:
- How many files were analyzed
- How many entities were enriched
- Coverage percentage
- Suggest opening the preview: `cd <vibe-reading-repo>/extension && npm run preview`

## Important Notes

- The CLI `analyze.ts` handles file scanning, AST parsing, and JSON structure
- The agent handles LLM enrichment — reading code and generating explanations
- Do NOT call external LLM APIs — the agent IS the LLM
- Process files in batches to avoid overwhelming context
- Keep summaries concise (max 80 chars) — they appear collapsed in the sidebar
- Descriptions should be developer-oriented, not user-facing documentation
