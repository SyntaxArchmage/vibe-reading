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
                {entity.detail.created_at ? (
                  <div><strong>Created:</strong> {formatDate(String(entity.detail.created_at))}</div>
                ) : null}
              </div>
            )}
            {kind === "recent_changes" && (
              <div className="vr-history-commits">
                {(entity.detail.commits as Array<{ hash: string; date: string; author: string; message: string }>)?.map((c) => (
                  <div key={c.hash} className="vr-history-commit">
                    <span className="vr-history-hash">{c.hash}</span>{" "}
                    <span className="vr-history-date">{formatDate(c.date)}</span>{" "}
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
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
      <button onClick={fetchBlame} className="vr-blame-btn">
        Show Git Blame
      </button>
    );
  }

  if (loading) return <div className="vr-blame-msg">Loading blame...</div>;
  if (error) return <div className="vr-blame-msg vr-blame-msg--error">{error}</div>;

  const authors = [...new Set(lines!.map(l => l.author))];
  const authorColors: Record<string, string> = {};
  const palette = ["#4ec9b0", "#dcdcaa", "#9cdcfe", "#ce9178", "#c586c0", "#b5cea8", "#569cd6", "#d4d4d4"];
  authors.forEach((a, i) => { authorColors[a] = palette[i % palette.length]; });

  return (
    <div className="vr-blame-table">
      <div className="vr-blame-header">
        <span className="vr-blame-col vr-blame-col--line">Line</span>
        <span className="vr-blame-col vr-blame-col--sha">SHA</span>
        <span className="vr-blame-col vr-blame-col--author">Author</span>
        <span className="vr-blame-col vr-blame-col--date">Date</span>
        <span className="vr-blame-col">Code</span>
      </div>
      {lines!.map(l => (
        <div key={l.line} className="vr-blame-row">
          <span className="vr-blame-col vr-blame-col--line" style={{ textAlign: "right" }}>{l.line}</span>
          <span className="vr-blame-col vr-blame-col--sha vr-blame-sha">{l.sha}</span>
          <span className="vr-blame-col vr-blame-col--author" style={{ color: authorColors[l.author] || "var(--vr-fg)" }}>{l.author}</span>
          <span className="vr-blame-col vr-blame-col--date">{l.date}</span>
          <span className="vr-blame-code">{l.content}</span>
        </div>
      ))}
    </div>
  );
}

function CommitTimeline({ commits }: { commits: Array<{ date: string }> }) {
  if (!commits || commits.length < 2) return null;
  const now = Date.now();
  const WEEKS = 12;
  const buckets = new Array(WEEKS).fill(0);
  for (const c of commits) {
    const age = now - new Date(c.date).getTime();
    const week = Math.floor(age / (7 * 86400000));
    if (week >= 0 && week < WEEKS) buckets[WEEKS - 1 - week]++;
  }
  const max = Math.max(...buckets, 1);
  return (
    <div className="vr-commit-timeline"
         title={`Commit frequency over last ${WEEKS} weeks`}>
      {buckets.map((v, i) => (
        <div key={i} className={`vr-commit-bar${v > 0 ? " vr-commit-bar--active" : ""}`}
             style={{ height: `${Math.max((v / max) * 100, 4)}%` }} />
      ))}
    </div>
  );
}

function AuthorBar({ commits }: { commits: Array<{ author: string }> }) {
  if (!commits || commits.length < 2) return null;
  const counts: Record<string, number> = {};
  for (const c of commits) counts[c.author] = (counts[c.author] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = commits.length;
  const palette = ["#4ec9b0", "#dcdcaa", "#9cdcfe", "#ce9178", "#c586c0", "#b5cea8"];
  return (
    <div style={{ padding: "2px 8px", fontSize: 10 }}>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden" }}>
        {sorted.map(([author, count], i) => (
          <div key={author} title={`${author}: ${count} commits`}
               style={{ width: `${(count / total) * 100}%`, background: palette[i % palette.length] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
        {sorted.slice(0, 4).map(([author, count], i) => (
          <span key={author} style={{ color: palette[i % palette.length] }}>
            {author.split(" ")[0]} ({count})
          </span>
        ))}
      </div>
    </div>
  );
}

export function HistoryTab({ entities, onCardClick, currentFile }: Props) {
  const isStatic = typeof (globalThis as any).VR_BASE === "string";
  if (entities.length === 0 && (isStatic || !currentFile)) {
    return <div className="vr-no-cards">No history cards for this file.</div>;
  }

  const recentChanges = entities.find(e => e.detail.kind === "recent_changes");
  const commits = recentChanges?.detail.commits as Array<{ date: string; author: string }> | undefined;

  return (
    <div>
      {commits && commits.length >= 2 && <CommitTimeline commits={commits} />}
      {commits && commits.length >= 2 && <AuthorBar commits={commits} />}
      <AnimatePresence mode="popLayout">
        {entities.map((e, i) => (
          <HistoryCard key={`hist-${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick} />
        ))}
      </AnimatePresence>
      {currentFile && typeof (globalThis as any).VR_BASE === "undefined" && <BlameView key={currentFile} file={currentFile} />}
    </div>
  );
}
