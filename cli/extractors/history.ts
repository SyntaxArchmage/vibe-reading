import { execSync } from "child_process";
import * as path from "path";
import type { DataEntity } from "../types.js";

interface CommitInfo {
  hash: string;
  date: string;
  author: string;
  message: string;
}

function getFileLog(projectRoot: string, filePath: string, maxCommits = 20): CommitInfo[] {
  try {
    const output = execSync(
      `git log --format="%H|%aI|%aN|%s" -n ${maxCommits} -- "${filePath}"`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 10000 }
    );
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, author, ...msgParts] = line.split("|");
        return { hash, date, author, message: msgParts.join("|") };
      });
  } catch {
    return [];
  }
}

function getChangeFrequency(projectRoot: string, filePath: string): number {
  try {
    const output = execSync(
      `git log --oneline -- "${filePath}" | wc -l`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }
    );
    return parseInt(output.trim()) || 0;
  } catch {
    return 0;
  }
}

function getFirstCommitDate(projectRoot: string, filePath: string): string | null {
  try {
    const output = execSync(
      `git log --format="%aI" --diff-filter=A -- "${filePath}" | tail -1`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }
    );
    return output.trim() || null;
  } catch {
    return null;
  }
}

const gitRepoCache = new Map<string, boolean>();

function isGitRepo(projectRoot: string): boolean {
  if (gitRepoCache.has(projectRoot)) return gitRepoCache.get(projectRoot)!;
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 3000,
    });
    gitRepoCache.set(projectRoot, true);
    return true;
  } catch {
    gitRepoCache.set(projectRoot, false);
    return false;
  }
}

export async function extractHistory(
  filePath: string,
  _content: string,
  projectRoot: string
): Promise<DataEntity[]> {
  if (!isGitRepo(projectRoot)) return [];

  const commits = getFileLog(projectRoot, filePath);
  if (commits.length === 0) return [];

  const totalCommits = getChangeFrequency(projectRoot, filePath);
  const createdAt = getFirstCommitDate(projectRoot, filePath);
  const latestCommit = commits[0];
  const lines = _content.split("\n");

  const entities: DataEntity[] = [];

  // File-level history summary
  const age = createdAt ? daysBetween(createdAt, new Date().toISOString()) : 0;
  const ageLabel = age > 365
    ? `${Math.floor(age / 365)}y ${Math.floor((age % 365) / 30)}m`
    : age > 30
    ? `${Math.floor(age / 30)}m ${age % 30}d`
    : `${age}d`;

  entities.push({
    anchor: {
      file: filePath,
      start_line: 1,
      start_col: 0,
      end_line: lines.length,
      end_col: 0,
    },
    type: "history",
    summary: `${totalCommits} commits over ${ageLabel}`,
    detail: {
      kind: "file_history",
      total_commits: totalCommits,
      created_at: createdAt,
      last_modified: latestCommit.date,
      last_author: latestCommit.author,
      last_message: latestCommit.message,
      age_days: age,
    },
  });

  // Recent changes timeline (up to 5)
  const recentCommits = commits.slice(0, 5);
  if (recentCommits.length > 1) {
    entities.push({
      anchor: {
        file: filePath,
        start_line: 1,
        start_col: 0,
        end_line: lines.length,
        end_col: 0,
      },
      type: "history",
      summary: `Recent: ${recentCommits.map((c) => c.message).join(" → ")}`,
      detail: {
        kind: "recent_changes",
        commits: recentCommits.map((c) => ({
          hash: c.hash.slice(0, 7),
          date: c.date,
          author: c.author,
          message: c.message,
        })),
      },
    });
  }

  // Hot spot indicator
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = commits.filter(
    (c) => new Date(c.date) > thirtyDaysAgo
  ).length;

  if (recentCount >= 3) {
    entities.push({
      anchor: {
        file: filePath,
        start_line: 1,
        start_col: 0,
        end_line: lines.length,
        end_col: 0,
      },
      type: "history",
      summary: `Hot spot: ${recentCount} changes in last 30 days`,
      detail: {
        kind: "hot_spot",
        recent_count: recentCount,
        period_days: 30,
      },
    });
  }

  return entities;
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}
