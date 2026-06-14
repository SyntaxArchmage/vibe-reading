/**
 * Auto-generate concept enrichments from source code + JSDoc comments.
 * Usage: npx tsx auto-enrich.ts <project-root> [--prefix packages__agent__|packages__ai__]
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

interface Enrichment {
  name: string;
  summary: string;
  description: string;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 3) + "...";
}

function extractJSDoc(lines: string[], startLine: number): string | undefined {
  let i = startLine - 2; // 0-indexed, line before entity
  const docLines: string[] = [];
  while (i >= 0) {
    const line = lines[i].trim();
    if (line === "") {
      i--;
      continue;
    }
    if (line.endsWith("*/")) {
      let j = i;
      while (j >= 0) {
        docLines.unshift(lines[j]);
        if (lines[j].trim().startsWith("/**")) break;
        j--;
      }
      break;
    }
    // Rust `///` doc comments
    if (line.startsWith("///")) {
      docLines.unshift(lines[i]);
      i--;
      continue;
    }
    // Go/C++ `//` line comments (contiguous block)
    if (line.startsWith("//")) {
      docLines.unshift(lines[i]);
      i--;
      continue;
    }
    break;
  }
  if (docLines.length === 0) return undefined;
  return docLines
    .map((l) =>
      l
        .replace(/^\s*\/\*\*?\s?/, "")
        .replace(/\s*\*\/\s*$/, "")
        .replace(/^\s*\*\s?/, "")
        .replace(/^\s*\/\/\/\s?/, "")
        .replace(/^\s*\/\/\s?/, "")
    )
    .join("\n")
    .trim();
}

