export const KIND_COLORS: Record<string, string> = {
  function: "#4ec9b0",
  class: "#dcdcaa",
  interface: "#9cdcfe",
  type: "#9cdcfe",
  method: "#4ec9b0",
  enum: "#b5cea8",
  variable: "#ce9178",
  decorated: "#c586c0",
  class_definition: "#dcdcaa",
  function_definition: "#4ec9b0",
  decorated_definition: "#4ec9b0",
};

export function kindColor(kind: string): string {
  return KIND_COLORS[kind] || "#b5cea8";
}
