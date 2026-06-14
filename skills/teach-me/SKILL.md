---
name: teach-me
description: Open the Vibe Reading web viewer to explore a codebase with knowledge cards. Run /learn-code first to generate data.
---

# /teach-me — Open the Code Viewer

## What This Does

Starts a local web server and opens a browser to view source code with
knowledge cards. Each card explains what a function, class, or interface
does — purpose, patterns, architecture role.

## Prerequisites

1. Run `/learn-code` on the project first to generate `.vibe-reading/` data
2. Viewer dependencies installed (one-time):

```bash
cd <vibe-reading-repo>/viewer && npm install
```

## Steps

### 1. Build the Viewer (If Not Already Built)

```bash
cd <vibe-reading-repo>/viewer && node build.mjs
```

### 2. Start the Server

```bash
cd <vibe-reading-repo>/viewer && PORT=3460 npx tsx server.ts <target-project-root>
```

### 3. Open the Browser

```bash
# macOS
open http://localhost:3460

# Linux
xdg-open http://localhost:3460

# Or tell the user to open http://localhost:3460 manually
```

## What the User Sees

- **Activity bar** (far left): Toggle file explorer and search
- **File tree** (left sidebar): Collapsible directory tree, auto-expands to current file
- **Tab bar** (top): Multi-file tabs, click to switch, X to close
- **Source code** (center): Monaco editor with syntax highlighting
- **Cards sidebar** (right): Four tabs — Concept, Flow, History, Jump
- **Command palette** (Ctrl+P): Searchable overlay to quickly open any file
- **Click card** → corresponding code lines highlighted in the editor
- **Click jump card** → navigates to target file
- **Expand card** → description paragraph + metadata chips

## Notes

- The server loads all `.vibe-reading/files/*.json` and serves them inline
- Source files are served from the project root via `/api/source` endpoint
- Close the browser tab and Ctrl+C the server when done
- The server is read-only — it never modifies any files
