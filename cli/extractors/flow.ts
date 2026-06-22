import { createRequire } from "module";
import * as path from "path";
import * as fs from "fs";
import type { FileAnalysis } from "../types.js";

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
  ".py": "tree-sitter-python/tree-sitter-python.wasm",
  ".ts": "tree-sitter-typescript/tree-sitter-typescript.wasm",
  ".tsx": "tree-sitter-typescript/tree-sitter-tsx.wasm",
  ".js": "tree-sitter-javascript/tree-sitter-javascript.wasm",
  ".jsx": "tree-sitter-javascript/tree-sitter-javascript.wasm",
};

export interface FlowNode {
  id: string;
  file: string;
  class?: string;
  name: string;
  kind: "function" | "class" | "method";
  line: number;
  end_line: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  type: "call" | "instantiate" | "import";
  line: number;
}

export interface FlowSegment {
  name: string;
  description: string;
  entry: string;
  path: string[];
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  segments: FlowSegment[];
}

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
  if (languageCache.has(ext)) return languageCache.get(ext)!;
  const wasmPath = path.join(NODE_MODULES, wasmRelPath);
  try {
    const lang = await TreeSitter.Language.load(wasmPath);
    languageCache.set(ext, lang);
    return lang;
  } catch {
    return null;
  }
}

interface ScopeInfo {
  file: string;
  class?: string;
  function: string;
  startLine: number;
  endLine: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectScopes(node: any, file: string, parentClass?: string): ScopeInfo[] {
  const scopes: ScopeInfo[] = [];

  if (node.type === "class_definition") {
    const nameNode = node.children.find((c: { type: string }) => c.type === "identifier");
    const className = nameNode?.text;
    if (className) {
      for (const child of node.children) {
        if (child.type === "block") {
          for (const blockChild of child.children) {
            const fn = blockChild.type === "decorated_definition"
              ? blockChild.children.find((c: { type: string }) => c.type === "function_definition")
              : blockChild.type === "function_definition" ? blockChild : null;
            if (fn) {
              const fnName = fn.children.find((c: { type: string }) => c.type === "identifier")?.text;
              if (fnName) {
                scopes.push({
                  file,
                  class: className,
                  function: fnName,
                  startLine: fn.startPosition.row + 1,
                  endLine: fn.endPosition.row + 1,
                });
              }
            }
          }
        }
      }
    }
  } else if (node.type === "function_definition" || node.type === "decorated_definition") {
    const fn = node.type === "decorated_definition"
      ? node.children.find((c: { type: string }) => c.type === "function_definition")
      : node;
    if (fn) {
      const fnName = fn.children.find((c: { type: string }) => c.type === "identifier")?.text;
      if (fnName && !parentClass) {
        scopes.push({
          file,
          function: fnName,
          startLine: fn.startPosition.row + 1,
          endLine: fn.endPosition.row + 1,
        });
      }
    }
  }

  for (const child of node.children) {
    if (child.type === "class_definition") {
      scopes.push(...collectScopes(child, file));
    } else if (!["class_definition"].includes(node.type) &&
               (child.type === "function_definition" || child.type === "decorated_definition")) {
      scopes.push(...collectScopes(child, file));
    }
  }

  return scopes;
}

interface RawCall {
  line: number;
  target: string;
  receiver?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectCalls(node: any): RawCall[] {
  const calls: RawCall[] = [];

  if (node.type === "call") {
    const fnNode = node.children[0];
    if (fnNode) {
      if (fnNode.type === "attribute") {
        const obj = fnNode.children[0]?.text;
        const attr = fnNode.children.find((c: { type: string }) => c.type === "identifier")?.text;
        if (obj && attr) {
          calls.push({ line: node.startPosition.row + 1, target: attr, receiver: obj });
        }
      } else if (fnNode.type === "identifier") {
        calls.push({ line: node.startPosition.row + 1, target: fnNode.text });
      }
    }
  }

  for (const child of node.children) {
    calls.push(...collectCalls(child));
  }

  return calls;
}

function makeNodeId(file: string, className: string | undefined, funcName: string): string {
  const fileStem = file.replace(/\//g, ".");
  if (className) return `${fileStem}::${className}::${funcName}`;
  return `${fileStem}::${funcName}`;
}

export async function extractFlow(projectRoot: string): Promise<FlowData> {
  await ensureInit();

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) return { nodes: [], edges: [], segments: [] };

  const jsonFiles = fs.readdirSync(filesDir).filter(f => f.endsWith(".json"));
  const allScopes: ScopeInfo[] = [];
  const allNodes: FlowNode[] = [];
  const nodeIdSet = new Set<string>();

  for (const jsonFile of jsonFiles) {
    const analysis: FileAnalysis = JSON.parse(fs.readFileSync(path.join(filesDir, jsonFile), "utf-8"));
    const relPath = analysis.file;
    const ext = path.extname(relPath).toLowerCase();
    if (!EXT_TO_WASM[ext]) continue;

    const srcPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(srcPath)) continue;

    const content = fs.readFileSync(srcPath, "utf-8");
    const language = await getLanguage(ext);
    if (!language) continue;

    const parser = new TreeSitter.Parser();
    parser.setLanguage(language);
    const tree = parser.parse(content);

    const scopes = collectScopes(tree.rootNode, relPath);
    allScopes.push(...scopes);

    for (const scope of scopes) {
      const id = makeNodeId(scope.file, scope.class, scope.function);
      if (!nodeIdSet.has(id)) {
        nodeIdSet.add(id);
        allNodes.push({
          id,
          file: scope.file,
          class: scope.class,
          name: scope.function,
          kind: scope.class ? "method" : "function",
          line: scope.startLine,
          end_line: scope.endLine,
        });
      }
    }

    parser.delete();
    tree.delete();
  }

