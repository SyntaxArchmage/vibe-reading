import { createRequire } from "module";
import * as path from "path";
import type { DataEntity } from "../types.js";

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

interface ImportTarget {
  source: string;
  names: string[];
  line: number;
}

export async function extractJumps(
  filePath: string,
  content: string,
  allFiles: string[]
): Promise<DataEntity[]> {
  await ensureInit();

  const ext = path.extname(filePath).toLowerCase();
  const language = await getLanguage(ext);
  if (!language) return [];

  const parser = new TreeSitter.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(content);

  const entities: DataEntity[] = [];
  const imports = collectImportTargets(tree.rootNode, ext);

  for (const imp of imports) {
    const resolvedFile = resolveImport(imp.source, filePath, allFiles, ext);
    if (!resolvedFile || resolvedFile === filePath) continue;

    const reason = imp.names.length > 0
      ? `Uses ${imp.names.join(", ")} from ${resolvedFile}`
      : `Imports from ${resolvedFile}`;

    entities.push({
      anchor: {
        file: filePath,
        start_line: imp.line,
        start_col: 0,
        end_line: imp.line,
        end_col: 0,
      },
      type: "jump",
      summary: `Jump → ${resolvedFile}`,
      detail: {
        kind: "import_jump",
        target_file: resolvedFile,
        names: imp.names,
        reason,
      },
    });
  }

  parser.delete();
  tree.delete();

  return entities;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectImportTargets(rootNode: any, ext: string): ImportTarget[] {
  const targets: ImportTarget[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (ext === ".py") {
      if (node.type === "import_from_statement") {
        const moduleNode = node.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "dotted_name" || c.type === "relative_import"
        );
        const source = moduleNode?.text ?? "";
        if (source.startsWith(".")) {
          const names: string[] = [];
          for (const child of node.children) {
            if (child.type === "dotted_name" && child !== moduleNode) {
              names.push(child.text);
            }
          }
          targets.push({ source, names, line: node.startPosition.row + 1 });
        }
        return;
      }
    } else {
      if (node.type === "import_statement" || node.type === "import_declaration") {
        const sourceNode = node.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "string" || c.type === "string_literal"
        );
        const source = sourceNode?.text?.replace(/['"]/g, "") ?? "";
        if (source.startsWith(".")) {
          const names: string[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          function collectNames(n: any) {
            if (n.type === "identifier" || n.type === "type_identifier") {
              names.push(n.text);
            }
            if (n.type === "import_specifier") {
              const id = n.children.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) => c.type === "identifier"
              );
              if (id) names.push(id.text);
              return;
            }
            for (const child of n.children) {
              collectNames(child);
            }
          }
          collectNames(node);
          targets.push({ source, names, line: node.startPosition.row + 1 });
        }
        return;
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(rootNode);
  return targets;
}

function resolveImport(
  source: string,
  currentFile: string,
  allFiles: string[],
  ext: string
): string | null {
  const currentDir = path.dirname(currentFile);
  const resolved = path.normalize(path.join(currentDir, source));

  const candidates = [
    resolved,
    resolved + ext,
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".js",
    resolved + ".jsx",
    resolved + ".py",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "__init__.py"),
  ];

  for (const c of candidates) {
    const normalized = path.normalize(c);
    if (allFiles.includes(normalized)) return normalized;
  }

  return null;
}
