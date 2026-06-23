import * as path from "path";
import type { DataEntity } from "../types.js";
import { parseFile, cleanupParser } from "./parser.js";

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
  if (ext === ".py") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const child of rootNode.children) {
      if (child.type === "expression_statement") {
        const assign = child.children.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "assignment"
        );
        if (!assign) continue;
        const lhs = assign.children[0];
        if (lhs?.type === "identifier" && lhs.text === "__all__") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          function collectStrings(n: any) {
            if (n.type === "string") {
              const content = n.children?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) => c.type === "string_content"
              );
              const val = content?.text || n.text.replace(/^["']|["']$/g, "");
              if (val) exports.push(val);
              return;
            }
            for (const c of n.children || []) collectStrings(c);
          }
          collectStrings(assign);
        }
      }
    }
    return exports;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (node.type === "export_statement") {
      for (const child of node.children) {
        if (child.type === "export_clause") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const spec of child.children) {
            if (spec.type === "export_specifier") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const id = spec.children.find((c: any) => c.type === "identifier");
              if (id) exports.push(id.text);
            }
          }
        } else if (
          child.type === "function_declaration" ||
          child.type === "class_declaration" ||
          child.type === "type_alias_declaration" ||
          child.type === "interface_declaration" ||
          child.type === "enum_declaration" ||
          child.type === "lexical_declaration"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const id = child.children.find((c: any) =>
            c.type === "identifier" || c.type === "type_identifier"
          );
          if (id) exports.push(id.text);
          if (child.type === "lexical_declaration") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const decl of child.children) {
              if (decl.type === "variable_declarator") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const vid = decl.children.find((c: any) => c.type === "identifier");
                if (vid) exports.push(vid.text);
              }
            }
          }
        }
      }
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
  content: string,
  allFiles: string[] = []
): Promise<FlowData> {
  const parsed = await parseFile(filePath, content);
  if (!parsed) return { entities: [], imports: [], calls: [], exports: [] };

  const ext = path.extname(filePath).toLowerCase();
  const imports = extractImports(parsed.rootNode, ext);
  const calls = extractCalls(parsed.rootNode);
  const fileExports = extractExports(parsed.rootNode, ext);

  const entities: DataEntity[] = [];

  // Create import-group flow entities
  if (imports.length > 0) {
    const firstImport = imports[0];
    const lastImport = imports[imports.length - 1];
    const sources = imports.map((i) => i.source).filter(Boolean);
    const isLocal = (s: string) => {
      if (s.startsWith(".") || s.startsWith("/")) return true;
      if (ext === ".py" && allFiles.length > 0) {
        const top = s.split(".")[0];
        return allFiles.some(f => f.startsWith(`${top}/`) || f === `${top}.py` || f.endsWith(`/${top}.py`));
      }
      return false;
    };
    const localSources = sources.filter(isLocal);
    const externalSources = sources.filter(s => !isLocal(s));

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

  cleanupParser(parsed);

  const simplifiedCalls = calls.map((c) => ({
    callee: c.callee,
    inFunction: c.inFunction,
  }));

  return { entities, imports, calls: simplifiedCalls, exports: fileExports };
}
