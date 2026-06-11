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

const INTERESTING_NODE_TYPES: Record<string, Set<string>> = {
  default: new Set([
    "function_declaration",
    "function_definition",
    "method_definition",
    "method_declaration",
    "class_declaration",
    "class_definition",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "struct_declaration",
    "impl_item",
    "trait_definition",
    "module_definition",
    "decorated_definition",
  ]),
  python: new Set([
    "function_definition",
    "class_definition",
    "decorated_definition",
  ]),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNodeName(node: any): string | null {
  for (const child of node.children) {
    if (
      child.type === "identifier" ||
      child.type === "property_identifier" ||
      child.type === "type_identifier" ||
      child.type === "name"
    ) {
      return child.text;
    }
  }
  return null;
}

function getNodeKind(nodeType: string): string {
  if (nodeType.includes("function") || nodeType.includes("method")) return "function";
  if (nodeType.includes("class")) return "class";
  if (nodeType.includes("interface")) return "interface";
  if (nodeType.includes("type_alias")) return "type";
  if (nodeType.includes("enum")) return "enum";
  if (nodeType.includes("struct")) return "struct";
  if (nodeType.includes("impl")) return "impl";
  if (nodeType.includes("trait")) return "trait";
  if (nodeType.includes("module")) return "module";
  if (nodeType.includes("decorated")) return "decorated";
  return nodeType;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectInterestingNodes(node: any, interestingTypes: Set<string>, results: any[]) {
  if (interestingTypes.has(node.type)) {
    results.push(node);
    if (node.type === "decorated_definition") return;
  }
  for (const child of node.children) {
    collectInterestingNodes(child, interestingTypes, results);
  }
}

export async function extractConcepts(
  filePath: string,
  content: string
): Promise<DataEntity[]> {
  await ensureInit();

  const ext = path.extname(filePath).toLowerCase();
  const language = await getLanguage(ext);
  if (!language) {
    return [];
  }

  const parser = new TreeSitter.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(content);

  const langKey = ext === ".py" ? "python" : "default";
  const interestingTypes = INTERESTING_NODE_TYPES[langKey] ?? INTERESTING_NODE_TYPES.default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: any[] = [];
  collectInterestingNodes(tree.rootNode, interestingTypes, nodes);

  const entities: DataEntity[] = [];

  for (const node of nodes) {
    let targetNode = node;
    if (node.type === "decorated_definition") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inner = node.children.find((c: any) =>
        c.type === "function_definition" || c.type === "class_definition"
      );
      if (inner) targetNode = inner;
    }

    const name = getNodeName(targetNode);
    if (!name) continue;

    const kind = getNodeKind(targetNode.type);
    const bodyLines = node.endPosition.row - node.startPosition.row + 1;

    entities.push({
      anchor: {
        file: filePath,
        start_line: node.startPosition.row + 1,
        start_col: node.startPosition.column,
        end_line: node.endPosition.row + 1,
        end_col: node.endPosition.column,
      },
      type: "concept",
      summary: `${kind}: ${name}`,
      detail: {
        kind,
        name,
        body_lines: bodyLines,
        node_type: targetNode.type,
        description: `${kind} "${name}" spanning ${bodyLines} lines.`,
      },
    });
  }

  parser.delete();
  tree.delete();

  return entities;
}