function extractHashDoc(lines: string[], startLine: number): string | undefined {
  let i = startLine - 2;
  const docLines: string[] = [];
  while (i >= 0) {
    const line = lines[i].trim();
    if (line === "") { i--; continue; }
    if (line.startsWith("#")) {
      docLines.unshift(line.replace(/^#\s?/, ""));
      i--;
      continue;
    }
    break;
  }
  return docLines.length > 0 ? docLines.join("\n").trim() : undefined;
}

function extractPyDocstring(lines: string[], startLine: number): string | undefined {
  const bodyStart = startLine; // 0-indexed: first line of body
  if (bodyStart >= lines.length) return undefined;

  const firstBodyLine = lines[bodyStart]?.trim();
  if (!firstBodyLine) return undefined;

  if (firstBodyLine.startsWith('"""') || firstBodyLine.startsWith("'''")) {
    const quote = firstBodyLine.slice(0, 3);
    if (firstBodyLine.endsWith(quote) && firstBodyLine.length > 6) {
      return firstBodyLine.slice(3, -3).trim();
    }
    const docLines: string[] = [firstBodyLine.slice(3)];
    for (let j = bodyStart + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (l.endsWith(quote)) {
        docLines.push(l.slice(0, -3));
        break;
      }
      docLines.push(l);
    }
    return docLines.join("\n").trim();
  }
  return undefined;
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : cleaned;
}

function actionSummary(name: string, kind: string, jsdoc?: string, sourceLine?: string): string {
  if (jsdoc) {
    const first = firstSentence(jsdoc);
    const lower = first.toLowerCase();
    // Already action-oriented
    if (
      /^(load|create|parse|format|build|run|execute|stream|convert|validate|emit|handle|process|register|resolve|substitute|escape|truncate|summarize|compress|store|read|write|delete|clear|enqueue|drain|subscribe|abort|reset|continue|prompt|steer|follow)/i.test(
        first
      )
    ) {
      return truncate(first.replace(/\.$/, ""), 80);
    }
    if (lower.startsWith("the ")) {
      return truncate(first.replace(/^the /i, "").replace(/\.$/, ""), 80);
    }
    return truncate(first.replace(/\.$/, ""), 80);
  }

  const verbs: Record<string, string> = {
    function: "Run",
    class: "Define",
    interface: "Describe",
    type: "Type for",
  };
  const verb = verbs[kind] ?? "Define";
  const readable = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  if (kind === "type" || kind === "interface") {
    return truncate(`${readable} contract`, 80);
  }
  if (sourceLine?.includes("export const ")) {
    return truncate(`Constant: ${readable}`, 80);
  }
  return truncate(`${verb} ${readable}`, 80);
}

function extractParams(sig: string): string[] {
  const m = sig.match(/\(([^)]*)\)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map(p => p.trim())
    .filter(p => p && p !== "self" && p !== "cls")
    .map(p => p.split(/[=:]/)[0].trim());
}

function buildDescription(
  name: string,
  kind: string,
  filePath: string,
  jsdoc?: string,
  sourceLines: string[] = [],
): string {
  const parts: string[] = [];

  if (jsdoc) {
    const sentences = jsdoc
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.push(...sentences.slice(0, 3));
  }

  const rel = filePath;
  if (rel.includes("test/") || rel.includes("__test__") || rel.includes(".test.")) {
    parts.push("Test coverage validating behavior and regressions for the surrounding module.");
  }

  if (kind === "class") {
    parts.push("Encapsulates related state and methods for this subsystem.");
  } else if (kind === "interface" || kind === "type") {
    parts.push("Shapes data passed between layers; extend via declaration merging where supported.");
  }

  const sig = sourceLines[0]?.trim();
  if (sig && sig.length < 120 && !parts.some((p) => p.includes(sig))) {
    if (sig.includes("async ") || sig.includes("Promise")) {
      parts.push("Async API; callers should await completion and handle errors.");
    }
  }

  if (name.startsWith("_") && kind !== "class") {
    parts.push("Internal implementation detail; not part of the public API.");
  }

  if (name === "__init__" || name === "constructor") {
    parts.push("Initializes instance state and validates constructor arguments.");
  }

  const funcSig = sourceLines[0]?.trim() || "";
  if ((kind === "function" || kind === "method") && funcSig) {
    const params = extractParams(funcSig);
    if (params.length > 0) {
      parts.push(`Parameters: ${params.join(", ")}.`);
    }
    const retMatch = funcSig.match(/\)\s*:\s*(\w+[\w<>\[\]|]*)/);
    if (retMatch) {
      parts.push(`Returns ${retMatch[1]}.`);
    } else if (funcSig.includes("-> ")) {
      const pyRet = funcSig.match(/->\s*(\w+)/);
      if (pyRet) parts.push(`Returns ${pyRet[1]}.`);
    }
  }

  const body = sourceLines.join("\n");
  if (body.includes("throw ") || body.includes("raise ")) {
    parts.push("May throw on invalid inputs; callers should handle errors.");
  }

  if (body.includes("@property") || (sig && sig.includes("get "))) {
    parts.push("Computed property; accessed like a field but may trigger logic.");
  }

  const unique = [...new Set(parts)];
  const joined = unique.join(" ");
  if (joined.length > 20) return joined;

  const readable = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return `${kind} "${name}" in ${rel}. Implements ${readable}.`;
}

function enrichFile(projectRoot: string, jsonPath: string): { matched: number; total: number } {
  const analysis: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const relPath = analysis.file;
  const srcPath = path.join(projectRoot, relPath);

  if (!fs.existsSync(srcPath)) {
    console.warn(`[skip] source missing: ${relPath}`);
    return { matched: 0, total: analysis.entities.length };
  }

  const lines = fs.readFileSync(srcPath, "utf-8").split("\n");
  const enrichments: Enrichment[] = [];
  const seen = new Set<string>();

  const isUnenriched = (summary: string | undefined) =>
    !summary || /^(type|interface|function|class|enum|method|struct|module|decorated): /.test(summary);

  for (const entity of analysis.entities) {
    const name = entity.detail.name as string | undefined;
    if (!name || seen.has(name)) continue;
    if (!isUnenriched(entity.summary)) continue;
    seen.add(name);

    const start = entity.anchor.start_line;
    const end = entity.anchor.end_line;
    const sourceSlice = lines.slice(start - 1, end);
    const isPython = relPath.endsWith(".py");
    const isRuby = relPath.endsWith(".rb");
    let jsdoc: string | undefined;
    if (isPython) {
      jsdoc = extractPyDocstring(lines, start) ?? extractHashDoc(lines, start);
    } else if (isRuby) {
      jsdoc = extractHashDoc(lines, start);
    } else {
      jsdoc = extractJSDoc(lines, start);
    }
    const kind = (entity.detail.kind as string) ?? "concept";

    enrichments.push({
      name,
      summary: actionSummary(name, kind, jsdoc, sourceSlice[0]),
      description: buildDescription(name, kind, relPath, jsdoc, sourceSlice),
    });
  }

  const enrichMap = new Map(enrichments.map((e) => [e.name, e]));
  let matched = 0;
  for (const entity of analysis.entities) {
    const name = entity.detail.name as string | undefined;
    if (!name || !isUnenriched(entity.summary)) continue;
    const enrichment = enrichMap.get(name);
    if (enrichment) {
      entity.summary = enrichment.summary;
      (entity.detail as Record<string, unknown>).description = enrichment.description;
      matched++;
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  return { matched, total: analysis.entities.length };
}

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0];
  if (!projectRoot) {
    console.error("Usage: npx tsx auto-enrich.ts <project-root> [--prefix PREFIX]");
    process.exit(1);
  }

  const prefixArg = args.find((a) => a.startsWith("--prefix="));
  const prefix = prefixArg?.slice("--prefix=".length) ?? "";

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  const files = fs
    .readdirSync(filesDir)
    .filter(
      (f) =>
        f.endsWith(".json") &&
        (prefix === "" || f.startsWith(prefix))
    )
    .sort();

  let totalFiles = 0;
  let totalMatched = 0;
  let totalEntities = 0;

  for (const f of files) {
    const jsonPath = path.join(filesDir, f);
    const analysis: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    if (analysis.entities.length === 0) continue;

    const { matched, total } = enrichFile(projectRoot, jsonPath);
    totalFiles++;
    totalMatched += matched;
    totalEntities += total;
    console.log(`[auto-enrich] ${analysis.file}: ${matched}/${total}`);
  }

  console.log(`\n[auto-enrich] Done: ${totalFiles} files, ${totalMatched}/${totalEntities} entities enriched`);
}

main();
