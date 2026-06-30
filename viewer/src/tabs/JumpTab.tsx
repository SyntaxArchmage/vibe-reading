import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity, CallGraph } from "../shared-types";
import { matchesImportSource } from "../utils/import-matching";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  callGraph?: CallGraph | null;
  currentFile?: string | null;
  onFileSelect?: (file: string) => void;
}

function JumpCard({ entity, onClick }: { entity: DataEntity; onClick: (e: DataEntity) => void }) {
  const targetFile = (entity.detail.target_file as string) || "";
  const names = (entity.detail.names as string[]) || [];
  const reason = (entity.detail.reason as string) || "";

  return (
    <motion.div
      className="vr-card"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(entity)}
      style={{ cursor: "pointer" }}
    >
      <div className="vr-card-header">
        <div className="vr-card-left">
          <span className="vr-card-badge" style={{ color: "#c586c0", borderColor: "#c586c055" }}>
            &#x2192; jump
          </span>
          <div className="vr-card-title-group">
            <span className="vr-card-name" style={{ fontSize: 12 }}>{targetFile}</span>
            {names.length > 0 && (
              <span className="vr-card-summary">{names.join(", ")}</span>
            )}
          </div>
        </div>
        <div className="vr-card-meta">
          <span className="vr-card-loc">L{entity.anchor.start_line}</span>
        </div>
      </div>
      {reason && (
        <div className="vr-jump-reason">
          {reason}
        </div>
      )}
    </motion.div>
  );
}

function ImportedByCard({ file, names, onFileSelect }: {
  file: string;
  names: string[];
  onFileSelect?: (file: string) => void;
}) {
  return (
    <motion.div
      className="vr-card"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={() => onFileSelect?.(file)}
      style={{ cursor: "pointer" }}
    >
      <div className="vr-card-header">
        <div className="vr-card-left">
          <span className="vr-card-badge" style={{ color: "#4ec9b0", borderColor: "#4ec9b055" }}>
            &#x2190; imported by
          </span>
          <div className="vr-card-title-group">
            <span className="vr-card-name" style={{ fontSize: 12 }}>{file}</span>
            {names.length > 0 && (
              <span className="vr-card-summary">{names.join(", ")}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function JumpTab({ entities, onCardClick, callGraph, currentFile, onFileSelect }: Props) {
  const importedBy = useMemo(() => {
    if (!callGraph?.files || !currentFile) return [];
    const results: Array<{ file: string; names: string[] }> = [];
    for (const f of callGraph.files) {
      if (f.file === currentFile) continue;
      for (const imp of f.imports) {
        if (matchesImportSource(imp.source, currentFile)) {
          results.push({ file: f.file, names: imp.names });
        }
      }
    }
    return results;
  }, [callGraph, currentFile]);

  if (entities.length === 0 && importedBy.length === 0) {
    return (
      <div className="vr-no-cards">
        No jump suggestions for this file.<br />
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          Jump cards appear when a file imports from other local modules.
        </span>
      </div>
    );
  }

  const hasConnections = entities.length > 0 || importedBy.length > 0;
  const shortName = currentFile?.split("/").pop() || "file";

  return (
    <div>
      {hasConnections && (
        <div className="vr-jump-overview">
          <svg width="100%" height={48} viewBox="0 0 300 48">
            {entities.length > 0 && (
              <>
                <text x={30} y={28} fontSize={9} fill="var(--vr-fg-dim)" textAnchor="middle">{entities.length} dep{entities.length > 1 ? "s" : ""}</text>
                <line x1={60} y1={24} x2={120} y2={24} stroke="#c586c0" strokeWidth={1.5} markerEnd="url(#jump-arrow-out)" />
              </>
            )}
            <rect x={120} y={10} width={60} height={28} rx={4} fill="var(--vr-bg-tertiary)" stroke="var(--vr-accent)" strokeWidth={1.5} />
            <text x={150} y={28} fontSize={9} fill="var(--vr-fg)" textAnchor="middle" fontWeight="bold">{shortName.length > 10 ? shortName.slice(0, 9) + "…" : shortName}</text>
            {importedBy.length > 0 && (
              <>
                <line x1={180} y1={24} x2={240} y2={24} stroke="#4ec9b0" strokeWidth={1.5} markerEnd="url(#jump-arrow-in)" />
                <text x={270} y={28} fontSize={9} fill="var(--vr-fg-dim)" textAnchor="middle">{importedBy.length} user{importedBy.length > 1 ? "s" : ""}</text>
              </>
            )}
            <defs>
              <marker id="jump-arrow-out" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={5} markerHeight={5} orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#c586c0" />
              </marker>
              <marker id="jump-arrow-in" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={5} markerHeight={5} orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#4ec9b0" />
              </marker>
            </defs>
          </svg>
        </div>
      )}
      {entities.length > 0 && (
        <>
          <div className="vr-jump-heading">
            Imports from ({entities.length})
          </div>
          <AnimatePresence mode="popLayout">
            {entities.map((e, i) => (
              <JumpCard key={`jump-${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick} />
            ))}
          </AnimatePresence>
        </>
      )}
      {importedBy.length > 0 && (
        <>
          <div className="vr-jump-heading" style={{ paddingTop: 8 }}>
            Imported by ({importedBy.length})
          </div>
          <AnimatePresence mode="popLayout">
            {importedBy.map((ib, i) => (
              <ImportedByCard key={`ib-${i}`} file={ib.file} names={ib.names} onFileSelect={onFileSelect} />
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
