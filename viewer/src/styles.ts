export const layoutStyles = `
.vr-layout {
  --vr-bg: #1e1e1e;
  --vr-bg-secondary: #252526;
  --vr-bg-tertiary: #2d2d2d;
  --vr-fg: #ccc;
  --vr-fg-dim: #888;
  --vr-fg-dimmer: #666;
  --vr-border: #3c3c3c;
  --vr-input-bg: #3c3c3c;
  --vr-accent: #007acc;
  --vr-hover-bg: rgba(255,255,255,0.04);
  display: flex;
  height: calc(100vh - 22px);
  width: 100vw;
  overflow: hidden;
  background: var(--vr-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: var(--vr-fg);
}
.vr-layout--light {
  --vr-bg: #f3f3f3;
  --vr-bg-secondary: #f9f9f9;
  --vr-bg-tertiary: #e8e8e8;
  --vr-fg: #333;
  --vr-fg-dim: #666;
  --vr-fg-dimmer: #999;
  --vr-border: #d4d4d4;
  --vr-input-bg: #fff;
  --vr-accent: #0078d4;
  --vr-hover-bg: rgba(0,0,0,0.04);
}

.vr-activity-bar {
  width: 40px;
  background: var(--vr-bg-tertiary);
  border-right: 1px solid var(--vr-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8px;
  gap: 4px;
  flex-shrink: 0;
}

.vr-activity-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}

.vr-activity-btn:hover { opacity: 0.9; }
.vr-activity-btn--active { opacity: 1; border-left: 2px solid #007acc; }

.vr-file-panel {
  min-width: 160px;
  background: var(--vr-bg-secondary);
  border-right: 1px solid var(--vr-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.vr-entity-search-panel {
  width: 260px;
  min-width: 200px;
  background: var(--vr-bg-secondary);
  border-right: 1px solid var(--vr-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.vr-heatmap-panel {
  width: 340px;
  min-width: 260px;
  background: var(--vr-bg-secondary);
  border-right: 1px solid var(--vr-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.vr-entity-search-header {
  padding: 8px;
  border-bottom: 1px solid var(--vr-border);
}
.vr-entity-search-input {
  width: 100%;
  background: var(--vr-input-bg);
  border: 1px solid var(--vr-border);
  color: var(--vr-fg);
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}
.vr-entity-search-input:focus { border-color: var(--vr-accent); }
.vr-entity-search-results { overflow-y: auto; flex: 1; }
.vr-entity-search-item {
  padding: 5px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-bottom: 1px solid var(--vr-bg-tertiary);
}
.vr-entity-search-item:hover { background: var(--vr-hover-bg); }
.vr-entity-search-item--active { background: #094771; }
.vr-entity-search-type {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
  background: var(--vr-bg-tertiary);
  color: var(--vr-fg-dim);
  text-transform: uppercase;
  flex-shrink: 0;
}
.vr-entity-search-name {
  font-family: monospace;
  font-size: 12px;
  color: var(--vr-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vr-entity-search-file {
  font-size: 10px;
  color: var(--vr-fg-dimmer);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vr-entity-search-count {
  font-size: 10px; color: var(--vr-fg-dimmer); padding: 2px 0 0;
}
.vr-entity-search-recent-label {
  font-size: 9px; color: var(--vr-fg-dimmer); text-transform: uppercase; margin-bottom: 4px;
}
.vr-entity-search-history-item {
  font-size: 11px; color: var(--vr-fg-dim);
}
.vr-entity-search-empty {
  color: var(--vr-fg-dim); font-size: 12px; padding: 8px;
}
.vr-entity-search-kind {
  font-size: 10px; color: var(--vr-fg-dim);
}

.vr-resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  transition: background 0.15s;
}

.vr-resize-handle:hover,
.vr-resize-handle:active {
  background: var(--vr-accent);
}

.vr-sidebar {
  flex-shrink: 1;
  min-width: 200px;
  border-right: 1px solid var(--vr-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vr-bg-secondary);
}

.vr-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.vr-tab-bar {
  display: flex;
  background: var(--vr-bg-secondary);
  border-bottom: 1px solid var(--vr-border);
  height: 35px;
  align-items: stretch;
  flex-shrink: 0;
  overflow-x: auto;
}

.vr-tab-bar::-webkit-scrollbar { height: 0; }

.vr-tab-item {
  padding: 0 8px 0 12px;
  font-size: 12px;
  color: var(--vr-fg-dim);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-right: 1px solid var(--vr-border);
  white-space: nowrap;
  flex-shrink: 0;
}

.vr-breadcrumb-sep { color: var(--vr-fg-dimmer); font-size: 9px; margin: 0 6px; }
.vr-breadcrumb-label { font-size: 12px; color: var(--vr-fg-dim); cursor: default; }
.vr-breadcrumb-label--active { color: var(--vr-fg); font-weight: 500; }

.vr-tab-item--active {
  background: var(--vr-bg);
  color: var(--vr-fg);
  border-bottom: 2px solid var(--vr-accent);
}

.vr-tab-item-label { pointer-events: none; }

.vr-tab-item-close {
  font-size: 10px;
  opacity: 0;
  padding: 2px 4px;
  border-radius: 3px;
  transition: opacity 0.1s;
}

.vr-tab-item:hover .vr-tab-item-close { opacity: 0.6; }
.vr-tab-item-close:hover { opacity: 1 !important; background: rgba(255,255,255,0.1); }

.vr-nav-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 14px;
  padding: 0 6px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.vr-nav-btn:hover:not(:disabled) { color: #ccc; }
.vr-nav-btn:disabled { opacity: 0.3; cursor: default; }

.vr-editor-wrap { flex: 1; overflow: hidden; position: relative; }

.vr-editor-placeholder {
  padding: 48px 20px;
  text-align: center;
  color: #555;
  font-size: 14px;
}

.vr-monaco-highlight { background: rgba(0, 122, 204, 0.15) !important; }

.vr-monaco-glyph {
  background: #007acc;
  width: 3px !important;
  margin-left: 3px;
  border-radius: 1px;
}

.vr-marker-concept { background: #4ec9b0; width: 3px !important; margin-left: 1px; border-radius: 1px; }
.vr-marker-flow { background: #dcdcaa; width: 3px !important; margin-left: 1px; border-radius: 1px; }
.vr-marker-history { background: #9cdcfe; width: 3px !important; margin-left: 1px; border-radius: 1px; }
.vr-marker-jump { background: #c586c0; width: 3px !important; margin-left: 1px; border-radius: 1px; }

.vr-monaco-hover-range {
  background: rgba(0, 122, 204, 0.06) !important;
  border-left: 2px solid rgba(0, 122, 204, 0.3);
}

.vr-statusbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 22px;
  background: #007acc;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 100;
  flex-shrink: 0;
}

.vr-statusbar-right { opacity: 0.85; display: flex; align-items: center; gap: 4px; }
.vr-statusbar-help {
  background: none; border: 1px solid rgba(255,255,255,0.3); color: inherit;
  border-radius: 3px; font-size: 10px; width: 16px; height: 16px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
  margin-left: 6px; opacity: 0.7; font-weight: bold;
}
.vr-statusbar-help:hover { opacity: 1; border-color: rgba(255,255,255,0.6); }

.vr-breadcrumb { color: var(--vr-fg-dim); font-size: 11px; }
.vr-breadcrumb strong { color: #dcdcaa; }
.vr-layout--light .vr-breadcrumb strong { color: #8a6d3b; }

.vr-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 199;
}

.vr-picker {
  position: fixed;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 520px;
  max-height: 440px;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vr-picker-header {
  display: flex;
  padding: 8px;
  gap: 6px;
  border-bottom: 1px solid #444;
}

.vr-picker-search,
.vr-picker-input {
  flex: 1;
  padding: 6px 10px;
  background: #1e1e1e;
  color: #ccc;
  border: 1px solid #555;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  width: 100%;
}

.vr-picker-search:focus,
.vr-picker-input:focus {
  border-color: #007acc;
}

.vr-picker-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
}

.vr-picker-close:hover { color: #ccc; }

.vr-picker-list { flex: 1; overflow-y: auto; max-height: 280px; }
.vr-picker-list::-webkit-scrollbar { width: 6px; }
.vr-picker-list::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }

.vr-picker-item {
  padding: 5px 12px;
  cursor: pointer;
  font-size: 11px;
  color: #bbb;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.vr-picker-item:hover { background: #333; }
.vr-picker-item--active { background: rgba(0,122,204,0.2); color: #fff; }

.vr-picker-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-picker-count { flex-shrink: 0; color: #666; font-size: 10px; }
.vr-picker-more { color: #666; font-style: italic; cursor: default; }

.vr-picker-footer {
  padding: 4px 12px;
  font-size: 10px;
  color: #666;
  border-top: 1px solid #444;
  text-align: right;
}

.vr-help-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--vr-bg-secondary);
  border: 1px solid var(--vr-border);
  border-radius: 8px;
  padding: 20px 24px;
  z-index: 200;
  min-width: 300px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.vr-help-title { font-size: 14px; font-weight: 600; color: var(--vr-fg); margin-bottom: 12px; }
.vr-help-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--vr-fg-dim);
}
.vr-help-grid kbd {
  background: var(--vr-input-bg);
  border: 1px solid var(--vr-border);
  border-radius: 3px;
  padding: 1px 6px;
  font-family: monospace;
  font-size: 11px;
  color: var(--vr-fg);
}
.vr-help-footer { margin-top: 12px; font-size: 11px; color: var(--vr-fg-dimmer); }
.vr-help-footer code { background: var(--vr-input-bg); padding: 1px 4px; border-radius: 2px; font-size: 10px; }
.vr-help-label { color: var(--vr-fg); }
.vr-help-entity-types { margin-top: 8px; font-size: 11px; color: var(--vr-fg-dim); }
.vr-help-entity-types-title { font-weight: 600; margin-bottom: 4px; }
.vr-help-entity-types-list { display: flex; gap: 8px; flex-wrap: wrap; }

/* Entity kind colors */
.vr-kind-fn { color: #4ec9b0; }
.vr-kind-class { color: #dcdcaa; }
.vr-kind-iface { color: #9cdcfe; }
.vr-kind-var { color: #ce9178; }
.vr-kind-enum { color: #b5cea8; }
.vr-kind-deco { color: #c586c0; }
.vr-layout--light .vr-kind-fn { color: #16825d; }
.vr-layout--light .vr-kind-class { color: #795e26; }
.vr-layout--light .vr-kind-iface { color: #267f99; }
.vr-layout--light .vr-kind-var { color: #a31515; }
.vr-layout--light .vr-kind-enum { color: #098658; }
.vr-layout--light .vr-kind-deco { color: #af00db; }

/* Complexity badges */
.vr-cx-badge {
  font-size: 10px; padding: 0 4px; border-radius: 3px; margin-left: 2px;
}
.vr-cx-high { background: #4a2020; color: #f44747; }
.vr-cx-mid { background: #3a3a20; color: #dcdcaa; }
.vr-cx-low { background: #1a2a1a; color: #4ec9b0; }
.vr-layout--light .vr-cx-high { background: #fde2e2; color: #c72e2e; }
.vr-layout--light .vr-cx-mid { background: #fdf4e2; color: #8b6914; }
.vr-layout--light .vr-cx-low { background: #e2fde8; color: #16825d; }
.vr-cx-badge-inline { /* inline variant without background */ }
.vr-cx-badge-inline.vr-cx-high { color: #f44747; }
.vr-cx-badge-inline.vr-cx-mid { color: #dcdcaa; }
.vr-cx-badge-inline.vr-cx-low { color: #4ec9b0; }
.vr-layout--light .vr-cx-badge-inline.vr-cx-high { color: #c72e2e; }
.vr-layout--light .vr-cx-badge-inline.vr-cx-mid { color: #8b6914; }
.vr-layout--light .vr-cx-badge-inline.vr-cx-low { color: #16825d; }

/* Picker stats */
.vr-picker-stats {
  margin-left: auto; display: flex; gap: 6px; font-size: 10px; color: var(--vr-fg-dimmer); flex-shrink: 0;
}

/* Symbol picker */
.vr-symbol-kind { font-size: 10px; color: var(--vr-fg-dim); margin-right: 4px; }
.vr-symbol-line { margin-left: auto; font-size: 10px; color: var(--vr-fg-dimmer); }

/* Breadcrumb */
.vr-breadcrumb-dim { color: var(--vr-fg-dimmer); }

/* ── Light theme overrides (values that differ from CSS variable defaults) ── */
.vr-layout--light .vr-tab-bar { background: #f0f0f0; }
.vr-layout--light .vr-tab-item { color: #555; }
.vr-layout--light .vr-tab-item--active { background: #fff; }
.vr-layout--light .vr-statusbar {
  background: #2678ca;
}
.vr-layout--light .vr-card {
  background: #fff;
  border-color: #e0e0e0;
}
.vr-layout--light .vr-card:hover {
  border-color: #0078d4;
}
.vr-layout--light .vr-card--focused {
  border-color: #0078d4;
  background: #e8f0ff;
}
.vr-layout--light .vr-card-code-preview {
  background: #f5f5f5;
  border-color: #e0e0e0;
}
.vr-layout--light .vr-card-code-text { color: #333; }
.vr-layout--light .vr-card-code-num { color: #999; }
.vr-layout--light .vr-card-chip { background: #e8e8e8; color: #555; }
.vr-layout--light .vr-content { scrollbar-color: #ccc transparent; }
.vr-layout--light .vr-resize-handle:hover,
.vr-layout--light .vr-resize-handle:active {
  background: #0078d4;
}
.vr-layout--light .vr-picker {
  background: #f9f9f9;
  border-color: #d4d4d4;
  box-shadow: 0 12px 48px rgba(0,0,0,0.15);
}
.vr-layout--light .vr-picker-search,
.vr-layout--light .vr-picker-input {
  background: #fff;
  color: #333;
  border-color: #d4d4d4;
}
.vr-layout--light .vr-picker-item { color: #444; }
.vr-layout--light .vr-picker-item:hover { background: #e8e8e8; }
.vr-layout--light .vr-help-panel {
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.vr-layout--light .vr-entity-search-item:hover { background: #e8f0ff; }
.vr-layout--light .vr-entity-search-item--active { background: #cce0ff; }
.vr-layout--light .vr-file-header { border-bottom-color: #e0e0e0; color: #666; }
.vr-layout--light .vr-file-path { color: #333; }
.vr-layout--light .vr-file-path:hover { color: #111; }
.vr-layout--light .vr-tabs { border-bottom-color: #e0e0e0; }
.vr-layout--light .vr-tab { color: #555; }
.vr-layout--light .vr-tab--active { background: rgba(0,0,0,0.06); }
.vr-layout--light .vr-sort-btn { background: #e8e8e8; border-color: #d4d4d4; color: #555; }
.vr-layout--light .vr-sort-btn:hover:not(.vr-sort-btn--active) { background: #ddd; }
.vr-layout--light .vr-card-filter-input {
  background: #fff; color: #333; border-color: #d4d4d4;
}
.vr-layout--light .vr-theme-btn {
  background: #e8e8e8; color: #555; border-color: #d4d4d4;
}
`;

