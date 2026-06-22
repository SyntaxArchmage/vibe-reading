export interface LoC {
  file: string;
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

export type EntityType = "concept" | "flow" | "history" | "jump";
export type TabId = EntityType;

export interface DataEntity {
  anchor: LoC;
  type: EntityType;
  summary: string;
  detail: EntityDetail;
}

export type KnowledgeLevel = "basic" | "advanced";

export interface EntityDetail {
  kind?: string;
  name?: string;
  body_lines?: number;
  node_type?: string;
  description?: string;
  level?: KnowledgeLevel;
  // Basic knowledge
  why?: string;
  pattern?: string;
  teaches?: (string | { tag: string; explain: string })[];
  analogy?: string;
  // Advanced knowledge
  design?: string;
  convention?: string;
  smell?: string;
  edge_cases?: string;
  perf?: string;
  [key: string]: unknown;
}
