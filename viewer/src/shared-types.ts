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
  detail: Record<string, unknown>;
}
