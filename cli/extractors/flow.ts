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

interface ImportInfo {
  source: string;
  names: string[];
  startLine: number;
  endLine: number;
}

interface CallInfo {
  callee: string;
  startLine: number;
  endLine: number;
  inFunction: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImports(rootNode: any, ext: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (ext === ".py") {
      if (node.type === "import_statement" || node.type === "import_from_statement") {
        const moduleNode = node.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "dotted_name" || c.type === "relative_import"
        );
        const source = moduleNode?.text ?? "";
        const names: string[] = [];
        for (const child of node.children) {
          if (child.type === "dotted_name" && child !== moduleNode) {
            names.push(child.text);
          } else if (child.type === "aliased_import") {
            const nameNode = child.children.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) => c.type === "dotted_name" || c.type === "identifier"
            );
            if (nameNode) names.push(nameNode.text);
          }
        }
        imports.push({
          source,
          names,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        });
        return;
      }
    } else {
      if (node.type === "import_statement" || node.type === "import_declaration") {
        const sourceNode = node.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "string" || c.type === "string_literal"
        );
        const source = sourceNode?.text?.replace(/['"]/g, "") ?? "";
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
        imports.push({
          source,
          names,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        });
        return;
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(rootNode);
  return imports;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCalls(rootNode: any): CallInfo[] {
  const calls: CallInfo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findEnclosingFunction(node: any): string | null {
    let parent = node.parent;
    while (parent) {
      if (
        parent.type === "function_declaration" ||
        parent.type === "function_definition" ||
        parent.type === "method_definition" ||
        parent.type === "method_declaration" ||
        parent.type === "arrow_function"
      ) {
        const nameNode = parent.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) =>
            c.type === "identifier" ||
            c.type === "property_identifier" ||
            c.type === "name"
        );
        return nameNode?.text ?? null;
      }
      parent = parent.parent;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (node.type === "call_expression") {
      const fn = node.children[0];
      let callee = "";
      if (fn.type === "member_expression" || fn.type === "attribute") {
        callee = fn.text;
      } else if (fn.type === "identifier" || fn.type === "name") {
        callee = fn.text;
      }
      if (callee) {
        calls.push({
          callee,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          inFunction: findEnclosingFunction(node),
        });
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(rootNode);
  return calls;
}

export interface FlowData {
  entities: DataEntity[];
  imports: ImportInfo[];
  calls: { callee: string; inFunction: string | null }[];
  exports: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractExports(rootNode: any, ext: string): string[] {
  const exports: string[] = [];
  if (ext === ".py") return exports;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (node.type === "export_statement") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function collectIds(n: any) {
        if (n.type === "identifier" || n.type === "type_identifier") {
          exports.push(n.text);
        }
        for (const child of n.children) {
          collectIds(child);
        }
      }
      collectIds(node);
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(rootNode);
  return [...new Set(exports)];
}

export async function extractFlow(
  filePath: string,
  content: string
): Promise<FlowData> {
  await ensureInit();

  const ext = path.extname(filePath).toLowerCase();
  const language = await getLanguage(ext);
  if (!language) {
    return { entities: [], imports: [], calls: [], exports: [] };
  }

  const parser = new TreeSitter.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(content);

  const imports = extractImports(tree.rootNode, ext);
  const calls = extractCalls(tree.rootNode);
  const fileExports = extractExports(tree.rootNode, ext);

  const entities: DataEntity[] = [];

  // Create import-group flow entities
  if (imports.length > 0) {
    const firstImport = imports[0];
    const lastImport = imports[imports.length - 1];
    const sources = imports.map((i) => i.source).filter(Boolean);
    const localSources = sources.filter(
      (s) => s.startsWith(".") || s.startsWith("/")
    );
    const externalSources = sources.filter(
      (s) => !s.startsWith(".") && !s.startsWith("/")
    );

    entities.push({
      anchor: {
        file: filePath,
        start_line: firstImport.startLine,
        start_col: 0,
        end_line: lastImport.endLine,
        end_col: 0,
      },
      type: "flow",
      summary: `Imports: ${sources.length} modules (${localSources.length} local, ${externalSources.length} external)`,
      detail: {
        kind: "imports",
        local_deps: localSources,
        external_deps: externalSources,
        all_names: imports.flatMap((i) => i.names),
      },
    });
  }

  // Group calls by enclosing function
  const callsByFunc = new Map<string, Set<string>>();
  for (const call of calls) {
    const key = call.inFunction ?? "<module>";
    if (!callsByFunc.has(key)) callsByFunc.set(key, new Set());
    callsByFunc.get(key)!.add(call.callee);
  }

  // Create per-function call flow entities
  for (const [funcName, callees] of callsByFunc) {
    if (funcName === "<module>") continue;
    const funcCalls = calls.filter(
      (c) => c.inFunction === funcName
    );
    if (funcCalls.length === 0) continue;

    const minLine = Math.min(...funcCalls.map((c) => c.startLine));
    const maxLine = Math.max(...funcCalls.map((c) => c.endLine));
    const calleeList = [...callees].slice(0, 20);

    entities.push({
      anchor: {
        file: filePath,
        start_line: minLine,
        start_col: 0,
        end_line: maxLine,
        end_col: 0,
      },
      type: "flow",
      summary: `${funcName} calls: ${calleeList.join(", ")}`,
      detail: {
        kind: "calls",
        caller: funcName,
        callees: calleeList,
        call_count: funcCalls.length,
      },
    });
  }

  // Create export summary entity
  if (fileExports.length > 0) {
    const lines = content.split("\n");
    entities.push({
      anchor: {
        file: filePath,
        start_line: 1,
        start_col: 0,
        end_line: lines.length,
        end_col: 0,
      },
      type: "flow",
      summary: `Exports: ${fileExports.join(", ")}`,
      detail: {
        kind: "exports",
        names: fileExports,
      },
    });
  }

  parser.delete();
  tree.delete();

  const simplifiedCalls = calls.map((c) => ({
    callee: c.callee,
    inFunction: c.inFunction,
  }));

  return { entities, imports, calls: simplifiedCalls, exports: fileExports };
}
