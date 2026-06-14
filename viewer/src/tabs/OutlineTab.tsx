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
        style={{
          paddingLeft: depth * 14 + 4,
          paddingTop: 2,
          paddingBottom: 2,
          paddingRight: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
          fontSize: 12,
          background: isAtCursor ? "rgba(0,122,204,0.12)" : "transparent",
          borderLeft: isAtCursor ? "2px solid #007acc" : "2px solid transparent",
        }}
        onClick={() => onCardClick(e)}
        title={`${kind}: ${name} (L${e.anchor.start_line}–${e.anchor.end_line})`}
      >
        {hasChildren ? (
          <span
            style={{ fontSize: 8, width: 10, textAlign: "center", flexShrink: 0, color: "#888" }}
            onClick={(ev) => { ev.stopPropagation(); setCollapsed(!collapsed); }}
          >
            {collapsed ? "▶" : "▼"}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, color, width: 12, textAlign: "center", flexShrink: 0,
          fontFamily: "monospace",
        }}>
          {icon}
        </span>
        <span style={{ color: "#d4d4d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span style={{ fontSize: 10, color: "#666", marginLeft: "auto", flexShrink: 0 }}>
          {e.anchor.start_line}
        </span>
      </div>
      {hasChildren && !collapsed && node.children.map((c, i) => (
        <OutlineItem key={i} node={c} depth={depth + 1} onCardClick={onCardClick} cursorLine={cursorLine} />
      ))}
    </>
  );
}

export function OutlineTab({ entities, onCardClick, cursorLine }: Props) {
  const outline = useMemo(() => buildOutline(entities), [entities]);

  if (outline.length === 0) {
    return <div className="vr-no-cards">No outline available for this file.</div>;
  }

  return (
    <div style={{ padding: "4px 0" }}>
      {outline.map((node, i) => (
        <OutlineItem key={i} node={node} depth={0} onCardClick={onCardClick} cursorLine={cursorLine} />
      ))}
    </div>
  );
}
