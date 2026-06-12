import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface CardProps {
  entity: DataEntity;
  onClick: (entity: DataEntity) => void;
  isHighlighted?: boolean;
  onHover?: (entity: DataEntity | null) => void;
  sourceLines?: string[];
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

export function Card({ entity, onClick, isHighlighted, onHover, sourceLines }: CardProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const kind = (entity.detail.kind as string) || "";
  const name = (entity.detail.name as string) || "";
  const lines = entity.anchor.end_line - entity.anchor.start_line + 1;
  const loc = `L${entity.anchor.start_line}–${entity.anchor.end_line}`;
  const badgeColor = KIND_COLORS[kind] || "#b5cea8";

  const expanded = manualExpanded || !!isHighlighted;

  const codePreview = useMemo(() => {
    if (!sourceLines || sourceLines.length === 0) return null;
    const start = entity.anchor.start_line - 1;
    const maxPreviewLines = 4;
    const end = Math.min(start + maxPreviewLines, entity.anchor.end_line, sourceLines.length);
    const snippet = sourceLines.slice(start, end);
    const hasMore = entity.anchor.end_line > end;
    return { snippet, startLine: entity.anchor.start_line, hasMore };
  }, [sourceLines, entity.anchor.start_line, entity.anchor.end_line]);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  return (
    <motion.div
      ref={cardRef}
      className={`vr-card${isHighlighted ? " vr-card--highlighted" : ""}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => onHover?.(entity)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div
        className="vr-card-header"
        onClick={() => {
          onClick(entity);
          setManualExpanded(!manualExpanded);
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
            transition={{ duration: 0.22, ease: [0.22, 0.1, 0.36, 1] }}
          >
            {typeof entity.detail.description === "string" ? (
              <p className="vr-card-desc">{entity.detail.description}</p>
            ) : (
              <pre className="vr-card-raw">{JSON.stringify(entity.detail, null, 2)}</pre>
            )}
            {codePreview && (
              <div className="vr-card-code-preview">
                <pre className="vr-card-code">
                  {codePreview.snippet.map((line, i) => (
                    <div key={i} className="vr-card-code-line">
                      <span className="vr-card-code-num">{codePreview.startLine + i}</span>
                      <span className="vr-card-code-text">{line || " "}</span>
                    </div>
                  ))}
                  {codePreview.hasMore && (
                    <div className="vr-card-code-line vr-card-code-more">
                      <span className="vr-card-code-num">...</span>
                      <span className="vr-card-code-text">
                        {lines - codePreview.snippet.length} more lines
                      </span>
                    </div>
                  )}
                </pre>
              </div>
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
