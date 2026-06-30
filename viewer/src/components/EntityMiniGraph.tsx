import React, { useMemo, useCallback, useState } from "react";
import type { DataEntity } from "../shared-types";
import { kindColor } from "../utils/kind-colors";

interface EntityMiniGraphProps {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  highlightEntity?: DataEntity | null;
  currentFile?: string | null;
}

interface GraphNode {
  id: string;
  entity: DataEntity;
  kind: string;
  name: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: "contains" | "sibling";
}

const nodeColor = kindColor;

const W = 300;
const H_PER_NODE = 24;
const NODE_R = 5;

export function EntityMiniGraph({ entities, onCardClick, highlightEntity, currentFile }: EntityMiniGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, edges, height } = useMemo(() => {
    const concepts = entities.filter(
      (e) => e.type === "concept" && e.detail.name
    );

    if (concepts.length === 0) return { nodes: [], edges: [], height: 0 };

    const sorted = [...concepts].sort(
      (a, b) => a.anchor.start_line - b.anchor.start_line
    );

    const gNodes: GraphNode[] = sorted.map((e, i) => ({
      id: `${e.anchor.start_line}-${e.detail.name}`,
      entity: e,
      kind: String(e.detail.node_type || e.detail.kind || "other"),
      name: String(e.detail.name),
      x: 0,
      y: 0,
    }));

    const gEdges: GraphEdge[] = [];

    for (let i = 0; i < gNodes.length; i++) {
      const outer = gNodes[i].entity;
      for (let j = i + 1; j < gNodes.length; j++) {
        const inner = gNodes[j].entity;
        if (
          inner.anchor.start_line >= outer.anchor.start_line &&
          inner.anchor.end_line <= outer.anchor.end_line
        ) {
          gEdges.push({ from: gNodes[i].id, to: gNodes[j].id, type: "contains" });
        }
      }
    }

    const childSet = new Set(gEdges.map((e) => e.to));
    const roots = gNodes.filter((n) => !childSet.has(n.id));
    const childrenOf = new Map<string, string[]>();
    for (const edge of gEdges) {
      const directParent = findDirectParent(edge.to, gNodes, gEdges);
      if (directParent) {
        if (!childrenOf.has(directParent)) childrenOf.set(directParent, []);
        childrenOf.get(directParent)!.push(edge.to);
      }
    }

    const idxMap = new Map<string, number>();
    gNodes.forEach((n, i) => idxMap.set(n.id, i));

    let row = 0;
    function layout(nodeId: string, depth: number) {
      const idx = idxMap.get(nodeId);
      if (idx == null) return;
      gNodes[idx].x = 30 + depth * 40;
      gNodes[idx].y = 12 + row * H_PER_NODE;
      row++;
      const children = childrenOf.get(nodeId) || [];
      for (const child of children) {
        layout(child, depth + 1);
      }
    }

    for (const root of roots) {
      layout(root.id, 0);
    }

    const totalH = Math.max(row * H_PER_NODE + 8, 40);
    return { nodes: gNodes, edges: gEdges, height: totalH };
  }, [entities]);

  const handleClick = useCallback(
    (entity: DataEntity) => {
      onCardClick(entity);
    },
    [onCardClick]
  );

  if (nodes.length === 0) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const directEdges = edges.filter((e) => {
    const to = nodeMap.get(e.to);
    if (!to) return false;
    const parent = findDirectParent(e.to, nodes, edges);
    return parent === e.from;
  });

  return (
    <div className="vr-mini-graph">
      <svg width={W} height={height} style={{ display: "block" }}>
        {directEdges.map((e, i) => {
          const from = nodeMap.get(e.from);
          const to = nodeMap.get(e.to);
          if (!from || !to) return null;
          return (
            <line
              key={`edge-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#444"
              strokeWidth={1}
              strokeDasharray={e.type === "sibling" ? "3,3" : undefined}
            />
          );
        })}

        {nodes.map((n) => {
          const isHighlight = highlightEntity === n.entity;
          const isHover = hovered === n.id;
          const color = nodeColor(n.kind);
          return (
            <g
              key={n.id}
              style={{ cursor: "pointer" }}
              onClick={() => handleClick(n.entity)}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={isHighlight ? NODE_R + 2 : NODE_R}
                fill={isHighlight ? color : isHover ? color : `${color}88`}
                stroke={isHighlight ? "#fff" : isHover ? color : "none"}
                strokeWidth={isHighlight ? 2 : 1}
              />
              <text
                x={n.x + NODE_R + 4}
                y={n.y}
                dominantBaseline="central"
                fill={isHighlight ? "#fff" : isHover ? "#ddd" : "#999"}
                fontSize={10}
                fontFamily="'Cascadia Code', Consolas, monospace"
                style={{ pointerEvents: "none" }}
              >
                {n.name}
              </text>
              <text
                x={W - 8}
                y={n.y}
                textAnchor="end"
                dominantBaseline="central"
                fill="#555"
                fontSize={9}
                style={{ pointerEvents: "none" }}
              >
                L{n.entity.anchor.start_line}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function findDirectParent(
  childId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): string | null {
  const parents = edges
    .filter((e) => e.to === childId)
    .map((e) => e.from);
  if (parents.length === 0) return null;

  const parentNodes = parents
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as GraphNode[];

  let best: GraphNode | null = null;
  for (const p of parentNodes) {
    const span = p.entity.anchor.end_line - p.entity.anchor.start_line;
    if (!best || span < (best.entity.anchor.end_line - best.entity.anchor.start_line)) {
      best = p;
    }
  }
  return best?.id ?? null;
}

export const entityMiniGraphStyles = `
  .vr-mini-graph {
    padding: 4px 8px;
    border-bottom: 1px solid #3c3c3c;
    overflow-x: auto;
  }
  .vr-mini-graph::-webkit-scrollbar { height: 4px; }
  .vr-mini-graph::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

  .vr-layout--light .vr-mini-graph { border-bottom-color: #e0e0e0; }
  .vr-layout--light .vr-mini-graph line { stroke: #ccc; }
`;
