export interface LoC {
  file: string;
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

export type EntityType = "concept" | "flow" | "history" | "jump";

export interface DataEntity {
  anchor: LoC;
  type: EntityType;
  summary: string;
  detail: Record<string, unknown>;
}

export interface FileAnalysis {
  file: string;
  entities: DataEntity[];
  analyzed_at: string;
}

export interface Manifest {
  project: string;
  analyzed_at: string;
  total_files: number;
  analyzed_files: number;
  coverage: number;
  files: ManifestEntry[];
}

export interface ManifestEntry {
  path: string;
  status: "analyzed" | "skipped" | "failed";
  entity_count: number;
}
