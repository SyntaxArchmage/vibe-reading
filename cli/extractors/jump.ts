import * as path from "path";
import type { DataEntity } from "../types.js";
import { parseFile, cleanupParser } from "./parser.js";

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
  const parsed = await parseFile(filePath, content);
  if (!parsed) return [];

  const ext = path.extname(filePath).toLowerCase();
  const entities: DataEntity[] = [];
  const imports = collectImportTargets(parsed.rootNode, ext);

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

  cleanupParser(parsed);

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
        if (source) {
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
          targets.push({ source, names, line: node.startPosition.row + 1 });
        }
        return;
      }
      if (node.type === "import_statement") {
        for (const child of node.children) {
          if (child.type === "dotted_name") {
            targets.push({ source: child.text, names: [], line: node.startPosition.row + 1 });
          } else if (child.type === "aliased_import") {
            const nameNode = child.children.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) => c.type === "dotted_name"
            );
            if (nameNode) {
              targets.push({ source: nameNode.text, names: [], line: node.startPosition.row + 1 });
            }
          }
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

function isLocalImport(source: string, allFiles: string[]): boolean {
  if (source.startsWith(".")) return true;
  const top = source.split(".")[0];
  return allFiles.some(
    (f) => f.startsWith(`${top}/`) || f === `${top}.py` || f.endsWith(`/${top}.py`)
  );
}

function resolvePythonModule(source: string, allFiles: string[]): string | null {
  const modulePath = source.replace(/\./g, "/");
  const candidates = [
    `${modulePath}.py`,
    path.join(modulePath, "__init__.py"),
  ];
  for (const c of candidates) {
    const normalized = path.normalize(c);
    if (allFiles.includes(normalized)) return normalized;
  }
  return null;
}

function resolveImport(
  source: string,
  currentFile: string,
  allFiles: string[],
  ext: string
): string | null {
  if (ext === ".py" && !source.startsWith(".")) {
    if (!isLocalImport(source, allFiles)) return null;
    return resolvePythonModule(source, allFiles);
  }

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
