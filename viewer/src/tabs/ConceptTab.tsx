import { useState, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { Card } from "../components/Card";
import type { DataEntity } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  highlightEntity?: DataEntity | null;
}

const KIND_ORDER = ["class", "function", "method", "variable", "type", "interface", "enum", "other"];

export function ConceptTab({ entities, onCardClick, highlightEntity }: Props) {
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

  if (groups.length <= 1) {
    return (
      <AnimatePresence mode="popLayout">
        {entities.map((e, i) => (
          <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                highlight={highlightEntity === e} />
        ))}
      </AnimatePresence>
    );
  }

  return (
    <div>
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
