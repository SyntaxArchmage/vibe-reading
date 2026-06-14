import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
}

const KIND_ICONS: Record<string, string> = {
  imports: "\u2B05",
  calls: "\u27A1",
  exports: "\u2B06",
};

const KIND_COLORS: Record<string, string> = {
  imports: "#4fc1ff",
  calls: "#dcdcaa",
  exports: "#4ec9b0",
};

function FlowCard({ entity, onClick }: { entity: DataEntity; onClick: (e: DataEntity) => void }) {
  const [expanded, setExpanded] = useState(false);
  const kind = (entity.detail.kind as string) || "flow";
  const icon = KIND_ICONS[kind] || "\u2194";
  const color = KIND_COLORS[kind] || "#b5cea8";

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
        onClick={() => { onClick(entity); setExpanded(!expanded); }}
      >
        <div className="vr-card-left">
          <span className="vr-card-badge" style={{ color, borderColor: color + "55" }}>
            {icon} {kind}
          </span>
          <div className="vr-card-title-group">
            <span className="vr-card-summary">{entity.summary}</span>
          </div>
        </div>
        <div className="vr-card-meta">
          <span className="vr-card-loc">
            L{entity.anchor.start_line}–{entity.anchor.end_line}
          </span>
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
            transition={{ duration: 0.2 }}
          >
            {kind === "imports" && (
              <>
                {(entity.detail.local_deps as string[] | undefined)?.length ? (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>Local</span>
                    <div className="vr-card-chips" style={{ marginTop: 2 }}>
                      {(entity.detail.local_deps as string[]).map((d) => (
                        <span key={d} className="vr-card-chip">{d}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(entity.detail.external_deps as string[] | undefined)?.length ? (
                  <div>
                    <span style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>External</span>
                    <div className="vr-card-chips" style={{ marginTop: 2 }}>
                      {(entity.detail.external_deps as string[]).map((d) => (
                        <span key={d} className="vr-card-chip">{d}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
            {kind === "calls" && (
              <div className="vr-card-chips">
                {(entity.detail.callees as string[])?.map((c) => (
                  <span key={c} className="vr-card-chip" style={{ fontFamily: "monospace" }}>{c}</span>
                ))}
              </div>
            )}
            {kind === "exports" && (
              <div className="vr-card-chips">
                {(entity.detail.names as string[])?.map((n) => (
                  <span key={n} className="vr-card-chip" style={{ fontFamily: "monospace" }}>{n}</span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FlowTab({ entities, onCardClick }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No flow cards for this file.</div>;
  }

  const imports = entities.filter((e) => e.detail.kind === "imports");
  const calls = entities.filter((e) => e.detail.kind === "calls");
  const exports = entities.filter((e) => e.detail.kind === "exports");
  const ordered = [...imports, ...calls, ...exports];

  return (
    <AnimatePresence mode="popLayout">
      {ordered.map((e, i) => (
        <FlowCard key={`flow-${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick} />
      ))}
    </AnimatePresence>
  );
}