  // Build lookup maps for call resolution
  const methodsByName = new Map<string, FlowNode[]>();
  const funcsByName = new Map<string, FlowNode[]>();
  const classesByName = new Set<string>();

  for (const node of allNodes) {
    if (node.class) {
      classesByName.add(node.class);
      const key = node.name;
      const arr = methodsByName.get(key) || [];
      arr.push(node);
      methodsByName.set(key, arr);
    } else {
      const arr = funcsByName.get(node.name) || [];
      arr.push(node);
      funcsByName.set(node.name, arr);
    }
  }

  // Extract calls from each scope
  const edges: FlowEdge[] = [];
  const edgeSet = new Set<string>();

  for (const jsonFile of jsonFiles) {
    const analysis: FileAnalysis = JSON.parse(fs.readFileSync(path.join(filesDir, jsonFile), "utf-8"));
    const relPath = analysis.file;
    const ext = path.extname(relPath).toLowerCase();
    if (!EXT_TO_WASM[ext]) continue;

    const srcPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(srcPath)) continue;

    const content = fs.readFileSync(srcPath, "utf-8");
    const language = await getLanguage(ext);
    if (!language) continue;

    const parser = new TreeSitter.Parser();
    parser.setLanguage(language);
    const tree = parser.parse(content);

    const fileScopes = allScopes.filter(s => s.file === relPath);

    for (const scope of fileScopes) {
      const callerId = makeNodeId(scope.file, scope.class, scope.function);

      // Walk function body to find calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findNodeAtLine(root: any, startLine: number, endLine: number): any {
        if (root.startPosition.row + 1 === startLine && root.endPosition.row + 1 === endLine) {
          return root;
        }
        for (const child of root.children) {
          const found = findNodeAtLine(child, startLine, endLine);
          if (found) return found;
        }
        return null;
      }

      const scopeNode = findNodeAtLine(tree.rootNode, scope.startLine, scope.endLine);
      if (!scopeNode) continue;

      const calls = collectCalls(scopeNode);

