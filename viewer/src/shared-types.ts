export interface LoC {
  file: string;
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

export type EntityType = "concept" | "flow" | "history" | "jump";
export type TabId = EntityType | "outline";

export interface DataEntity {
  anchor: LoC;
  type: EntityType;
  summary: string;
  detail: EntityDetail;
}

export type KnowledgeLevel = "basic" | "advanced";

export interface TakeawayEntry {
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
  takeaway?: (string | TakeawayEntry)[];
  analogy?: string;
  design?: string;
  convention?: string;
  smell?: string;
  edge_cases?: string;
  perf?: string;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  file: string;
  class?: string;
  name: string;
  kind: "function" | "class" | "method";
  line: number;
  end_line: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  type: "call" | "instantiate" | "import";
  line: number;
}

export interface FlowSegment {
  name: string;
  description: string;
  entry: string;
  path: string[];
}

export interface FlowDataType {
  nodes: FlowNode[];
  edges: FlowEdge[];
  segments: FlowSegment[];
}
