import React from "react";
import type { DataEntity, CallGraph } from "../shared-types";

declare const PREVIEW_DATA: Record<
  string,
  { file: string; entities: DataEntity[] }
>;

declare const CALL_GRAPH: CallGraph | null;

declare const VR_BASE: string | undefined;

export function appBase(): string {
  if (typeof location !== "undefined" && location.protocol === "file:") {
    return "./";
  }
  const base = typeof VR_BASE === "string" ? VR_BASE : "";
  if (!base) return "";
  return base.endsWith("/") ? base : `${base}/`;
}

function sourceStaticPath(file: string): string {
  return `${appBase()}source/${file.replace(/\//g, "__")}.json`;
}

export async function loadSourceContent(file: string): Promise<string> {
  try {
    const resp = await fetch(sourceStaticPath(file));
    if (resp.ok) {
      const json = await resp.json();
      if (typeof json.content === "string") return json.content;
    }
  } catch {
    /* static source unavailable */
  }

  try {
    const resp = await fetch(`/api/source?file=${encodeURIComponent(file)}`);
    if (resp.ok) {
      const json = await resp.json();
      if (typeof json.content === "string") return json.content;
    }
  } catch {
    /* dev server unavailable */
  }

  return `// Source file not found: ${file}`;
}

function moduleImportKeys(file: string): Set<string> {
  const withoutExt = file.replace(/\.[^./]+$/, "");
  const parts = withoutExt.split("/");
  const keys = new Set<string>();
  for (let i = 1; i <= parts.length; i++) {
    keys.add(parts.slice(0, i).join("."));
  }
  if (parts[parts.length - 1] === "__init__") {
    keys.add(parts.slice(0, -1).join("."));
  }
  return keys;
}

function countProjectFanIn(file: string): number {
  if (!CALL_GRAPH?.files) return 0;
  const keys = moduleImportKeys(file);
  let fanIn = 0;
  for (const entry of CALL_GRAPH.files) {
    if (entry.file === file) continue;
    const importsProject = entry.imports.some((imp) => {
      const source = imp.source;
      return keys.has(source) || [...keys].some((k) => k.endsWith(`.${source}`) || k === source);
    });
    if (importsProject) fanIn++;
  }
  return fanIn;
}

function scoreDefaultEntry(key: string, data: { file: string; entities: DataEntity[] }): number {
  const file = data.file;
  const base = file.split("/").pop() || file;
  const depth = file.split("/").length;
  let score = countProjectFanIn(file) * 25;

  if (/^(llm|app|server|main|index|api|cli)\./i.test(base)) score += 45;
  if (/(?:^|\/)llm_engine\.py$/.test(file) || /(?:^|\/)engine\.py$/.test(file)) score += 35;
  if (/(?:^|\/)llm\.py$/.test(file)) score += 40;

  for (const entity of data.entities) {
    if (entity.type !== "concept") continue;
    const name = String(entity.detail.name || "");
    const kind = String(entity.detail.kind || "");
    if (kind === "class" && /^(LLM|LLMEngine|Application|App|Server)$/i.test(name)) score += 55;
    if (kind === "function" && name === "main") score += 5;
  }

  if (/^(example|demo|bench|test|tests|conftest|mock|run_)/i.test(base)) score -= 90;
  if (base === "__init__.py") score += 5;
  if (depth >= 5) score -= 15;
  score += Math.min(data.entities.length, 40) * 0.25;

  return score;
}

export function pickDefaultFileKey(): string | null {
  const entries = Object.entries(PREVIEW_DATA);
  if (entries.length === 0) return null;

  try {
    const last = localStorage.getItem("vr-last-file");
    if (last) {
      const hit = entries.find(([, data]) => data.file === last);
      if (hit) return hit[0];
    }
  } catch {}

  const ranked = entries
    .map(([key, data]) => ({ key, score: scoreDefaultEntry(key, data) }))
    .sort((a, b) => b.score - a.score || PREVIEW_DATA[b.key].entities.length - PREVIEW_DATA[a.key].entities.length);

  return ranked[0]?.key ?? null;
}

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return React.createElement(React.Fragment, null,
    text.slice(0, idx),
    React.createElement("span", { style: { background: "rgba(0,122,204,0.35)", borderRadius: 2, padding: "0 1px" } },
      text.slice(idx, idx + query.length)),
    text.slice(idx + query.length)
  );
}
