import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface CardProps {
  entity: DataEntity;
  onClick: (entity: DataEntity) => void;
  highlight?: boolean;
  usages?: Array<{ file: string; names: string[] }>;
  onFileSelect?: (file: string) => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
}

const KIND_COLORS: Record<string, string> = {
  function: "#4ec9b0",
  class: "#dcdcaa",
  interface: "#9cdcfe",
  type: "#9cdcfe",
  method: "#4ec9b0",
  enum: "#b5cea8",
  variable: "#ce9178",
  decorated: "#c586c0",
};

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function Card({ entity, onClick, highlight, usages, onFileSelect, bookmarked, onBookmark }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const kind = (entity.detail.kind as string) || "";
  const name = (entity.detail.name as string) || "";
  const lines = entity.anchor.end_line - entity.anchor.start_line + 1;
  const loc = `L${entity.anchor.start_line}–${entity.anchor.end_line}`;
  const badgeColor = KIND_COLORS[kind] || "#b5cea8";
  const desc = entity.detail.description as string | undefined;
  const isEnriched = desc && !desc.match(/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/);
  const summaryIsPlaceholder = entity.summary.match(/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated): /);

  return (
    <motion.div
      className={`vr-card${highlight ? " vr-card-highlight" : ""}`}
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
            {!summaryIsPlaceholder && (
              <span className="vr-card-summary">{entity.summary}</span>
            )}
          </div>
        </div>
        <div className="vr-card-meta">
          {onBookmark && (
            <span
              style={{ cursor: "pointer", fontSize: 12, opacity: bookmarked ? 1 : 0.3, marginRight: 2 }}
              onClick={(e) => { e.stopPropagation(); onBookmark(); }}
              title={bookmarked ? "Remove bookmark" : "Add bookmark"}
            >{bookmarked ? "★" : "☆"}</span>
          )}
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
              {isEnriched && <span className="vr-card-chip vr-card-chip--enriched">enriched</span>}
              {name && (
                <span
                  className="vr-card-chip"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(name); }}
                  title="Copy name"
                >📋</span>
              )}
            </div>
            {usages && usages.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11 }}>
                <div style={{ color: "#888", marginBottom: 2 }}>Used by {usages.length} file{usages.length > 1 ? "s" : ""}:</div>
                {usages.map((u, i) => (
                  <div key={i}
                    style={{ color: "#9cdcfe", cursor: "pointer", padding: "1px 0" }}
                    onClick={(e) => { e.stopPropagation(); onFileSelect?.(u.file); }}
                  >
                    {u.file.split("/").pop()}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
