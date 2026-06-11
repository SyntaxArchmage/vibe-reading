import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface CardProps {
  entity: DataEntity;
  onClick: (entity: DataEntity) => void;
}

const KIND_COLORS: Record<string, string> = {
  function: "#4ec9b0",
  class: "#dcdcaa",
  interface: "#9cdcfe",
  method: "#4ec9b0",
  variable: "#ce9178",
};

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function Card({ entity, onClick }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const kind = (entity.detail.kind as string) || "";
  const name = (entity.detail.name as string) || "";
  const lines = entity.anchor.end_line - entity.anchor.start_line + 1;
  const loc = `L${entity.anchor.start_line}–${entity.anchor.end_line}`;
  const badgeColor = KIND_COLORS[kind] || "#b5cea8";

  return (
    <motion.div
      className="vr-card"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="vr-card-header"
        onClick={() => {
          onClick(entity);
          setExpanded(!expanded);
        }}
      >
        <div className="vr-card-left">
          {kind && (
            <span className="vr-card-badge" style={{ color: badgeColor, borderColor: badgeColor + "55" }}>
              {kindLabel(kind)}
            </span>
          )}
          <div className="vr-card-title-group">
            {name && <span className="vr-card-name">{name}</span>}
            <span className="vr-card-summary">{entity.summary}</span>
          </div>
        </div>
        <div className="vr-card-meta">
          <span className="vr-card-loc">{loc}</span>
          <span className="vr-card-lines">{lines}L</span>
          <span className={`vr-card-chevron ${expanded ? "vr-card-chevron--open" : ""}`}>&#x25B8;</span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && entity.detail && (
          <motion.div
            className="vr-card-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {typeof entity.detail.description === "string" ? (
              <p className="vr-card-desc">{entity.detail.description}</p>
            ) : (
              <pre className="vr-card-raw">{JSON.stringify(entity.detail, null, 2)}</pre>
            )}
            <div className="vr-card-chips">
              {kind && <span className="vr-card-chip">{kindLabel(kind)}</span>}
              <span className="vr-card-chip">{lines} lines</span>
              <span className="vr-card-chip">{loc}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
