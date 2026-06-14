import { createRequire } from "module";
import * as path from "path";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeSitter: any = _require("web-tree-sitter");

let initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languageCache = new Map<string, any>();

const NODE_MODULES = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "node_modules"
);

// Only languages with ABI-compatible WASM (dedicated npm packages, not tree-sitter-wasms)
const EXT_TO_WASM: Record<string, string> = {
  ".ts": "tree-sitter-typescript/tree-sitter-typescript.wasm",
  ".tsx": "tree-sitter-typescript/tree-sitter-tsx.wasm",
  ".js": "tree-sitter-javascript/tree-sitter-javascript.wasm",
  ".jsx": "tree-sitter-javascript/tree-sitter-javascript.wasm",
  ".py": "tree-sitter-python/tree-sitter-python.wasm",
};

async function ensureInit() {
  if (!initialized) {
    await TreeSitter.Parser.init();
    initialized = true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanguage(ext: string): Promise<any> {
  const wasmRelPath = EXT_TO_WASM[ext];
  if (!wasmRelPath) return null;

  if (languageCache.has(ext)) {
    return languageCache.get(ext)!;
  }

  const wasmPath = path.join(NODE_MODULES, wasmRelPath);
  try {
    const lang = await TreeSitter.Language.load(wasmPath);
    languageCache.set(ext, lang);
    return lang;
  } catch {
    return null;
  }
}

export interface ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rootNode: any;
}

export async function parseFile(filePath: string, content: string): Promise<ParseResult | null> {
  await ensureInit();

  const ext = path.extname(filePath).toLowerCase();
  const language = await getLanguage(ext);
  if (!language) return null;

  const parser = new TreeSitter.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(content);
  return { tree, parser, rootNode: tree.rootNode };
}

export function cleanupParser(result: ParseResult): void {
  result.parser.delete();
  result.tree.delete();
}

export { EXT_TO_WASM };
