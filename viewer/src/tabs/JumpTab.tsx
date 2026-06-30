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
        <div style={{ padding: "0 10px 8px", fontSize: 11, color: "#666" }}>
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

  return (
    <div>
      {entities.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#888", padding: "4px 8px 2px", fontWeight: 600 }}>
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
          <div style={{ fontSize: 11, color: "#888", padding: "8px 8px 2px", fontWeight: 600 }}>
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
