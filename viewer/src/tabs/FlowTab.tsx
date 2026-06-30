import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity, CallGraph, CallGraphFile } from "../shared-types";
import { matchesImportSource, isLocalSource } from "../utils/import-matching";
import { DependencyGraph } from "../components/DependencyGraph";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  currentFile?: string | null;
  callGraph?: CallGraph | null;
  onFileSelect?: (file: string) => void;
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
                    <span className="vr-flow-dep-label">Local</span>
                    <div className="vr-card-chips" style={{ marginTop: 2 }}>
                      {(entity.detail.local_deps as string[]).map((d) => (
                        <span key={d} className="vr-card-chip">{d}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(entity.detail.external_deps as string[] | undefined)?.length ? (
                  <div>
                    <span className="vr-flow-dep-label">External</span>
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

function FlowDiagram({ imports, calls, exports }: {
  imports: DataEntity[];
  calls: DataEntity[];
  exports: DataEntity[];
}) {
  const localDeps = imports.flatMap(e => (e.detail.local_deps as string[]) || []);
  const externalDeps = imports.flatMap(e => (e.detail.external_deps as string[]) || []);
  const callees = calls.flatMap(e => (e.detail.callees as string[]) || []);
  const exportNames = exports.flatMap(e => (e.detail.names as string[]) || []);

  const hasUp = localDeps.length > 0 || externalDeps.length > 0;
  const hasDown = exportNames.length > 0;

  return (
    <div className="vr-flow-diagram">
      {hasUp && (
        <>
          <div className="vr-flow-label">imports ({localDeps.length + externalDeps.length})</div>
          <div className="vr-flow-node vr-flow-node--import">
            {localDeps.length > 0 && <span>{localDeps.slice(0, 3).join(", ")}{localDeps.length > 3 ? ` +${localDeps.length - 3}` : ""}</span>}
            {localDeps.length > 0 && externalDeps.length > 0 && <span> | </span>}
            {externalDeps.length > 0 && <span className="vr-flow-ext">{externalDeps.slice(0, 2).join(", ")}{externalDeps.length > 2 ? ` +${externalDeps.length - 2}` : ""}</span>}
          </div>
          <div className="vr-flow-connector" />
          <div className="vr-flow-arrow">▼</div>
        </>
      )}
      <div className="vr-flow-node vr-flow-node--self">
        this file
        {callees.length > 0 && <span className="vr-flow-callees"> → {callees.slice(0, 3).join(", ")}{callees.length > 3 ? ` +${callees.length - 3}` : ""}</span>}
      </div>
      {hasDown && (
        <>
          <div className="vr-flow-arrow">▼</div>
          <div className="vr-flow-connector" />
          <div className="vr-flow-label">exports ({exportNames.length})</div>
          <div className="vr-flow-node vr-flow-node--export">
            {exportNames.slice(0, 4).join(", ")}{exportNames.length > 4 ? ` +${exportNames.length - 4}` : ""}
          </div>
        </>
      )}
    </div>
  );
}

function CrossFileInfo({ currentFile, callGraph, onFileSelect }: { currentFile: string; callGraph: { files: CallGraphFile[] }; onFileSelect?: (file: string) => void }) {
  const cgEntry = callGraph.files.find(f => f.file === currentFile);
  if (!cgEntry) return null;

  const importers = callGraph.files
    .map(f => {
      const matchingImps = f.imports.filter(imp => matchesImportSource(imp.source, currentFile));
      if (matchingImps.length === 0) return null;
      const names = matchingImps.flatMap(imp => imp.names);
      return { file: f.file, names };
    })
    .filter((x): x is { file: string; names: string[] } => x !== null);

  const dependencies = cgEntry.imports
    .filter(imp => isLocalSource(imp.source, callGraph.files))
    .map(imp => {
      const resolved = callGraph.files.find(f => matchesImportSource(imp.source, f.file));
      return { source: imp.source, names: imp.names, resolved: resolved?.file };
    });

  const circular = dependencies.some(dep =>
    dep.resolved && importers.some(imp => imp.file === dep.resolved)
  );

  if (importers.length === 0 && dependencies.length === 0) return null;

  return (
    <div className="vr-crossfile">
      {circular && (
        <div className="vr-crossfile-circular">
          &#x26A0; Circular dependency detected
        </div>
      )}
      {dependencies.length > 0 && (
        <>
          <div className="vr-crossfile-heading">
            Depends on ({dependencies.length})
          </div>
          {dependencies.slice(0, 6).map(dep => (
            <div
              key={dep.source}
              className={`vr-crossfile-link${dep.resolved ? "" : " vr-crossfile-link--unresolved"}`}
              style={{ cursor: dep.resolved && onFileSelect ? "pointer" : "default" }}
              onClick={() => dep.resolved && onFileSelect?.(dep.resolved)}
            >
              {dep.resolved || dep.source}
              {dep.names.length > 0 && <span className="vr-crossfile-names">({dep.names.join(", ")})</span>}
            </div>
          ))}
          {dependencies.length > 6 && <div className="vr-crossfile-more">+{dependencies.length - 6} more</div>}
        </>
      )}
      {importers.length > 0 && (
        <>
          <div className="vr-crossfile-heading" style={{ marginTop: dependencies.length > 0 ? 8 : 0 }}>
            Imported by ({importers.length})
          </div>
          {importers.slice(0, 8).map(f => (
            <div
              key={f.file}
              className="vr-crossfile-link"
              style={{ cursor: onFileSelect ? "pointer" : "default" }}
              onClick={() => onFileSelect?.(f.file)}
            >
              {f.file}
              {f.names.length > 0 && <span className="vr-crossfile-names">({f.names.slice(0, 3).join(", ")}{f.names.length > 3 ? ` +${f.names.length - 3}` : ""})</span>}
            </div>
          ))}
          {importers.length > 8 && <div className="vr-crossfile-more">+{importers.length - 8} more</div>}
        </>
      )}
    </div>
  );
}

export function FlowTab({ entities, onCardClick, currentFile, callGraph, onFileSelect }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No flow cards for this file.</div>;
  }

  const imports = entities.filter((e) => e.detail.kind === "imports");
  const calls = entities.filter((e) => e.detail.kind === "calls");
  const exports = entities.filter((e) => e.detail.kind === "exports");
  const ordered = [...imports, ...calls, ...exports];

  const localDeps = imports.flatMap(e => (e.detail.local_deps as string[]) || []);
  const externalDeps = imports.flatMap(e => (e.detail.external_deps as string[]) || []);
  const exportNames = exports.flatMap(e => (e.detail.names as string[]) || []);
  const totalImports = localDeps.length + externalDeps.length;

  const [showGraph, setShowGraph] = useState(true);

  return (
    <div>
      {callGraph && callGraph.files.length > 1 && (
        <div className="vr-flow-graph-toggle-bar">
          <button
            onClick={() => setShowGraph(!showGraph)}
            className={`vr-flow-graph-toggle${showGraph ? " vr-flow-graph-toggle--active" : ""}`}
          >
            {showGraph ? "▼ Graph" : "▶ Graph"}
          </button>
        </div>
      )}
      {showGraph && callGraph && (
        <DependencyGraph
          callGraph={callGraph}
          currentFile={currentFile}
          onFileSelect={onFileSelect}
        />
      )}
      <FlowDiagram imports={imports} calls={calls} exports={exports} />
      {(totalImports > 0 || exportNames.length > 0) && (
        <div className="vr-flow-summary">
          {totalImports} imports ({localDeps.length} local) · {exportNames.length} exports
          {totalImports > 0 && exportNames.length > 0 && (
            <span> · ratio {(exportNames.length / totalImports).toFixed(1)}</span>
          )}
        </div>
      )}
      {currentFile && callGraph && <CrossFileInfo currentFile={currentFile} callGraph={callGraph} onFileSelect={onFileSelect} />}
      <AnimatePresence mode="popLayout">
        {ordered.map((e, i) => (
          <FlowCard key={`flow-${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick} />
        ))}
      </AnimatePresence>
    </div>
  );
}
