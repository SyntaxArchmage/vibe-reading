/**
 * Checks whether an import source string (e.g. "./utils" or "nanovllm.config")
 * matches a given file path (e.g. "src/utils.ts" or "nanovllm/config.py").
 */
export function matchesImportSource(source: string, file: string): boolean {
  if (source.startsWith(".")) {
    const src = source.replace(/^\.\//, "");
    return file.endsWith(src) || file.endsWith(src + ".ts") ||
      file.endsWith(src + ".js") || file.endsWith(src + ".tsx") ||
      file.endsWith(src + ".py");
  }
  const modulePath = source.replace(/\./g, "/");
  const bare = file.replace(/\.py$/, "").replace(/__init__$/, "").replace(/\/$/, "");
  return bare === modulePath || file === modulePath + ".py" ||
    file === modulePath + "/__init__.py";
}

/**
 * Checks whether an import source refers to a local project file
 * (vs a third-party/stdlib module).
 */
export function isLocalSource(source: string, allFiles: { file: string }[]): boolean {
  if (source.startsWith(".")) return true;
  const top = source.split(".")[0];
  return allFiles.some(f => f.file.startsWith(`${top}/`) || f.file === `${top}.py`);
}