export const sidebarStyles = `
:root {
  --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --vscode-font-size: 13px;
  --vscode-foreground: #cccccc;
  --vscode-descriptionForeground: #8b8b8b;
  --vscode-panel-border: #3c3c3c;
  --vscode-editor-background: #1e1e1e;
  --vscode-focusBorder: #007acc;
  --vscode-badge-background: #4d4d4d;
  --vscode-badge-foreground: #cccccc;
  --vscode-textCodeBlock-background: #2d2d2d;
}

.vr-empty { padding: 48px 20px 32px; text-align: center; color: #8b8b8b; line-height: 1.6; }
.vr-empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.6; }
.vr-empty-title { font-size: 14px; font-weight: 500; color: #ccc; margin-bottom: 6px; }
.vr-empty-hint { font-size: 12px; opacity: 0.7; }
.vr-empty code { background: #2d2d2d; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }

.vr-file-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; font-size: 12px; color: #8b8b8b;
  border-bottom: 1px solid #3c3c3c; flex-shrink: 0;
}

.vr-file-icon { font-size: 12px; opacity: 0.7; }

.vr-file-path {
  color: #ccc; font-weight: 500; font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  direction: rtl; text-align: left; min-width: 0; flex: 1; cursor: pointer;
}
.vr-file-path:hover { color: #fff; }

.vr-file-count {
  flex-shrink: 0; font-size: 10px; opacity: 0.5;
  background: #4d4d4d; color: #ccc; padding: 0 5px; border-radius: 8px; line-height: 16px;
}

.vr-file-loc {
  flex-shrink: 0; font-size: 10px; opacity: 0.5;
  background: #2a3a2a; color: #b5cea8; padding: 0 5px; border-radius: 8px; line-height: 16px;
}

.vr-file-commits {
  flex-shrink: 0; font-size: 10px; opacity: 0.5;
  background: #3a3a2a; color: #dcdcaa; padding: 0 5px; border-radius: 8px; line-height: 16px;
}

.vr-tabs { display: flex; gap: 2px; padding: 6px 8px; flex-shrink: 0; }

.vr-tab {
  flex: 1; padding: 5px 4px; background: none; border: none; border-radius: 4px;
  color: #ccc; cursor: pointer; font-size: 11px; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  opacity: 0.6; transition: opacity 0.15s, background 0.15s;
}
.vr-tab:hover { opacity: 1; background: rgba(255,255,255,0.04); }
.vr-tab--active { opacity: 1; background: rgba(255,255,255,0.08); }

.vr-tab-count {
  background: #4d4d4d; color: #ccc; padding: 0 5px; border-radius: 8px;
  font-size: 10px; min-width: 14px; text-align: center; line-height: 16px;
}

.vr-card-filter { display: flex; align-items: center; gap: 6px; padding: 4px 8px; flex-shrink: 0; }

.vr-card-filter-input {
  flex: 1; padding: 4px 8px; background: #1e1e1e; color: #ccc;
  border: 1px solid #3c3c3c; border-radius: 4px; font-size: 11px; font-family: inherit; outline: none;
}
.vr-card-filter-input:focus { border-color: #007acc; }

.vr-sort-btns { display: flex; gap: 1px; flex-shrink: 0; }

.vr-sort-btn {
  background: #2d2d2d; border: 1px solid #3c3c3c; color: #888;
  font-size: 10px; padding: 2px 5px; cursor: pointer; font-family: inherit;
}
.vr-sort-btn:first-child { border-radius: 3px 0 0 3px; }
.vr-sort-btn:last-child { border-radius: 0 3px 3px 0; }
.vr-sort-btn--active { background: #007acc; color: #fff; border-color: #007acc; }
.vr-sort-btn:hover:not(.vr-sort-btn--active) { background: #3c3c3c; }

.vr-card-filter-count { font-size: 10px; color: #666; flex-shrink: 0; }

.vr-content { flex: 1; overflow-y: auto; padding: 6px 8px; scroll-behavior: smooth; }
.vr-content::-webkit-scrollbar { width: 6px; }
.vr-content::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
.vr-content::-webkit-scrollbar-track { background: transparent; }

.vr-card {
  background: var(--vr-bg); border: 1px solid var(--vr-border); border-radius: 6px;
  margin-bottom: 6px; overflow: hidden; cursor: pointer;
  transition: border-color 0.25s ease, box-shadow 0.3s ease, background 0.3s ease;
}
.vr-card:hover { border-color: var(--vr-accent); box-shadow: 0 0 0 1px rgba(0,122,204,0.15); }
.vr-card--focused { border-color: var(--vr-accent); box-shadow: 0 0 0 1px rgba(0,122,204,0.3); }
.vr-card-highlight { border-color: #007acc; background: #1a2a3a; }

.vr-card-header {
  padding: 8px 10px; display: flex; align-items: flex-start;
  justify-content: space-between; gap: 8px;
}

.vr-card-left { display: flex; align-items: flex-start; gap: 8px; min-width: 0; flex: 1; }

.vr-card-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
  border: 1px solid; border-radius: 3px; padding: 1px 5px;
  white-space: nowrap; flex-shrink: 0; line-height: 16px; margin-top: 1px;
}

.vr-card-title-group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.vr-card-name {
  font-size: 13px; font-weight: 600; font-family: 'Cascadia Code', Consolas, monospace;
  color: var(--vr-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.vr-card-summary { font-size: 12px; line-height: 1.4; color: var(--vr-fg-dim); }
.vr-card-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.vr-card-loc { font-size: 10px; color: var(--vr-fg-dim); white-space: nowrap; font-family: monospace; }
.vr-card-lines { font-size: 10px; color: var(--vr-fg-dim); opacity: 0.6; }
.vr-card-chevron { font-size: 10px; color: var(--vr-fg-dim); transition: transform 0.2s; opacity: 0.5; }
.vr-card-chevron--open { transform: rotate(90deg); }

.vr-card-detail {
  padding: 8px 10px 10px; font-size: 12px; line-height: 1.6;
  color: var(--vr-fg-dim); border-top: 1px solid var(--vr-border); overflow: hidden;
}

.vr-card-desc { margin: 4px 0 8px; }

.vr-card-raw {
  margin: 4px 0 8px; font-size: 11px; font-family: monospace;
  white-space: pre-wrap; word-break: break-word;
}

.vr-card-code-preview {
  margin: 6px 0; border-radius: 4px; overflow: hidden;
  background: #1a1a1a; border: 1px solid #333;
}

.vr-card-code {
  margin: 0; padding: 6px 0;
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  font-size: 11px; line-height: 1.5; overflow-x: auto;
}
.vr-card-code::-webkit-scrollbar { height: 4px; }
.vr-card-code::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

.vr-card-code-line { display: flex; padding: 0 8px 0 0; white-space: pre; }
.vr-card-code-num { color: var(--vr-fg-dimmer); text-align: right; width: 32px; padding-right: 8px; flex-shrink: 0; user-select: none; }
.vr-card-code-text { color: var(--vr-fg); }
.vr-card-code-more { color: var(--vr-fg-dimmer); font-style: italic; }

.vr-card-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.vr-card-chip { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: var(--vr-bg-tertiary); color: var(--vr-fg-dim); white-space: nowrap; }
.vr-card-chip--enriched { background: #1a3a2a; color: #4ec9b0; }

.vr-card-params { font-size: 11px; color: #9cdcfe; margin-top: 4px; font-family: monospace; }
.vr-card-usages { margin-top: 6px; font-size: 11px; }
.vr-card-usages-header { color: var(--vr-fg-dim); margin-bottom: 2px; }
.vr-card-usage-file { color: #9cdcfe; cursor: pointer; padding: 1px 0; }
.vr-card-usage-file:hover { text-decoration: underline; }

.vr-layout--light .vr-card-params { color: #0070c1; }
.vr-layout--light .vr-card-usage-file { color: #0070c1; }

.vr-card-knowledge { margin: 10px 0 4px; display: flex; flex-direction: column; gap: 6px; }
.vr-card-knowledge--basic { border-left: 2px solid #4ec9b055; background: rgba(78, 201, 176, 0.02); border-radius: 0 4px 4px 0; padding: 8px 10px; }
.vr-card-knowledge--advanced { border-left: 2px solid #c586c055; margin-top: 8px; background: rgba(197, 134, 192, 0.02); border-radius: 0 4px 4px 0; padding: 8px 10px; }

.vr-card-krow { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; line-height: 1.55; }
.vr-card-klabel { flex-shrink: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: #4ec9b0; min-width: 54px; opacity: 0.9; }
.vr-card-klabel--adv { color: #c586c0; }
.vr-card-ktext { color: #b8b8b8; }
.vr-card-ktext--analogy { font-style: italic; color: #9cdcfe; opacity: 0.9; }

.vr-card-ktakeaway { display: flex; flex-wrap: wrap; gap: 4px; }

.vr-card-teach-chip {
  font-size: 10.5px; padding: 2px 8px; border-radius: 10px;
  background: rgba(78, 201, 176, 0.08); color: #6db5a6;
  border: 1px solid rgba(78, 201, 176, 0.15);
  font-family: 'Cascadia Code', Consolas, monospace; line-height: 1.4;
}
.vr-card-teach-chip--clickable {
  cursor: pointer; transition: all 0.2s ease; color: #4ec9b0;
  border-color: rgba(78, 201, 176, 0.3); background: rgba(78, 201, 176, 0.1);
}
.vr-card-teach-chip--clickable:hover { background: rgba(78, 201, 176, 0.22); border-color: #4ec9b0; }
.vr-card-teach-chip--active { background: rgba(78, 201, 176, 0.28); border-color: #4ec9b0; color: #7eecd8; }

.vr-card-krow--takeaway { flex-direction: column; align-items: flex-start; }
.vr-card-ktakeaway-wrap { display: flex; flex-direction: column; gap: 4px; width: 100%; }

.vr-card-teach-tooltip {
  background: #1a2a2a; border: 1px solid rgba(78, 201, 176, 0.25);
  border-radius: 6px; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; color: #c8e0d8; margin-top: 6px;
}

.vr-teach-explain { margin: 0 0 8px; color: #d4e8e0; font-size: 12px; line-height: 1.6; }
.vr-teach-rationale { margin: 0 0 6px; padding: 5px 8px; background: rgba(78, 201, 176, 0.06); border-radius: 4px; color: #9cc; font-size: 11px; }
.vr-teach-rationale strong { color: #4ec9b0; font-weight: 600; margin-right: 4px; }
.vr-teach-crosslang { margin: 0 0 6px; padding: 5px 8px; background: rgba(156, 220, 254, 0.06); border-radius: 4px; color: #9cc8e8; font-size: 11px; font-family: 'Cascadia Code', Consolas, monospace; }
.vr-teach-crosslang strong { color: #9cdcfe; font-weight: 600; margin-right: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.vr-teach-gotcha { margin: 0; padding: 5px 8px; background: rgba(206, 145, 120, 0.08); border-left: 2px solid rgba(206, 145, 120, 0.4); border-radius: 0 4px 4px 0; color: #e8c0a8; font-size: 11px; }

.vr-card-advanced-toggle {
  background: rgba(197, 134, 192, 0.06); border: 1px solid rgba(197, 134, 192, 0.2);
  border-radius: 4px; color: #c586c0; font-size: 10px; cursor: pointer;
  padding: 4px 10px; text-align: left; opacity: 0.8; transition: all 0.15s; margin-top: 6px;
}
.vr-card-advanced-toggle:hover { opacity: 1; background: rgba(197, 134, 192, 0.12); border-color: rgba(197, 134, 192, 0.4); }
.vr-card-advanced-toggle--collapse { margin-bottom: 6px; margin-top: 0; }

.vr-card-krow--analogy { margin-top: 2px; padding-top: 4px; border-top: 1px solid #3c3c3c; }

.vr-concept-group-header:hover { background: rgba(255,255,255,0.04); }

.vr-no-cards { text-align: center; padding: 32px 20px; color: var(--vr-fg-dim); font-size: 12px; }

/* Outline tab */
.vr-outline-item {
  padding-top: 2px; padding-bottom: 2px; padding-right: 4px;
  display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;
  background: transparent; border-left: 2px solid transparent;
}
.vr-outline-item:hover { background: rgba(255,255,255,0.04); }
.vr-outline-item--active { background: rgba(0,122,204,0.12); border-left: 2px solid #007acc; }
.vr-outline-arrow { font-size: 8px; width: 10px; text-align: center; flex-shrink: 0; color: #888; cursor: pointer; }
.vr-outline-icon { font-size: 9px; font-weight: 700; width: 12px; text-align: center; flex-shrink: 0; font-family: monospace; }
.vr-outline-name { color: #d4d4d4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-outline-line { font-size: 10px; color: #666; margin-left: auto; flex-shrink: 0; }
.vr-outline-filter {
  width: 100%; box-sizing: border-box; background: #1e1e1e; color: #ccc;
  border: 1px solid #444; border-radius: 3px; padding: 2px 6px; font-size: 11px; outline: none;
}
.vr-outline-filter:focus { border-color: #007acc; }

/* Light theme: outline */
.vr-layout--light .vr-outline-item:hover { background: rgba(0,0,0,0.04); }
.vr-layout--light .vr-outline-item--active { background: rgba(0,120,212,0.1); }
.vr-layout--light .vr-outline-name { color: #333; }
.vr-layout--light .vr-outline-line { color: #999; }
.vr-layout--light .vr-outline-arrow { color: #999; }
.vr-layout--light .vr-outline-filter { background: #fff; color: #333; border-color: #ccc; }

/* History tab */
.vr-history-commits { font-size: 11px; font-family: monospace; }
.vr-history-commit { padding: 3px 0; border-bottom: 1px solid var(--vr-border); }
.vr-history-hash { color: #dcdcaa; }
.vr-history-date { color: var(--vr-fg-dimmer); }
.vr-layout--light .vr-history-hash { color: #8a6d3b; }

/* Blame view */
.vr-blame-msg { color: var(--vr-fg-dim); font-size: 12px; padding: 8px; }
.vr-blame-msg--error { color: #f44747; }
.vr-blame-btn {
  background: var(--vr-bg-tertiary); color: #9cdcfe; border: 1px solid var(--vr-border);
  border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; width: 100%; margin-top: 8px;
}
.vr-blame-btn:hover { border-color: var(--vr-accent); }
.vr-layout--light .vr-blame-btn { color: #0070c1; }

.vr-blame-table { font-size: 11px; font-family: monospace; max-height: 400px; overflow-y: auto; }
.vr-blame-header { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--vr-border); margin-bottom: 4px; }
.vr-blame-row { display: flex; gap: 8px; padding: 1px 0; }
.vr-blame-col { color: var(--vr-fg-dimmer); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-blame-col--line { width: 30px; }
.vr-blame-col--sha { width: 70px; }
.vr-blame-col--author { width: 90px; }
.vr-blame-col--date { width: 80px; }
.vr-blame-sha { color: #dcdcaa; }
.vr-blame-code { color: var(--vr-fg); white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.vr-layout--light .vr-blame-sha { color: #8a6d3b; }

/* Commit timeline */
.vr-commit-timeline { display: flex; align-items: flex-end; gap: 1px; height: 24px; padding: 4px 8px; }
.vr-commit-bar { flex: 1; background: var(--vr-bg-tertiary); border-radius: 1px; min-height: 2px; opacity: 0.3; }
.vr-commit-bar--active { background: #4ec9b0; opacity: 0.7; }

/* Flow tab */
.vr-flow-dep-label { font-size: 10px; color: var(--vr-fg-dim); text-transform: uppercase; }
.vr-flow-diagram {
  display: flex; flex-direction: column; align-items: center;
  padding: 12px 0 8px; margin-bottom: 8px; border-bottom: 1px solid var(--vr-border);
}
.vr-flow-node {
  padding: 4px 10px; border-radius: 4px; font-size: 11px; font-family: monospace;
  text-align: center; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.vr-flow-node--import { background: #1a2a3a; color: #4fc1ff; border: 1px solid rgba(79,193,255,0.2); }
.vr-flow-node--self { background: var(--vr-bg-tertiary); color: var(--vr-fg); border: 1px solid var(--vr-border); font-weight: bold; }
.vr-flow-node--export { background: #1a3a2a; color: #4ec9b0; border: 1px solid rgba(78,201,176,0.2); }
.vr-flow-ext { color: var(--vr-fg-dim); }
.vr-flow-callees { color: #dcdcaa; font-weight: normal; }
.vr-flow-connector { width: 1px; height: 12px; background: var(--vr-border); }
.vr-flow-arrow { color: var(--vr-fg-dimmer); font-size: 10px; }
.vr-flow-label { font-size: 9px; color: var(--vr-fg-dimmer); text-transform: uppercase; margin-bottom: 2px; }
.vr-flow-summary { font-size: 10px; color: var(--vr-fg-dimmer); text-align: center; padding: 0 0 6px; }

.vr-flow-graph-toggle-bar { display: flex; align-items: center; justify-content: flex-end; padding: 2px 8px 0; font-size: 10px; }
.vr-flow-graph-toggle {
  background: var(--vr-bg-tertiary); border: 1px solid var(--vr-border);
  color: var(--vr-fg-dim); border-radius: 3px; padding: 2px 8px; cursor: pointer;
  font-size: 10px; font-family: inherit;
}
.vr-flow-graph-toggle--active { background: rgba(0,122,204,0.15); border-color: rgba(0,122,204,0.33); color: var(--vr-accent); }
.vr-layout--light .vr-flow-node--import { background: #e8f4fd; color: #0070c1; border-color: #b3d7f0; }
.vr-layout--light .vr-flow-node--export { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
.vr-layout--light .vr-flow-callees { color: #8a6d3b; }

/* Cross-file info */
.vr-crossfile { padding: 8px 10px; border-bottom: 1px solid var(--vr-border); font-size: 11px; }
.vr-crossfile-circular {
  color: #f44747; font-size: 10px; margin-bottom: 6px; padding: 2px 6px;
  background: rgba(244,71,71,0.1); border-radius: 3px; border: 1px solid rgba(244,71,71,0.2);
}
.vr-crossfile-heading { color: var(--vr-fg-dim); text-transform: uppercase; font-size: 9px; margin-bottom: 4px; }
.vr-crossfile-link { color: #9cdcfe; padding: 2px 0; }
.vr-crossfile-link:hover { text-decoration: underline; }
.vr-crossfile-link--unresolved { color: var(--vr-fg-dimmer); }
.vr-crossfile-names { color: var(--vr-fg-dimmer); margin-left: 4px; }
.vr-crossfile-more { color: var(--vr-fg-dimmer); }
.vr-layout--light .vr-crossfile-link { color: #0070c1; }

/* Dependency graph */
.vr-dep-graph { border-bottom: 1px solid var(--vr-border); padding: 8px 0; }
.vr-dep-graph-toolbar {
  font-size: 10px; color: var(--vr-fg-dim); text-transform: uppercase;
  padding: 0 8px 6px; font-weight: 600; display: flex; align-items: center;
  gap: 8px; flex-wrap: wrap;
}
.vr-dep-graph-meta { color: var(--vr-fg-dimmer); font-weight: 400; }
.vr-dep-graph-zoom { color: var(--vr-fg-dim); font-size: 10px; min-width: 32px; text-align: center; }
.vr-dep-graph-btn {
  background: var(--vr-bg-tertiary); border: 1px solid var(--vr-border);
  color: var(--vr-fg-dim); border-radius: 3px; padding: 1px 8px;
  font-size: 10px; cursor: pointer;
}
.vr-dep-graph-btn:hover { border-color: var(--vr-accent); }
.vr-dep-graph-btn--active { background: rgba(0,122,204,0.15); border-color: var(--vr-accent); color: var(--vr-accent); }

/* Density bar */
.vr-density-bar {
  height: 18px; background: var(--vr-bg); margin: 0 8px 6px; border-radius: 3px;
  position: relative; overflow: hidden; cursor: pointer; border: 1px solid var(--vr-border);
}
.vr-density-viewport {
  position: absolute; top: 0; bottom: 0;
  background: rgba(255,255,255,0.06); border-left: 1px solid var(--vr-border); border-right: 1px solid var(--vr-border);
  pointer-events: none;
}
.vr-layout--light .vr-density-viewport { background: rgba(0,0,0,0.06); }
.vr-density-entity {
  position: absolute; top: 0; bottom: 0; opacity: 0.5; border-right: 1px solid var(--vr-bg-secondary);
  transition: opacity 0.15s;
}
.vr-density-entity--active {
  opacity: 1; box-shadow: 0 0 2px 1px var(--vr-accent); z-index: 1;
}
.vr-density-entity:hover { opacity: 0.8; }

/* ConceptTab group */
.vr-concept-group-header {
  font-size: 11px; font-weight: 600; padding: 6px 8px 2px; cursor: pointer;
  color: var(--vr-fg-dim); user-select: none; display: flex; gap: 4px; align-items: center;
}
.vr-concept-group-arrow { font-size: 9px; }
.vr-concept-collapse-btn {
  font-size: 9px; color: var(--vr-fg-dim); background: none; border: 1px solid var(--vr-border);
  border-radius: 3px; cursor: pointer; padding: 1px 4px;
}
.vr-concept-collapse-btn:hover { border-color: var(--vr-accent); }
.vr-concept-summary {
  font-size: 10px; color: var(--vr-fg-dimmer); padding: 4px 8px 2px;
}
.vr-concept-kind-filters {
  display: flex; gap: 3px; justify-content: center; margin-top: 3px; flex-wrap: wrap;
}
.vr-concept-kind-chip {
  cursor: pointer; padding: 0 4px; border-radius: 2px;
  color: var(--vr-fg-dim); background: transparent;
}
.vr-concept-kind-chip--active {
  background: var(--vr-input-bg); color: var(--vr-fg);
}

/* Jump tab */
.vr-jump-reason { padding: 0 10px 8px; font-size: 11px; color: var(--vr-fg-dimmer); }
.vr-jump-heading { font-size: 11px; color: var(--vr-fg-dim); padding: 4px 8px 2px; font-weight: 600; }
.vr-jump-overview { padding: 4px 8px; border-bottom: 1px solid var(--vr-border); }
.vr-jump-badge-out { color: #c586c0; border-color: rgba(197,134,192,0.33); }
.vr-jump-badge-in { color: #4ec9b0; border-color: rgba(78,201,176,0.33); }
.vr-layout--light .vr-jump-badge-out { color: #af00db; border-color: rgba(175,0,219,0.25); }
.vr-layout--light .vr-jump-badge-in { color: #16825d; border-color: rgba(22,130,93,0.25); }
.vr-jump-line-out { stroke: #c586c0; }
.vr-jump-line-in { stroke: #4ec9b0; }
.vr-jump-arrow-out-fill { fill: #c586c0; }
.vr-jump-arrow-in-fill { fill: #4ec9b0; }
.vr-layout--light .vr-jump-line-out { stroke: #af00db; }
.vr-layout--light .vr-jump-line-in { stroke: #16825d; }
.vr-layout--light .vr-jump-arrow-out-fill { fill: #af00db; }
.vr-layout--light .vr-jump-arrow-in-fill { fill: #16825d; }

/* Responsive layout */
@media (max-width: 900px) {
  .vr-activity-bar { width: 32px; }
  .vr-activity-btn { font-size: 14px; padding: 8px 0; }
  .vr-file-panel { min-width: 120px; }
  .vr-sidebar { min-width: 180px; }
  .vr-tab-item { padding: 0 6px 0 8px; font-size: 11px; }
  .vr-statusbar { font-size: 10px; }
  .vr-breadcrumb-bar { gap: 2px; }
  .vr-dep-graph-toolbar { flex-wrap: wrap; gap: 4px; }
}
@media (max-width: 640px) {
  .vr-layout { flex-direction: column; height: 100vh; }
  .vr-activity-bar { width: 100%; height: 32px; flex-direction: row; border-right: none; border-bottom: 1px solid var(--vr-border); overflow-x: auto; }
  .vr-activity-btn { padding: 4px 8px; }
  .vr-file-panel,
  .vr-entity-search-panel,
  .vr-heatmap-panel { display: none; }
  .vr-main-area { flex: 1; min-height: 0; }
  .vr-sidebar { min-width: 0; width: 100%; max-height: 40vh; border-right: none; border-top: 1px solid var(--vr-border); }
  .vr-editor-wrap { display: none; }
  .vr-breadcrumb-bar { display: none; }
}
`;
