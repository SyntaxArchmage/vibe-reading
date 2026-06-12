# Vibe Reading

AI-assisted code reading tool. Source code first, knowledge cards in a sidebar.

Analyze a codebase with Tree-sitter, enrich with LLM-generated explanations, then browse code with concept cards that explain what each function, class, and interface does.

## Install

### Default Install (Use the Skills)

```bash
git clone git@github.com:SyntaxArchmage/vibe-reading.git
cd vibe-reading/cli && npm install
cd ../viewer && npm install && node build.mjs
```

Copy skills to your Cursor config:

```bash
cp -r skills/learn-code ~/.cursor/skills/
cp -r skills/teach-me ~/.cursor/skills/
```

Then use `/learn-code` on any project and `/teach-me` to view.

### Dev Install (For Contributing)

```bash
git clone git@github.com:SyntaxArchmage/vibe-reading.git
cd vibe-reading
bash scripts/dev-install.sh
```

This symlinks skills to `~/.cursor/skills/` so edits are immediately visible to agents.

## Usage

### 1. Analyze a Codebase

```bash
npx tsx cli/analyze.ts /path/to/your/project
```

### 2. Enrich with Agent

Use the `/learn-code` Cursor skill on your target project. The agent reads each source file and writes concept explanations.

### 3. View

```bash
cd viewer && PORT=3460 npx tsx server.ts /path/to/your/project
```

Open http://localhost:3460 to browse code with knowledge cards.

### 4. Verify

```bash
npx tsx cli/harness.ts /path/to/your/project
```

## Testing

```bash
# CLI tests (48 assertions)
npx tsx test/test.ts

# E2E tests (19 Playwright tests)
playwright install chromium
PORT=3461 npx tsx viewer/server.ts test/fixture &
python3 test/e2e/test_viewer.py

# Larger test data (nano-vllm, 21 files)
bash scripts/setup-test-data.sh
npx tsx cli/analyze.ts test/data/nano-vllm
npx tsx cli/harness.ts test/data/nano-vllm
```

## Project Structure

```
cli/            AST extraction + enrichment pipeline
viewer/         Standalone web viewer (React + Monaco)
skills/         Cursor agent skills (/learn-code, /teach-me)
scripts/        Dev tooling (dev-install, test data setup)
test/           Tests + fixtures
```

## Acknowledgements

- [nano-vllm](https://github.com/GeeeekExplorer/nano-vllm) by GeeeekExplorer — used as test data for the analysis pipeline
- [Tree-sitter](https://tree-sitter.github.io/) — AST parsing
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — code viewer
