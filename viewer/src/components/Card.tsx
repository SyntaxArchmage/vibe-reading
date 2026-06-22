import { useState, useEffect, useRef } from "react";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedTeach, setExpandedTeach] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const d = entity.detail;
  const kind = (d.kind as string) || "";
  const name = (d.name as string) || "";
  const lines = entity.anchor.end_line - entity.anchor.start_line + 1;
  const loc = `L${entity.anchor.start_line}–${entity.anchor.end_line}`;
  const badgeColor = KIND_COLORS[kind] || "#b5cea8";

  const expanded = manualExpanded || !!isHighlighted;

  const hasBasic = d.why || d.pattern || (d.teaches && (d.teaches as string[]).length > 0) || d.analogy;
  const hasAdvanced = d.design || d.convention || d.smell || d.edge_cases || d.perf;

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
        {expanded && (
          <motion.div
            className="vr-card-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.1, 0.36, 1] }}
          >
            {/* Description */}
            {typeof d.description === "string" && (
              <p className="vr-card-desc">{d.description}</p>
            )}

            {/* Basic Knowledge Section */}
            {hasBasic && (
              <div className="vr-card-knowledge vr-card-knowledge--basic">
                {d.why && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel">Why</span>
                    <span className="vr-card-ktext">{d.why as string}</span>
                  </div>
                )}
                {d.pattern && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel">Pattern</span>
                    <span className="vr-card-ktext">{d.pattern as string}</span>
                  </div>
                )}
                {d.teaches && (d.teaches as unknown[]).length > 0 && (
                  <div className="vr-card-krow vr-card-krow--teaches">
                    <span className="vr-card-klabel">Teaches</span>
                    <div className="vr-card-kteaches-wrap">
                      <span className="vr-card-kteaches">
                        {(d.teaches as unknown[]).map((t, i) => {
                          const isObj = typeof t === "object" && t !== null;
                          const tag = isObj ? (t as { tag: string }).tag : String(t);
                          const explain = isObj ? (t as { explain?: string }).explain : undefined;
                          const isOpen = expandedTeach === i;
                          if (!explain) {
                            return <span key={i} className="vr-card-teach-chip">{tag}</span>;
                          }
                          return (
                            <span
                              key={i}
                              className={`vr-card-teach-chip vr-card-teach-chip--clickable${isOpen ? " vr-card-teach-chip--active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTeach(isOpen ? null : i);
                              }}
                            >{tag}</span>
                          );
                        })}
                      </span>
                      {expandedTeach !== null && (() => {
                        const t = (d.teaches as unknown[])[expandedTeach];
                        const explain = typeof t === "object" && t !== null
                          ? (t as { explain?: string }).explain
                          : undefined;
                        if (!explain) return null;
                        return (
                          <div className="vr-card-teach-tooltip">
                            {explain}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {d.analogy && (
                  <div className="vr-card-krow vr-card-krow--analogy">
                    <span className="vr-card-klabel">Analogy</span>
                    <span className="vr-card-ktext vr-card-ktext--analogy">{d.analogy as string}</span>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Toggle */}
            {hasAdvanced && !showAdvanced && (
              <button
                className="vr-card-advanced-toggle"
                onClick={(e) => { e.stopPropagation(); setShowAdvanced(true); }}
              >
                Advanced &darr;
              </button>
            )}

            {/* Advanced Knowledge Section */}
            {hasAdvanced && showAdvanced && (
              <div className="vr-card-knowledge vr-card-knowledge--advanced">
                <button
                  className="vr-card-advanced-toggle vr-card-advanced-toggle--collapse"
                  onClick={(e) => { e.stopPropagation(); setShowAdvanced(false); }}
                >
                  Advanced &uarr;
                </button>
                {d.design && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel vr-card-klabel--adv">Design</span>
                    <span className="vr-card-ktext">{d.design as string}</span>
                  </div>
                )}
                {d.convention && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel vr-card-klabel--adv">Convention</span>
                    <span className="vr-card-ktext">{d.convention as string}</span>
                  </div>
                )}
                {d.smell && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel vr-card-klabel--adv">Smell</span>
                    <span className="vr-card-ktext">{d.smell as string}</span>
                  </div>
                )}
                {d.edge_cases && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel vr-card-klabel--adv">Edge&nbsp;Cases</span>
                    <span className="vr-card-ktext">{d.edge_cases as string}</span>
                  </div>
                )}
                {d.perf && (
                  <div className="vr-card-krow">
                    <span className="vr-card-klabel vr-card-klabel--adv">Perf</span>
                    <span className="vr-card-ktext">{d.perf as string}</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
