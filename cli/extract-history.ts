/**
 * Extract git history data for each entity in a project.
 * Uses git log and git blame to track creation, modification, and authorship.
 *
 * Usage: npx tsx extract-history.ts <project-root>
 *
 * Output: <project-root>/.vibe-reading/global/history.json
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { FileAnalysis } from "./types.js";

export interface EntityHistory {
  id: string;
  file: string;
  name: string;
  line_range: [number, number];
  created?: { commit: string; author: string; date: string; message: string };
  last_modified?: { commit: string; author: string; date: string; message: string };
  modification_count: number;
  authors: string[];
  primary_author?: string;
  age_days: number;
  key_changes: { commit: string; date: string; message: string; author: string }[];
}

export interface HistoryData {
  entities: EntityHistory[];
  file_stats: Record<string, { commits: number; authors: string[]; first_commit: string; last_commit: string }>;
}

function findGitRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function execGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

async function main() {
  const projectRoot = process.argv[2];
  if (!projectRoot) {
    console.error("Usage: npx tsx extract-history.ts <project-root>");
    process.exit(1);
  }

  const resolved = path.resolve(projectRoot);
  const gitRoot = findGitRoot(resolved);

  if (!gitRoot) {
    console.error("[history] No git repository found. History extraction requires git.");
    process.exit(1);
  }

  const relPrefix = path.relative(gitRoot, resolved);
  const filesDir = path.join(resolved, ".vibe-reading", "files");
  const globalDir = path.join(resolved, ".vibe-reading", "global");
  fs.mkdirSync(globalDir, { recursive: true });

  if (!fs.existsSync(filesDir)) {
    console.error("[history] No .vibe-reading/files/ found. Run analyze.ts first.");
    process.exit(1);
  }

  console.log(`[history] Git root: ${gitRoot}`);
  console.log(`[history] Project relative path: ${relPrefix || "."}`);

  const jsonFiles = fs.readdirSync(filesDir).filter(f => f.endsWith(".json"));
  const entities: EntityHistory[] = [];
  const fileStats: Record<string, { commits: number; authors: string[]; first_commit: string; last_commit: string }> = {};

  for (const jsonFile of jsonFiles) {
    const analysis: FileAnalysis = JSON.parse(fs.readFileSync(path.join(filesDir, jsonFile), "utf-8"));
    const relPath = analysis.file;
    const gitPath = relPrefix ? path.join(relPrefix, relPath) : relPath;

    // File-level stats
    const fileLog = execGit(
      `git log --format="%H|%an|%as|%s" --follow -- "${gitPath}"`,
      gitRoot
    );

    if (!fileLog) continue;

    const fileCommits = fileLog.split("\n").filter(Boolean).map(line => {
      const [commit, author, date, ...msgParts] = line.split("|");
      return { commit, author, date, message: msgParts.join("|") };
    });

    if (fileCommits.length === 0) continue;

    const fileAuthors = [...new Set(fileCommits.map(c => c.author))];
    fileStats[relPath] = {
      commits: fileCommits.length,
      authors: fileAuthors,
      first_commit: fileCommits[fileCommits.length - 1]?.date || "",
      last_commit: fileCommits[0]?.date || "",
    };

    // Entity-level blame
    for (const entity of analysis.entities) {
      const name = (entity.detail?.name as string) || "";
      const startLine = entity.anchor.start_line;
      const endLine = entity.anchor.end_line || startLine;

      // git log for specific line range
      const rangeLog = execGit(
        `git log --format="%H|%an|%as|%s" -L ${startLine},${endLine}:"${gitPath}" --no-patch 2>/dev/null | head -20`,
        gitRoot
      );

      let commits: { commit: string; author: string; date: string; message: string }[] = [];

      if (rangeLog) {
        commits = rangeLog.split("\n").filter(l => l.includes("|")).map(line => {
          const [commit, author, date, ...msgParts] = line.split("|");
          return { commit: commit || "", author: author || "", date: date || "", message: msgParts.join("|") };
        }).filter(c => c.commit.length > 5);
      }

      // Fallback: use file-level commits if range query fails
      if (commits.length === 0) {
        commits = fileCommits.slice(0, 5);
      }

      const authors = [...new Set(commits.map(c => c.author))];
      const authorCounts = new Map<string, number>();
      for (const c of commits) {
        authorCounts.set(c.author, (authorCounts.get(c.author) || 0) + 1);
      }
      const primaryAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      const oldestDate = commits.length > 0 ? commits[commits.length - 1].date : "";
      const ageDays = oldestDate ? daysBetween(oldestDate) : 0;

      // Key changes: limit to 5 most significant
      const keyChanges = commits.slice(0, 5).map(c => ({
        commit: c.commit.slice(0, 7),
        date: c.date,
        message: c.message.slice(0, 80),
        author: c.author,
      }));

      const entityId = `${relPath}::${name}::${startLine}`;

      entities.push({
        id: entityId,
        file: relPath,
        name,
        line_range: [startLine, endLine],
        created: commits.length > 0 ? commits[commits.length - 1] : undefined,
        last_modified: commits.length > 0 ? commits[0] : undefined,
        modification_count: commits.length,
        authors,
        primary_author: primaryAuthor,
        age_days: ageDays,
        key_changes: keyChanges,
      });
    }

    console.log(`  [ok] ${relPath}: ${analysis.entities.length} entities`);
  }

  const historyData: HistoryData = { entities, file_stats: fileStats };
  const outPath = path.join(globalDir, "history.json");
  fs.writeFileSync(outPath, JSON.stringify(historyData, null, 2));

  console.log(`\n[history] Extracted: ${entities.length} entity histories across ${Object.keys(fileStats).length} files`);
  console.log(`[history] Written to: ${outPath}`);
}

main().catch((err) => {
  console.error("[history] Fatal:", err);
  process.exit(1);
});
