import { useState, useMemo } from "react";
import type { DataEntity } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  cursorLine?: number;
}

interface OutlineNode {
  entity: DataEntity;
  children: OutlineNode[];
}

const KIND_ICONS: Record<string, string> = {
  class: "C",
  function: "f",
  method: "m",
  variable: "v",
  type: "T",
  interface: "I",
  enum: "E",
};

const KIND_COLORS: Record<string, string> = {
  class: "#dcdcaa",
  function: "#4ec9b0",
  method: "#4ec9b0",
  variable: "#ce9178",
  type: "#9cdcfe",
  interface: "#9cdcfe",
  enum: "#b5cea8",
};

function buildOutline(entities: DataEntity[]): OutlineNode[] {
  const concepts = entities
    .filter(e => e.type === "concept")
    .sort((a, b) => a.anchor.start_line - b.anchor.start_line);

  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const e of concepts) {
    const node: OutlineNode = { entity: e, children: [] };

    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (e.anchor.start_line <= parent.entity.anchor.end_line) {
        parent.children.push(node);
        stack.push(node);
        break;
      }
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
      stack.push(node);
    }
  }

  return roots;
}

function OutlineItem({ node, depth, onCardClick, cursorLine }: {
  node: OutlineNode;
  depth: number;
  onCardClick: (e: DataEntity) => void;
  cursorLine?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const e = node.entity;
  const kind = (e.detail.node_type as string || "other").toLowerCase();
  const name = (e.detail.name as string) || e.summary;
  const icon = KIND_ICONS[kind] || "?";
  const color = KIND_COLORS[kind] || "#b5cea8";
  const hasChildren = node.children.length > 0;
  const isAtCursor = cursorLine !== undefined &&
    cursorLine >= e.anchor.start_line && cursorLine <= e.anchor.end_line;

  return (
    <>
      <div
        className={`vr-outline-item ${isAtCursor ? "vr-outline-item--active" : ""}`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onCardClick(e)}
        title={`${kind}: ${name} (L${e.anchor.start_line}–${e.anchor.end_line})`}
      >
        {hasChildren ? (
          <span
            className="vr-outline-arrow"
            onClick={(ev) => { ev.stopPropagation(); setCollapsed(!collapsed); }}
          >
            {collapsed ? "▶" : "▼"}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <span className="vr-outline-icon" style={{ color }}>
          {icon}
        </span>
        <span className="vr-outline-name">
          {name}
        </span>
        <span className="vr-outline-line">
          {e.anchor.start_line}
        </span>
      </div>
      {hasChildren && !collapsed && node.children.map((c, i) => (
        <OutlineItem key={i} node={c} depth={depth + 1} onCardClick={onCardClick} cursorLine={cursorLine} />
      ))}
    </>
  );
}

function matchesFilter(node: OutlineNode, q: string): boolean {
  const name = ((node.entity.detail.name as string) || node.entity.summary).toLowerCase();
  if (name.includes(q)) return true;
  return node.children.some(c => matchesFilter(c, q));
}

function filterOutline(nodes: OutlineNode[], q: string): OutlineNode[] {
  if (!q) return nodes;
  return nodes.filter(n => matchesFilter(n, q)).map(n => ({
    ...n,
    children: filterOutline(n.children, q),
  }));
}

export function OutlineTab({ entities, onCardClick, cursorLine }: Props) {
  const outline = useMemo(() => buildOutline(entities), [entities]);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => filterOutline(outline, filter.toLowerCase().trim()), [outline, filter]);

  if (outline.length === 0) {
    return <div className="vr-no-cards">No outline available for this file.</div>;
  }

  return (
    <div style={{ padding: "4px 0" }}>
      {outline.length > 3 && (
        <div style={{ padding: "2px 8px 4px" }}>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder={`Filter ${outline.length} symbols...`}
            className="vr-outline-filter"
          />
        </div>
      )}
      {filtered.map((node, i) => (
        <OutlineItem key={i} node={node} depth={0} onCardClick={onCardClick} cursorLine={cursorLine} />
      ))}
    </div>
  );
}
