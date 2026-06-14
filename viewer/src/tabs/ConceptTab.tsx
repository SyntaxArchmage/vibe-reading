import { useState, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { Card } from "../components/Card";
import type { DataEntity } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  highlightEntity?: DataEntity | null;
  totalLines?: number;
}

const KIND_ORDER = ["class", "function", "method", "variable", "type", "interface", "enum", "other"];

const KIND_COLORS: Record<string, string> = {
  function: "#4ec9b0",
  class: "#dcdcaa",
  method: "#4ec9b0",
  variable: "#ce9178",
  type: "#9cdcfe",
  interface: "#9cdcfe",
  enum: "#b5cea8",
};

function DensityBar({ entities, totalLines, onCardClick }: {
  entities: DataEntity[];
  totalLines: number;
  onCardClick: (e: DataEntity) => void;
}) {
  if (totalLines <= 0) return null;
  return (
    <div style={{ height: 18, background: "#181818", margin: "0 8px 6px", borderRadius: 3,
                  position: "relative", overflow: "hidden", cursor: "pointer" }}
         title="Entity density — click a segment to jump">
      {entities.map((e, i) => {
        const left = (e.anchor.start_line / totalLines) * 100;
        const width = Math.max(((e.anchor.end_line - e.anchor.start_line + 1) / totalLines) * 100, 0.5);
        const kind = (e.detail.node_type as string || "other").toLowerCase();
        const color = KIND_COLORS[kind] || "#b5cea8";
        return (
          <div key={i} onClick={() => onCardClick(e)}
               style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
                        background: color, opacity: 0.5, borderRight: "1px solid #252525" }} />
        );
      })}
    </div>
  );
}

export function ConceptTab({ entities, onCardClick, highlightEntity, totalLines }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No concept cards for this file.</div>;
  }

  const groups = useMemo(() => {
    const m = new Map<string, DataEntity[]>();
    for (const e of entities) {
      const kind = (e.detail.node_type as string || "other").toLowerCase();
      if (!m.has(kind)) m.set(kind, []);
      m.get(kind)!.push(e);
    }
    return [...m.entries()].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a[0]), bi = KIND_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [entities]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (kind: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const densityBar = totalLines && totalLines > 0
    ? <DensityBar entities={entities} totalLines={totalLines} onCardClick={onCardClick} />
    : null;

  if (groups.length <= 1) {
    return (
      <div>
        {densityBar}
        <AnimatePresence mode="popLayout">
          {entities.map((e, i) => (
            <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                  highlight={highlightEntity === e} />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div>
      {densityBar}
      {groups.map(([kind, items]) => (
        <div key={kind}>
          <div className="vr-concept-group-header" onClick={() => toggle(kind)}
               style={{ fontSize: 11, fontWeight: 600, padding: "6px 8px 2px", cursor: "pointer",
                        color: "#888", userSelect: "none", display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 9 }}>{collapsed.has(kind) ? "▶" : "▼"}</span>
            {kind} ({items.length})
          </div>
          {!collapsed.has(kind) && (
            <AnimatePresence mode="popLayout">
              {items.map((e, i) => (
                <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                      highlight={highlightEntity === e} />
              ))}
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  );
}
