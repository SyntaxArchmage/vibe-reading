import * as path from "path";
import type { DataEntity } from "../types.js";
import { parseFile, cleanupParser } from "./parser.js";

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
    "type_declaration",
  ]),
  python: new Set([
    "function_definition",
    "class_definition",
    "decorated_definition",
  ]),
};

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
  if (nodeType === "type_declaration") return "type";
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
  const parsed = await parseFile(filePath, content);
  if (!parsed) return [];

  const ext = path.extname(filePath).toLowerCase();
  const langKey = ext === ".py" ? "python" : "default";
  const interestingTypes = INTERESTING_NODE_TYPES[langKey] ?? INTERESTING_NODE_TYPES.default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: any[] = [];
  collectInterestingNodes(parsed.rootNode, interestingTypes, nodes);

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

  cleanupParser(parsed);

  return entities;
}
