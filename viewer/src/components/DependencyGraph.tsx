import { useMemo, useState, useCallback } from "react";
import { matchesImportSource, isLocalSource } from "../utils/import-matching";

interface CallGraphFile {
  file: string;
  imports: Array<{ source: string; names: string[] }>;
  exports: string[];
}

interface Props {
  callGraph: { files: CallGraphFile[] };
  currentFile?: string | null;
  onFileSelect?: (file: string) => void;
}

interface Node {
  id: string;
  file: string;
  label: string;
  level: number;
  x: number;
  y: number;
  inDegree: number;
  outDegree: number;
}

interface Edge {
  from: string;
  to: string;
  names: string[];
}

function buildGraph(callGraph: { files: CallGraphFile[] }) {
  const files = callGraph.files.map((f) => f.file);
  const edges: Edge[] = [];

  for (const entry of callGraph.files) {
    for (const imp of entry.imports) {
      if (!isLocalSource(imp.source, callGraph.files)) continue;
      const target = callGraph.files.find((f) =>
        matchesImportSource(imp.source, f.file)
      );
      if (target && target.file !== entry.file) {
        edges.push({ from: entry.file, to: target.file, names: imp.names });
      }
    }
  }

  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  for (const f of files) {
    inDegree[f] = 0;
    outDegree[f] = 0;
  }
  for (const e of edges) {
    inDegree[e.to] = (inDegree[e.to] || 0) + 1;
    outDegree[e.from] = (outDegree[e.from] || 0) + 1;
  }

  const adjacency: Record<string, string[]> = {};
  for (const f of files) adjacency[f] = [];
  for (const e of edges) adjacency[e.from].push(e.to);

  // Assign levels via BFS from roots (files with no incoming local edges)
  const level: Record<string, number> = {};
  const roots = files.filter((f) => inDegree[f] === 0);
  if (roots.length === 0) {
    // Circular — pick files with min inDegree
    const minIn = Math.min(...files.map((f) => inDegree[f]));
    roots.push(...files.filter((f) => inDegree[f] === minIn));
  }

  const queue = roots.map((f) => ({ file: f, lvl: 0 }));
  const visited = new Set<string>();
  for (const r of roots) {
    level[r] = 0;
    visited.add(r);
  }

  while (queue.length > 0) {
    const { file, lvl } = queue.shift()!;
    for (const dep of adjacency[file]) {
      const newLvl = lvl + 1;
      if (!visited.has(dep) || newLvl > (level[dep] ?? 0)) {
        level[dep] = newLvl;
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push({ file: dep, lvl: newLvl });
        }
      }
    }
  }

  // Assign remaining unvisited files
  for (const f of files) {
    if (!(f in level)) level[f] = 0;
  }

  return { files, edges, level, inDegree, outDegree };
}

function layoutNodes(
  graph: ReturnType<typeof buildGraph>
): { nodes: Node[]; width: number; height: number } {
  const { files, level, inDegree, outDegree } = graph;
  const maxLevel = Math.max(...Object.values(level), 0);

  // Group files by level
  const levels: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const f of files) levels[level[f]].push(f);

  // Sort within each level by name
  for (const lvl of levels) lvl.sort();

  const nodeWidth = 140;
  const nodeHeight = 28;
  const hGap = 30;
  const vGap = 50;

  const maxPerLevel = Math.max(...levels.map((l) => l.length));
  const totalWidth = Math.max(maxPerLevel * (nodeWidth + hGap) + hGap, 400);
  const totalHeight = (maxLevel + 1) * (nodeHeight + vGap) + vGap;

  const nodes: Node[] = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const row = levels[lvl];
    const rowWidth = row.length * (nodeWidth + hGap) - hGap;
    const startX = (totalWidth - rowWidth) / 2;

    for (let i = 0; i < row.length; i++) {
      const file = row[i];
      const label = file.split("/").pop()?.replace(/\.py$/, "") || file;
      nodes.push({
        id: file,
        file,
        label,
        level: lvl,
        x: startX + i * (nodeWidth + hGap),
        y: vGap + lvl * (nodeHeight + vGap),
        inDegree: inDegree[file] || 0,
        outDegree: outDegree[file] || 0,
      });
    }
  }

  return { nodes, width: totalWidth, height: totalHeight };
}

function nodeColor(
  node: Node,
  currentFile: string | null | undefined,
  hoveredFile: string | null
): { fill: string; stroke: string; text: string } {
  if (node.file === currentFile) {
    return { fill: "#1a3a5a", stroke: "#007acc", text: "#fff" };
  }
  if (node.file === hoveredFile) {
    return { fill: "#2a3a2a", stroke: "#4ec9b0", text: "#fff" };
  }
  if (node.inDegree === 0) {
    return { fill: "#2a2020", stroke: "#ce9178", text: "#ce9178" };
  }
  return { fill: "#2a2d2e", stroke: "#555", text: "#ccc" };
}

