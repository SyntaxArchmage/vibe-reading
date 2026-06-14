import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface BlameLine {
  line: number;
  author: string;
  date: string;
  sha: string;
  content: string;
}

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  currentFile?: string;
}

const KIND_ICONS: Record<string, string> = {
  file_history: "\u{1F4C5}",
  recent_changes: "\u{1F504}",
  hot_spot: "\u{1F525}",
};

const KIND_COLORS: Record<string, string> = {
  file_history: "#9cdcfe",
  recent_changes: "#dcdcaa",
  hot_spot: "#f44747",
};

function HistoryCard({ entity, onClick }: { entity: DataEntity; onClick: (e: DataEntity) => void }) {
  const [expanded, setExpanded] = useState(false);
  const kind = (entity.detail.kind as string) || "history";
  const icon = KIND_ICONS[kind] || "\u{1F4DC}";
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
            {icon} {kind.replace(/_/g, " ")}
          </span>
          <div className="vr-card-title-group">
            <span className="vr-card-summary">{entity.summary}</span>
          </div>
        </div>
        <div className="vr-card-meta">
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
            {kind === "file_history" && (
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div><strong>Last changed:</strong> {formatDate(entity.detail.last_modified as string)}</div>
                <div><strong>By:</strong> {entity.detail.last_author as string}</div>
                <div><strong>Message:</strong> {entity.detail.last_message as string}</div>
                <div><strong>Total commits:</strong> {entity.detail.total_commits as number}</div>
                {entity.detail.created_at && (
                  <div><strong>Created:</strong> {formatDate(entity.detail.created_at as string)}</div>
                )}
              </div>
            )}
            {kind === "recent_changes" && (
              <div style={{ fontSize: 11, fontFamily: "monospace" }}>
                {(entity.detail.commits as Array<{ hash: string; date: string; author: string; message: string }>)?.map((c) => (
                  <div key={c.hash} style={{ padding: "3px 0", borderBottom: "1px solid #333" }}>
                    <span style={{ color: "#dcdcaa" }}>{c.hash}</span>{" "}
                    <span style={{ color: "#666" }}>{formatDate(c.date)}</span>{" "}
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
            {kind === "hot_spot" && (
              <p className="vr-card-desc">
                This file has been actively modified ({entity.detail.recent_count as number} changes
                in the last {entity.detail.period_days as number} days). Consider reviewing for stability.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function BlameView({ file }: { file: string }) {
  const [lines, setLines] = useState<BlameLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBlame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blame?file=${encodeURIComponent(file)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setLines(data.lines);
    } catch (e) {
      setError("Failed to fetch blame data");
    } finally {
      setLoading(false);
    }
  }, [file]);

  if (!lines && !loading && !error) {
    return (
      <button onClick={fetchBlame} style={blameButtonStyle}>
        Show Git Blame
      </button>
    );
  }

  if (loading) return <div style={{ color: "#888", fontSize: 12, padding: 8 }}>Loading blame...</div>;
  if (error) return <div style={{ color: "#f44747", fontSize: 12, padding: 8 }}>{error}</div>;

  const authors = [...new Set(lines!.map(l => l.author))];
  const authorColors: Record<string, string> = {};
  const palette = ["#4ec9b0", "#dcdcaa", "#9cdcfe", "#ce9178", "#c586c0", "#b5cea8", "#569cd6", "#d4d4d4"];
  authors.forEach((a, i) => { authorColors[a] = palette[i % palette.length]; });

  return (
    <div style={{ fontSize: 11, fontFamily: "monospace", maxHeight: 400, overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #333", marginBottom: 4 }}>
        <span style={{ width: 30, color: "#666" }}>Line</span>
        <span style={{ width: 70, color: "#666" }}>SHA</span>
        <span style={{ width: 90, color: "#666" }}>Author</span>
        <span style={{ width: 80, color: "#666" }}>Date</span>
      </div>
      {lines!.map(l => (
        <div key={l.line} style={{ display: "flex", gap: 8, padding: "1px 0" }}>
          <span style={{ width: 30, color: "#666", textAlign: "right" }}>{l.line}</span>
          <span style={{ width: 70, color: "#dcdcaa" }}>{l.sha}</span>
          <span style={{ width: 90, color: authorColors[l.author] || "#d4d4d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.author}</span>
          <span style={{ width: 80, color: "#888" }}>{l.date}</span>
        </div>
      ))}
    </div>
  );
}

const blameButtonStyle: React.CSSProperties = {
  background: "#2d2d2d",
  color: "#9cdcfe",
  border: "1px solid #444",
  borderRadius: 4,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
  width: "100%",
  marginTop: 8,
};

export function HistoryTab({ entities, onCardClick, currentFile }: Props) {
  if (entities.length === 0 && !currentFile) {
    return <div className="vr-no-cards">No history cards for this file.</div>;
  }

  return (
    <div>
      <AnimatePresence mode="popLayout">
        {entities.map((e, i) => (
          <HistoryCard key={`hist-${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick} />
        ))}
      </AnimatePresence>
      {currentFile && <BlameView file={currentFile} />}
    </div>
  );
}