      for (const call of calls) {
        let targetId: string | null = null;

        if (call.receiver === "self" && scope.class) {
          // self.method() → same class
          const candidates = methodsByName.get(call.target);
          const match = candidates?.find(n => n.class === scope.class);
          if (match) targetId = match.id;
        } else if (call.receiver && classesByName.has(call.receiver)) {
          // ClassName() → instantiation or ClassName.method()
          const candidates = methodsByName.get(call.target);
          const match = candidates?.find(n => n.class === call.receiver);
          if (match) targetId = match.id;
        } else if (!call.receiver) {
          // bare function call
          const candidates = funcsByName.get(call.target);
          if (candidates && candidates.length > 0) {
            targetId = candidates[0].id;
          }
          // Also check if it's a class instantiation
          if (!targetId && classesByName.has(call.target)) {
            const initCandidates = methodsByName.get("__init__");
            const match = initCandidates?.find(n => n.class === call.target);
            if (match) targetId = match.id;
          }
        } else if (call.receiver) {
          // some_var.method() — try best-effort resolution
          const candidates = methodsByName.get(call.target);
          if (candidates && candidates.length === 1) {
            targetId = candidates[0].id;
          }
        }

        if (targetId && targetId !== callerId) {
          const edgeKey = `${callerId}->${targetId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            const type = call.target === "__init__" || classesByName.has(call.target) ? "instantiate" : "call";
            edges.push({ from: callerId, to: targetId, type, line: call.line });
          }
        }
      }
    }

    parser.delete();
    tree.delete();
  }

  // Auto-segment detection
  const incomingMap = new Map<string, Set<string>>();
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const arr = adjacency.get(edge.from) || [];
    arr.push(edge.to);
    adjacency.set(edge.from, arr);

    const inc = incomingMap.get(edge.to) || new Set();
    inc.add(edge.from);
    incomingMap.set(edge.to, inc);
  }

  function tracePath(startId: string, maxDepth = 20): string[] {
    const result: string[] = [startId];
    const visited = new Set<string>([startId]);
    let current = startId;
    for (let i = 0; i < maxDepth; i++) {
      const next = adjacency.get(current);
      if (!next || next.length === 0) break;
      // Prefer unvisited nodes, then pick the first
      const nextNode = next.find(n => !visited.has(n));
      if (!nextNode) break;
      visited.add(nextNode);
      result.push(nextNode);
      current = nextNode;
    }
    return result;
  }

  // BFS-based trace that follows ALL outgoing edges (breadth-first)
  function traceBFS(startId: string, maxNodes = 20): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [startId];
    visited.add(startId);
    while (queue.length > 0 && result.length < maxNodes) {
      const cur = queue.shift()!;
      result.push(cur);
      for (const next of adjacency.get(cur) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return result;
  }

  const segments: FlowSegment[] = [];
  const usedInSegment = new Set<string>();

  // Strategy 1: Entry points (no incoming edges) — typically __init__ or main
  const entryPoints = allNodes.filter(n => !incomingMap.has(n.id) || (incomingMap.get(n.id)?.size || 0) === 0);

  for (const entry of entryPoints) {
    const path = tracePath(entry.id);
    if (path.length >= 3) {
      const nameHint = entry.name === "main" ? "Main Execution" :
                       entry.name === "__init__" ? `${entry.class || entry.file} Initialization` :
                       `${entry.class ? entry.class + "." : ""}${entry.name}`;
      segments.push({ name: nameHint, description: `Flow starting from ${nameHint}`, entry: entry.id, path });
      path.forEach(p => usedInSegment.add(p));
    }
  }

  // Strategy 2: Important methods — high fan-out or known orchestration names
  const IMPORTANT_NAMES = new Set(["step", "generate", "run", "forward", "schedule", "execute", "process", "handle", "serve"]);
  const importantNodes = allNodes
    .filter(n => IMPORTANT_NAMES.has(n.name) && !usedInSegment.has(n.id))
    .sort((a, b) => (adjacency.get(b.id)?.length || 0) - (adjacency.get(a.id)?.length || 0));

  for (const node of importantNodes.slice(0, 5)) {
    const path = traceBFS(node.id, 15);
    if (path.length >= 3) {
      const label = node.class ? `${node.class}.${node.name}` : node.name;
      segments.push({
        name: `${label} Flow`,
        description: `Execution flow of ${label}`,
        entry: node.id,
        path,
      });
      path.forEach(p => usedInSegment.add(p));
    }
  }

  // Strategy 3: High fan-out nodes not yet covered
  const highFanOut = allNodes
    .filter(n => (adjacency.get(n.id)?.length || 0) >= 3 && !usedInSegment.has(n.id))
    .sort((a, b) => (adjacency.get(b.id)?.length || 0) - (adjacency.get(a.id)?.length || 0));

  for (const node of highFanOut.slice(0, 3)) {
    const path = traceBFS(node.id, 12);
    if (path.length >= 3) {
      const label = node.class ? `${node.class}.${node.name}` : node.name;
      segments.push({
        name: `${label} Chain`,
        description: `Call chain from ${label}`,
        entry: node.id,
        path,
      });
    }
  }

  return { nodes: allNodes, edges, segments };
}
