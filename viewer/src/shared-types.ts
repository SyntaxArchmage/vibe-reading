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

export interface TeachEntry {
  tag: string;
  explain: string;
  rationale?: string;
  cross_lang?: string;
  gotcha?: string;
}

export interface EntityDetail {
  kind?: string;
  name?: string;
  body_lines?: number;
  node_type?: string;
  description?: string;
  level?: KnowledgeLevel;
  why?: string;
  pattern?: string;
  teaches?: (string | TeachEntry)[];
  analogy?: string;
  design?: string;
  convention?: string;
  smell?: string;
  edge_cases?: string;
  perf?: string;
  [key: string]: unknown;
}
