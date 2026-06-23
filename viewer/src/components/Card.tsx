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

export function Card({
  entity,
  onClick,
  highlight,
  usages,
  onFileSelect,
  bookmarked,
  onBookmark,
}: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedTakeaway, setExpandedTakeaway] = useState<number | null>(null);

  const d = entity.detail;
  const kind = (d.kind as string) || "";
  const name = (d.name as string) || "";
  const lines = entity.anchor.end_line - entity.anchor.start_line + 1;
  const loc = `L${entity.anchor.start_line}–${entity.anchor.end_line}`;
  const badgeColor = KIND_COLORS[kind] || "#b5cea8";
  const desc = d.description as string | undefined;
  const isEnriched =
    desc &&
    !desc.match(
      /^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/
    );
  const summaryIsPlaceholder = entity.summary.match(
    /^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated): /
  );
  const params = d.params as string[] | undefined;
  const returnType = d.return_type as string | undefined;

  const takeawayItems = (d.takeaway ?? (d as Record<string, unknown>).teaches) as
    | unknown[]
    | undefined;
  const hasBasic =
    d.why || d.pattern || (takeawayItems && takeawayItems.length > 0) || d.analogy;
  const hasAdvanced = d.design || d.convention || d.smell || d.edge_cases || d.perf;

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
            <span
              className="vr-card-badge"
              style={{ color: badgeColor, borderColor: badgeColor + "55" }}
            >
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
              style={{
                cursor: "pointer",
                fontSize: 12,
                opacity: bookmarked ? 1 : 0.3,
                marginRight: 2,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onBookmark();
              }}
              title={bookmarked ? "Remove bookmark" : "Add bookmark"}
            >
              {bookmarked ? "★" : "☆"}
            </span>
          )}
          <span className="vr-card-loc">{loc}</span>
          <span className="vr-card-lines">{lines}L</span>
          <span className={`vr-card-chevron ${expanded ? "vr-card-chevron--open" : ""}`}>
            &#x25B8;
          </span>
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
            {typeof d.description === "string" ? (
              <p className="vr-card-desc">{d.description}</p>
            ) : (
              <pre className="vr-card-raw">{JSON.stringify(d, null, 2)}</pre>
            )}

            {params && params.length > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "#9cdcfe",
                  marginTop: 4,
                  fontFamily: "monospace",
                }}
              >
                ({params.join(", ")}){returnType ? ` → ${returnType}` : ""}
              </div>
            )}

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
                {takeawayItems && takeawayItems.length > 0 && (
                  <div className="vr-card-krow vr-card-krow--takeaway">
                    <span className="vr-card-klabel">Takeaway</span>
                    <div className="vr-card-ktakeaway-wrap">
                      <span className="vr-card-ktakeaway">
                        {takeawayItems.map((t, i) => {
                          const isObj = typeof t === "object" && t !== null;
                          const tag = isObj ? (t as { tag: string }).tag : String(t);
                          const explain = isObj
                            ? (t as { explain?: string }).explain
                            : undefined;
                          const isOpen = expandedTakeaway === i;
                          if (!explain) {
                            return (
                              <span key={i} className="vr-card-teach-chip">
                                {tag}
                              </span>
                            );
                          }
                          return (
                            <span
                              key={i}
                              className={`vr-card-teach-chip vr-card-teach-chip--clickable${
                                isOpen ? " vr-card-teach-chip--active" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTakeaway(isOpen ? null : i);
                              }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </span>
                      {expandedTakeaway !== null &&
                        (() => {
                          const t = takeawayItems[expandedTakeaway];
                          if (typeof t !== "object" || t === null) return null;
                          const obj = t as {
                            explain?: string;
                            rationale?: string;
                            cross_lang?: string;
                            gotcha?: string;
                          };
                          if (!obj.explain) return null;
                          return (
                            <div className="vr-card-teach-tooltip">
                              <p className="vr-teach-explain">{obj.explain}</p>
                              {obj.rationale && (
                                <p className="vr-teach-rationale">
                                  <strong>Why here:</strong> {obj.rationale}
                                </p>
                              )}
                              {obj.cross_lang && (
                                <p className="vr-teach-crosslang">
                                  <strong>Also in:</strong> {obj.cross_lang}
                                </p>
                              )}
                              {obj.gotcha && (
                                <p className="vr-teach-gotcha">⚠️ {obj.gotcha}</p>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                )}
                {d.analogy && (
                  <div className="vr-card-krow vr-card-krow--analogy">
                    <span className="vr-card-klabel">Analogy</span>
                    <span className="vr-card-ktext vr-card-ktext--analogy">
                      {d.analogy as string}
                    </span>
                  </div>
                )}
              </div>
            )}

            {hasAdvanced && !showAdvanced && (
              <button
                className="vr-card-advanced-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdvanced(true);
                }}
              >
                Advanced &darr;
              </button>
            )}

            {hasAdvanced && showAdvanced && (
              <div className="vr-card-knowledge vr-card-knowledge--advanced">
                <button
                  className="vr-card-advanced-toggle vr-card-advanced-toggle--collapse"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAdvanced(false);
                  }}
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

            <div className="vr-card-chips">
              {kind && <span className="vr-card-chip">{kindLabel(kind)}</span>}
              <span className="vr-card-chip">{lines} lines</span>
              <span className="vr-card-chip">{loc}</span>
              {isEnriched && (
                <span className="vr-card-chip vr-card-chip--enriched">enriched</span>
              )}
              {name && (
                <span
                  className="vr-card-chip"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(name);
                  }}
                  title="Copy name"
                >
                  📋
                </span>
              )}
            </div>

            {usages && usages.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11 }}>
                <div style={{ color: "#888", marginBottom: 2 }}>
                  Used by {usages.length} file{usages.length > 1 ? "s" : ""}:
                </div>
                {usages.map((u, i) => (
                  <div
                    key={i}
                    style={{ color: "#9cdcfe", cursor: "pointer", padding: "1px 0" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileSelect?.(u.file);
                    }}
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