export function DependencyGraph({ callGraph, currentFile, onFileSelect }: Props) {
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);

  const graph = useMemo(() => buildGraph(callGraph), [callGraph]);
  const { nodes, width, height } = useMemo(() => layoutNodes(graph), [graph]);
  const nodeMap = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const connectedFiles = useMemo(() => {
    if (!hoveredFile) return new Set<string>();
    const s = new Set<string>();
    s.add(hoveredFile);
    for (const e of graph.edges) {
      if (e.from === hoveredFile || e.to === hoveredFile) {
        s.add(e.from);
        s.add(e.to);
      }
    }
    return s;
  }, [hoveredFile, graph.edges]);

  const handleNodeClick = useCallback(
    (file: string) => onFileSelect?.(file),
    [onFileSelect]
  );

  if (nodes.length === 0) return null;

  const nodeW = 140;
  const nodeH = 28;
  const pad = 20;
  const svgW = width + pad * 2;
  const svgH = height + pad * 2;

  return (
    <div style={{ borderBottom: "1px solid #333", padding: "8px 0" }}>
      <div style={{
        fontSize: 10, color: "#888", textTransform: "uppercase",
        padding: "0 8px 6px", fontWeight: 600, display: "flex",
        alignItems: "center", gap: 8,
      }}>
        <span>Dependency Graph</span>
        <span style={{ color: "#666", fontWeight: 400 }}>
          {nodes.length} files · {graph.edges.length} edges
        </span>
      </div>
      <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: "block", margin: "0 auto" }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#555" />
            </marker>
            <marker
              id="arrow-hl"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#4ec9b0" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#007acc" />
            </marker>
          </defs>

          {/* Edges */}
          {graph.edges.map((e, i) => {
            const fromNode = nodeMap.get(e.from);
            const toNode = nodeMap.get(e.to);
            if (!fromNode || !toNode) return null;

            const x1 = pad + fromNode.x + nodeW / 2;
            const y1 = pad + fromNode.y + nodeH;
            const x2 = pad + toNode.x + nodeW / 2;
            const y2 = pad + toNode.y;

            const isHovered =
              hoveredFile === e.from || hoveredFile === e.to;
            const isActive =
              currentFile === e.from || currentFile === e.to;
            const isEdgeHovered =
              hoveredEdge?.from === e.from && hoveredEdge?.to === e.to;

            const midY = (y1 + y2) / 2;
            const dx = x2 - x1;
            const cp1x = x1 + dx * 0.1;
            const cp2x = x2 - dx * 0.1;

            const path = `M${x1},${y1} C${cp1x},${midY} ${cp2x},${midY} ${x2},${y2}`;

            let stroke = "#333";
            let opacity = 0.4;
            let marker = "url(#arrow)";
            let strokeWidth = 1;

            if (isEdgeHovered) {
              stroke = "#4ec9b0";
              opacity = 1;
              marker = "url(#arrow-hl)";
              strokeWidth = 2;
            } else if (isActive) {
              stroke = "#007acc";
              opacity = 0.7;
              marker = "url(#arrow-active)";
              strokeWidth = 1.5;
            } else if (isHovered) {
              stroke = "#4ec9b0";
              opacity = 0.6;
              marker = "url(#arrow-hl)";
            } else if (hoveredFile && !connectedFiles.has(e.from) && !connectedFiles.has(e.to)) {
              opacity = 0.15;
            }

            return (
              <g key={`edge-${i}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  markerEnd={marker}
                  style={{ transition: "opacity 0.15s, stroke 0.15s" }}
                />
                {/* Invisible wider path for hover target */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  onMouseEnter={() => setHoveredEdge(e)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  style={{ cursor: "default" }}
                />
                {isEdgeHovered && e.names.length > 0 && (
                  <text
                    x={(x1 + x2) / 2}
                    y={midY - 6}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#4ec9b0"
                    fontFamily="monospace"
                  >
                    {e.names.slice(0, 3).join(", ")}
                    {e.names.length > 3 ? ` +${e.names.length - 3}` : ""}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = nodeColor(node, currentFile, hoveredFile);
            const dimmed =
              hoveredFile && !connectedFiles.has(node.file);

            return (
              <g
                key={node.id}
                transform={`translate(${pad + node.x}, ${pad + node.y})`}
                onClick={() => handleNodeClick(node.file)}
                onMouseEnter={() => setHoveredFile(node.file)}
                onMouseLeave={() => setHoveredFile(null)}
                style={{
                  cursor: "pointer",
                  opacity: dimmed ? 0.25 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <rect
                  width={nodeW}
                  height={nodeH}
                  rx={4}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={node.file === currentFile ? 2 : 1}
                />
                <text
                  x={nodeW / 2}
                  y={nodeH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontFamily="monospace"
                  fill={colors.text}
                  style={{ pointerEvents: "none" }}
                >
                  {node.label.length > 16
                    ? node.label.slice(0, 15) + "…"
                    : node.label}
                </text>
                {(node.inDegree > 0 || node.outDegree > 0) && (
                  <text
                    x={nodeW - 4}
                    y={8}
                    textAnchor="end"
                    fontSize={8}
                    fill="#666"
                    style={{ pointerEvents: "none" }}
                  >
                    {node.inDegree}↓{node.outDegree}↑
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
