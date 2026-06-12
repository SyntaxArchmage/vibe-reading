/**
 * Auto-generate concept enrichments from source code structure.
 * Produces Tier 1 descriptions using heuristics — no LLM required.
 *
 * Usage: npx tsx auto-enrich.ts <project-root>
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

interface Enrichment {
  name: string;
  start_line: number;
  summary: string;
  description: string;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 3) + "...";
}

// Extract JSDoc (/** ... */) or line comments (// ...) above a definition
function extractJSDoc(lines: string[], startLine: number): string | undefined {
  let i = startLine - 2;
  const docLines: string[] = [];
  while (i >= 0) {
    const line = lines[i].trim();
    if (line === "") { i--; continue; }
    if (line.endsWith("*/")) {
      let j = i;
      while (j >= 0) {
        docLines.unshift(lines[j]);
        if (lines[j].trim().startsWith("/**") || lines[j].trim().startsWith("/*")) break;
        j--;
      }
      break;
    }
    if (line.startsWith("//") || line.startsWith("#")) {
      docLines.unshift(lines[i]);
      i--;
      continue;
    }
    break;
  }
  if (docLines.length === 0) return undefined;
  return docLines
    .map((l) =>
      l.replace(/^\s*\/\*\*?\s?/, "").replace(/\s*\*\/\s*$/, "")
        .replace(/^\s*\*\s?/, "").replace(/^\s*\/\s?/, "")
        .replace(/^\s*#\s?/, "")
    )
    .join("\n").trim();
}

// Extract Python docstrings (triple-quoted strings after def/class)
function extractPyDocstring(lines: string[], startLine: number, endLine: number): string | undefined {
  for (let i = startLine; i < Math.min(startLine + 3, endLine); i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.slice(0, 3);
      if (line.endsWith(quote) && line.length > 6) {
        return line.slice(3, -3).trim();
      }
      const docLines: string[] = [line.slice(3)];
      for (let j = i + 1; j < endLine; j++) {
        const dl = lines[j]?.trimEnd();
        if (dl.trim().endsWith(quote)) {
          docLines.push(dl.trim().slice(0, -3));
          break;
        }
        docLines.push(dl);
      }
      return docLines.join("\n").trim();
    }
  }
  return undefined;
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : cleaned;
}

function inferModuleRole(filePath: string): string | undefined {
  const p = filePath.toLowerCase();
  if (p.includes("test/") || p.includes("tests/") || p.includes("_test.")) return "test module";
  if (p.includes("engine/") || p.includes("core/")) return "core engine";
  if (p.includes("layer")) return "layer module";
  if (/\/models?\//.test(p) || p.endsWith("/models.py") || p.endsWith("/model.py")) return "model definition";
  if (p.includes("util") || p.includes("helper")) return "utility module";
  if (p.includes("schema")) return "data schema";
  if (p.includes("api/") || p.includes("route")) return "API layer";
  if (p.includes("config")) return "configuration";
  return undefined;
}

function extractSignatureInfo(sourceLines: string[]): { params: string[]; returnType?: string; isAsync: boolean } {
  const sig = sourceLines[0]?.trim() || "";
  const isAsync = sig.includes("async ") || sig.includes("Promise");

  const params: string[] = [];
  const paramMatch = sig.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const raw = paramMatch[1];
    for (const p of raw.split(",")) {
      const name = p.trim().split(/[=:]/)[0].trim().replace(/^self$/, "").replace(/^cls$/, "");
      if (name && name !== "self" && name !== "cls" && name !== "*" && !name.startsWith("**"))
        params.push(name);
    }
  }

  let returnType: string | undefined;
  const retMatch = sig.match(/\)\s*(?:->|:)\s*(\S+)/);
  if (retMatch) returnType = retMatch[1].replace(/[{:]$/, "");

  return { params, returnType, isAsync };
}

function buildSummary(name: string, kind: string, doc?: string, sourceLines: string[] = []): string {
  if (doc) {
    const first = firstSentence(doc);
    if (first.length >= 10 && first.length <= 80) return truncate(first.replace(/\.$/, ""), 80);
    if (first.length > 80) return truncate(first, 80);
  }

  const { params, returnType } = extractSignatureInfo(sourceLines);
  const readable = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();

  if (kind === "class") {
    if (params.length > 0) return truncate(`${name} initialized with ${params.join(", ")}`, 80);
    return truncate(`${name} class`, 80);
  }
  if (kind === "interface" || kind === "type") {
    return truncate(`${readable} type contract`, 80);
  }
  if (name === "__init__") {
    if (params.length > 0) return truncate(`Initialize with ${params.join(", ")}`, 80);
    return "Instance constructor";
  }
  if (kind === "function") {
    const verb = name.startsWith("get") || name.startsWith("_get") ? "Get" :
                 name.startsWith("set") || name.startsWith("_set") ? "Set" :
                 name.startsWith("is_") || name.startsWith("has_") || name.startsWith("can_") ? "Check" :
                 name.startsWith("create") || name.startsWith("make") || name.startsWith("build") ? "Create" :
                 name.startsWith("update") ? "Update" :
                 name.startsWith("delete") || name.startsWith("remove") ? "Remove" :
                 name.startsWith("parse") ? "Parse" :
                 name.startsWith("format") ? "Format" :
                 name.startsWith("load") ? "Load" :
                 name.startsWith("save") || name.startsWith("write") ? "Save" :
                 name.startsWith("run") || name.startsWith("exec") || name.startsWith("start") ? "Execute" :
                 name.startsWith("stop") || name.startsWith("close") || name.startsWith("exit") ? "Shut down" :
                 name.startsWith("init") ? "Initialize" :
                 name === "forward" ? "Forward pass through" :
                 name === "__repr__" || name === "__str__" ? "String representation of" :
                 name === "__len__" ? "Length of" :
                 name === "__iter__" ? "Iterate over" :
                 null;
    if (verb) {
      if (params.length > 0 && params.length <= 3)
        return truncate(`${verb} ${readable} (${params.join(", ")})`, 80);
      return truncate(`${verb} ${readable}`, 80);
    }
    if (params.length > 0 && params.length <= 3)
      return truncate(`${readable} (${params.join(", ")})`, 80);
    return truncate(readable, 80);
  }
  return truncate(`${kind}: ${readable}`, 80);
}

function buildDescription(
  name: string, kind: string, bodyLines: number,
  doc?: string, sourceLines: string[] = [], filePath: string = ""
): string {
  const parts: string[] = [];

  if (doc) {
    const sentences = doc.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    parts.push(...sentences.slice(0, 3));
  }

  const moduleRole = inferModuleRole(filePath);
  if (moduleRole) {
    const dirName = path.dirname(filePath);
    parts.push(`Defined in ${dirName}/ (${moduleRole}).`);
  }

  const { params, returnType, isAsync } = extractSignatureInfo(sourceLines);

  if (kind === "class") {
    parts.push(`Class spanning ${bodyLines} lines.`);
  } else if (kind === "interface" || kind === "type") {
    parts.push(`Type contract defining the shape for ${name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}.`);
  } else if (kind === "function") {
    if (params.length > 0) parts.push(`Parameters: ${params.join(", ")}.`);
    if (returnType) parts.push(`Returns ${returnType}.`);
    if (isAsync) parts.push("Async operation.");
  }

  const unique = [...new Set(parts)];
  const joined = unique.join(" ");
  if (joined.length > 20) return joined;

  return `${kind} "${name}" in ${filePath}.`;
}

function enrichFile(projectRoot: string, jsonPath: string): { matched: number; total: number } {
  const analysis: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const relPath = analysis.file;
  const srcPath = path.join(projectRoot, relPath);

  if (!fs.existsSync(srcPath)) {
    return { matched: 0, total: analysis.entities.length };
  }

  const ext = path.extname(relPath).toLowerCase();
  const isPython = ext === ".py";
  const lines = fs.readFileSync(srcPath, "utf-8").split("\n");

  const isUnenriched = (summary: string | undefined) =>
    !summary || /^(type|interface|function|class|enum|struct|module|decorated|trait|impl):/.test(summary);

  let matched = 0;
  for (const entity of analysis.entities) {
    const name = entity.detail.name as string | undefined;
    if (!name) continue;
    if (!isUnenriched(entity.summary)) continue;

    const start = entity.anchor.start_line;
    const end = entity.anchor.end_line;
    const sourceSlice = lines.slice(start - 1, end);
    const kind = (entity.detail.kind as string) ?? "concept";
    const bodyLines = (entity.detail.body_lines as number) ?? (end - start + 1);

    const doc = isPython
      ? extractPyDocstring(lines, start - 1, end) ?? extractJSDoc(lines, start)
      : extractJSDoc(lines, start);

    entity.summary = buildSummary(name, kind, doc, sourceSlice);
    (entity.detail as Record<string, unknown>).description =
      buildDescription(name, kind, bodyLines, doc, sourceSlice, relPath);
    matched++;
  }

  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  return { matched, total: analysis.entities.length };
}

function main() {
  const projectRoot = process.argv[2];
  if (!projectRoot) {
    console.error("Usage: npx tsx auto-enrich.ts <project-root>");
    process.exit(1);
  }

  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error(`[auto-enrich] No .vibe-reading/files/ found. Run analyze.ts first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(filesDir).filter((f) => f.endsWith(".json")).sort();

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
    if (matched > 0) {
      console.log(`  [ok] ${analysis.file}: ${matched}/${total} enriched`);
    }
  }

  console.log(
    `\n[auto-enrich] Done: ${totalFiles} files, ${totalMatched}/${totalEntities} entities enriched`
  );
}

main();
