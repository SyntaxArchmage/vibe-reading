import { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  group: string;
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

interface DirGroup {
  name: string;
  files: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

const NODE_W = 140;
const NODE_H = 28;
const H_GAP = 30;
const V_GAP = 50;
const GROUP_PAD = 12;

function getDir(file: string): string {
  const idx = file.lastIndexOf("/");
  return idx >= 0 ? file.slice(0, idx) : "(root)";
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

  const level: Record<string, number> = {};
  const roots = files.filter((f) => inDegree[f] === 0);
  if (roots.length === 0) {
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

  for (const f of files) {
    if (!(f in level)) level[f] = 0;
  }

  return { files, edges, level, inDegree, outDegree };
}

function layoutNodes(
  graph: ReturnType<typeof buildGraph>,
  grouped: boolean
): { nodes: Node[]; width: number; height: number; groups: DirGroup[] } {
  const { files, level, inDegree, outDegree } = graph;
  const maxLevel = Math.max(...Object.values(level), 0);

  if (!grouped) {
    const levels: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const f of files) levels[level[f]].push(f);
    for (const lvl of levels) lvl.sort();

    const maxPerLevel = Math.max(...levels.map((l) => l.length));
    const totalWidth = Math.max(maxPerLevel * (NODE_W + H_GAP) + H_GAP, 400);
    const totalHeight = (maxLevel + 1) * (NODE_H + V_GAP) + V_GAP;

    const nodes: Node[] = [];
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      const row = levels[lvl];
      const rowWidth = row.length * (NODE_W + H_GAP) - H_GAP;
      const startX = (totalWidth - rowWidth) / 2;

      for (let i = 0; i < row.length; i++) {
        const file = row[i];
        const label = file.split("/").pop()?.replace(/\.py$/, "") || file;
        nodes.push({
          id: file, file, label,
          group: getDir(file), level: lvl,
          x: startX + i * (NODE_W + H_GAP),
          y: V_GAP + lvl * (NODE_H + V_GAP),
          inDegree: inDegree[file] || 0,
          outDegree: outDegree[file] || 0,
        });
      }
    }

    return { nodes, width: totalWidth, height: totalHeight, groups: [] };
  }

  // Grouped layout: cluster by directory within each level
  const dirFiles: Record<string, string[]> = {};
  for (const f of files) {
    const d = getDir(f);
    (dirFiles[d] ??= []).push(f);
  }
  const dirNames = Object.keys(dirFiles).sort();

  // Assign x bands per directory
  const dirBandWidth: Record<string, number> = {};
  for (const d of dirNames) {
    const maxInLevel = Math.max(
      ...Array.from({ length: maxLevel + 1 }, (_, lvl) =>
        dirFiles[d].filter((f) => level[f] === lvl).length
      )
    );
    dirBandWidth[d] = Math.max(maxInLevel, 1) * (NODE_W + H_GAP) + GROUP_PAD * 2;
  }

  let totalWidth = H_GAP;
  const dirStartX: Record<string, number> = {};
  for (const d of dirNames) {
    dirStartX[d] = totalWidth;
    totalWidth += dirBandWidth[d] + H_GAP;
  }
  totalWidth = Math.max(totalWidth, 400);

  const totalHeight = (maxLevel + 1) * (NODE_H + V_GAP) + V_GAP + GROUP_PAD * 2;

  const nodes: Node[] = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    for (const d of dirNames) {
      const filesInGroup = dirFiles[d].filter((f) => level[f] === lvl).sort();
      const bandW = dirBandWidth[d];
      const rowWidth = filesInGroup.length * (NODE_W + H_GAP) - H_GAP;
      const startX = dirStartX[d] + (bandW - rowWidth) / 2;

      for (let i = 0; i < filesInGroup.length; i++) {
        const file = filesInGroup[i];
        const label = file.split("/").pop()?.replace(/\.py$/, "") || file;
        nodes.push({
          id: file, file, label,
          group: d, level: lvl,
          x: startX + i * (NODE_W + H_GAP),
          y: V_GAP + GROUP_PAD + lvl * (NODE_H + V_GAP),
          inDegree: inDegree[file] || 0,
          outDegree: outDegree[file] || 0,
        });
      }
    }
  }

  // Compute group bounding boxes
  const groups: DirGroup[] = dirNames.map((d) => {
    const groupNodes = nodes.filter((n) => n.group === d);
    if (groupNodes.length === 0) {
      return { name: d, files: dirFiles[d], x: dirStartX[d], y: V_GAP, w: dirBandWidth[d], h: totalHeight - V_GAP };
    }
    const minX = Math.min(...groupNodes.map((n) => n.x)) - GROUP_PAD;
    const maxX = Math.max(...groupNodes.map((n) => n.x + NODE_W)) + GROUP_PAD;
    const minY = Math.min(...groupNodes.map((n) => n.y)) - GROUP_PAD - 14;
    const maxY = Math.max(...groupNodes.map((n) => n.y + NODE_H)) + GROUP_PAD;
    return {
      name: d, files: dirFiles[d],
      x: minX, y: minY,
      w: maxX - minX, h: maxY - minY,
    };
  });

  return { nodes, width: totalWidth, height: totalHeight, groups };
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

const GROUP_COLORS = [
  { fill: "rgba(78,201,176,0.06)", stroke: "rgba(78,201,176,0.25)" },
  { fill: "rgba(0,122,204,0.06)", stroke: "rgba(0,122,204,0.25)" },
  { fill: "rgba(206,145,120,0.06)", stroke: "rgba(206,145,120,0.25)" },
  { fill: "rgba(220,220,170,0.06)", stroke: "rgba(220,220,170,0.25)" },
  { fill: "rgba(197,134,192,0.06)", stroke: "rgba(197,134,192,0.25)" },
];

export function DependencyGraph({ callGraph, currentFile, onFileSelect }: Props) {
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => buildGraph(callGraph), [callGraph]);
  const layout = useMemo(() => layoutNodes(graph, grouped), [graph, grouped]);
  const { nodes: baseNodes, width, height, groups } = layout;

  const nodes = useMemo(() => {
    return baseNodes.map((n) => {
      const off = nodeOffsets[n.id];
      if (!off) return n;
      return { ...n, x: n.x + off.dx, y: n.y + off.dy };
    });
  }, [baseNodes, nodeOffsets]);

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

  // Zoom via mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.3), 3));
  }, []);

  // Pan via middle-click or Ctrl+drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }
    if (dragNode) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      setNodeOffsets((prev) => ({
        ...prev,
        [dragNode]: {
          dx: (prev[dragNode]?.dx ?? 0) + dx - (prev[dragNode]?.dx ?? 0) + dragStart.current.nodeX,
          dy: (prev[dragNode]?.dy ?? 0) + dy - (prev[dragNode]?.dy ?? 0) + dragStart.current.nodeY,
        },
      }));
    }
  }, [isPanning, dragNode, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragNode(null);
  }, []);

  // Node drag start
  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    e.stopPropagation();
    setDragNode(nodeId);
    const off = nodeOffsets[nodeId] ?? { dx: 0, dy: 0 };
    dragStart.current = { x: e.clientX, y: e.clientY, nodeX: off.dx, nodeY: off.dy };
  }, [nodeOffsets]);

  const handleNodeDrag = useCallback((e: React.MouseEvent) => {
    if (!dragNode) return;
    const dx = (e.clientX - dragStart.current.x) / zoom + dragStart.current.nodeX;
    const dy = (e.clientY - dragStart.current.y) / zoom + dragStart.current.nodeY;
    setNodeOffsets((prev) => ({ ...prev, [dragNode]: { dx, dy } }));
  }, [dragNode, zoom]);

  // Clear offsets when layout changes
  useEffect(() => {
    setNodeOffsets({});
  }, [grouped]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodeOffsets({});
  }, []);

  if (nodes.length === 0) return null;

  const pad = 20;
  const svgW = width + pad * 2;
  const svgH = height + pad * 2;

  return (
    <div style={{ borderBottom: "1px solid #333", padding: "8px 0" }}>
      <div style={{
        fontSize: 10, color: "#888", textTransform: "uppercase",
        padding: "0 8px 6px", fontWeight: 600, display: "flex",
        alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <span>Dependency Graph</span>
        <span style={{ color: "#666", fontWeight: 400 }}>
          {nodes.length} files · {graph.edges.length} edges
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setGrouped(!grouped)}
          data-testid="graph-group-toggle"
          style={{
            background: grouped ? "#1a3a5a" : "#2a2d2e",
            border: `1px solid ${grouped ? "#007acc" : "#555"}`,
            color: grouped ? "#fff" : "#aaa",
            borderRadius: 3, padding: "1px 8px", fontSize: 10,
            cursor: "pointer",
          }}
        >
          {grouped ? "☰ Grouped" : "☰ Flat"}
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
          data-testid="graph-zoom-in"
          style={{
            background: "#2a2d2e", border: "1px solid #555",
            color: "#aaa", borderRadius: 3, padding: "1px 6px",
            fontSize: 12, cursor: "pointer",
          }}
        >+</button>
        <span style={{ color: "#888", fontSize: 10, minWidth: 32, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
          data-testid="graph-zoom-out"
          style={{
            background: "#2a2d2e", border: "1px solid #555",
            color: "#aaa", borderRadius: 3, padding: "1px 6px",
            fontSize: 12, cursor: "pointer",
          }}
        >−</button>
        <button
          onClick={resetView}
          data-testid="graph-reset"
          style={{
            background: "#2a2d2e", border: "1px solid #555",
            color: "#aaa", borderRadius: 3, padding: "1px 8px",
            fontSize: 10, cursor: "pointer",
          }}
        >Reset</button>
      </div>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => { handleMouseMove(e); handleNodeDrag(e); }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          overflow: "hidden",
          cursor: isPanning ? "grabbing" : dragNode ? "grabbing" : "default",
          userSelect: "none",
        }}
      >
        <svg
          width={svgW * zoom}
          height={svgH * zoom}
          viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${svgW} ${svgH}`}
          style={{ display: "block", margin: "0 auto" }}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#555" />
            </marker>
            <marker id="arrow-hl" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#4ec9b0" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#007acc" />
            </marker>
          </defs>

          {/* Directory groups */}
          {groups.map((g, gi) => {
            const gc = GROUP_COLORS[gi % GROUP_COLORS.length];
            return (
              <g key={`group-${g.name}`}>
                <rect
                  x={pad + g.x}
                  y={pad + g.y}
                  width={g.w}
                  height={g.h}
                  rx={6}
                  fill={gc.fill}
                  stroke={gc.stroke}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
                <text
                  x={pad + g.x + 6}
                  y={pad + g.y + 11}
                  fontSize={9}
                  fill={gc.stroke}
                  fontFamily="monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {g.name}
                </text>
              </g>
            );
          })}

          {/* Edges */}
          {graph.edges.map((e, i) => {
            const fromNode = nodeMap.get(e.from);
            const toNode = nodeMap.get(e.to);
            if (!fromNode || !toNode) return null;

            const x1 = pad + fromNode.x + NODE_W / 2;
            const y1 = pad + fromNode.y + NODE_H;
            const x2 = pad + toNode.x + NODE_W / 2;
            const y2 = pad + toNode.y;

            const isHovered = hoveredFile === e.from || hoveredFile === e.to;
            const isActive = currentFile === e.from || currentFile === e.to;
            const isEdgeHovered = hoveredEdge?.from === e.from && hoveredEdge?.to === e.to;

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
              stroke = "#4ec9b0"; opacity = 1;
              marker = "url(#arrow-hl)"; strokeWidth = 2;
            } else if (isActive) {
              stroke = "#007acc"; opacity = 0.7;
              marker = "url(#arrow-active)"; strokeWidth = 1.5;
            } else if (isHovered) {
              stroke = "#4ec9b0"; opacity = 0.6;
              marker = "url(#arrow-hl)";
            } else if (hoveredFile && !connectedFiles.has(e.from) && !connectedFiles.has(e.to)) {
              opacity = 0.15;
            }

            return (
              <g key={`edge-${i}`}>
                <path
                  d={path} fill="none" stroke={stroke}
                  strokeWidth={strokeWidth} opacity={opacity}
                  markerEnd={marker}
                  style={{ transition: "opacity 0.15s, stroke 0.15s" }}
                />
                <path
                  d={path} fill="none" stroke="transparent" strokeWidth={10}
                  onMouseEnter={() => setHoveredEdge(e)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  style={{ cursor: "default" }}
                />
                {isEdgeHovered && e.names.length > 0 && (
                  <text
                    x={(x1 + x2) / 2} y={midY - 6}
                    textAnchor="middle" fontSize={9}
                    fill="#4ec9b0" fontFamily="monospace"
                    style={{ pointerEvents: "none" }}
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
            const dimmed = hoveredFile && !connectedFiles.has(node.file);

            return (
              <g
                key={node.id}
                transform={`translate(${pad + node.x}, ${pad + node.y})`}
                onClick={() => {
                  if (!dragNode) handleNodeClick(node.file);
                }}
                onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                onMouseEnter={() => { if (!dragNode) setHoveredFile(node.file); }}
                onMouseLeave={() => { if (!dragNode) setHoveredFile(null); }}
                style={{
                  cursor: dragNode === node.id ? "grabbing" : "grab",
                  opacity: dimmed ? 0.25 : 1,
                  transition: dragNode ? "none" : "opacity 0.15s",
                }}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={4}
                  fill={colors.fill} stroke={colors.stroke}
                  strokeWidth={node.file === currentFile ? 2 : 1}
                />
                <text
                  x={NODE_W / 2} y={NODE_H / 2 + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fontFamily="monospace" fill={colors.text}
                  style={{ pointerEvents: "none" }}
                >
                  {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
                </text>
                {(node.inDegree > 0 || node.outDegree > 0) && (
                  <text
                    x={NODE_W - 4} y={8}
                    textAnchor="end" fontSize={8} fill="#666"
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
