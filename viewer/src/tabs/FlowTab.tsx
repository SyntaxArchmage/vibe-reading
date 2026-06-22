import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { DataEntity, FlowDataType, FlowNode, FlowEdge } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  hoveredEntity?: DataEntity | null;
  onCardHover?: (entity: DataEntity | null) => void;
  sourceLines?: string[];
  flowData?: FlowDataType;
  currentFile?: string | null;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: FlowNode;
  layer: number;
}

const NODE_W = 160;
const NODE_H = 36;
const LAYER_GAP_X = 200;
const NODE_GAP_Y = 52;
const PADDING = 60;

function layoutGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  filterFile?: string | null
): { layoutNodes: LayoutNode[]; layoutEdges: { from: LayoutNode; to: LayoutNode; edge: FlowEdge }[] } {
  // Filter nodes relevant to current file (and their direct connections)
  const fileNodes = filterFile
    ? new Set(nodes.filter(n => n.file === filterFile).map(n => n.id))
    : new Set(nodes.map(n => n.id));

  // Include connected nodes (1-hop)
  const connectedNodes = new Set(fileNodes);
  for (const edge of edges) {
    if (fileNodes.has(edge.from)) connectedNodes.add(edge.to);
    if (fileNodes.has(edge.to)) connectedNodes.add(edge.from);
  }

  const visibleNodes = nodes.filter(n => connectedNodes.has(n.id));
  const visibleEdges = edges.filter(e => connectedNodes.has(e.from) && connectedNodes.has(e.to));

  if (visibleNodes.length === 0) return { layoutNodes: [], layoutEdges: [] };

  // Topological layering (BFS from roots)
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const n of visibleNodes) {
    incoming.set(n.id, new Set());
    outgoing.set(n.id, new Set());
  }
  for (const e of visibleEdges) {
    incoming.get(e.to)?.add(e.from);
    outgoing.get(e.from)?.add(e.to);
  }

  const layers = new Map<string, number>();
  const queue: string[] = [];

  // Start from nodes with no incoming
  for (const n of visibleNodes) {
    if ((incoming.get(n.id)?.size || 0) === 0) {
      layers.set(n.id, 0);
      queue.push(n.id);
    }
  }

  // BFS to assign layers
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLayer = layers.get(cur) || 0;
    for (const next of outgoing.get(cur) || []) {
      const existing = layers.get(next);
      if (existing === undefined || existing < curLayer + 1) {
        layers.set(next, curLayer + 1);
        queue.push(next);
      }
    }
  }

  // Assign layer 0 to any unassigned (cycles)
  for (const n of visibleNodes) {
    if (!layers.has(n.id)) layers.set(n.id, 0);
  }

  // Group by layer
  const layerGroups = new Map<number, FlowNode[]>();
  for (const n of visibleNodes) {
    const layer = layers.get(n.id) || 0;
    const group = layerGroups.get(layer) || [];
    group.push(n);
    layerGroups.set(layer, group);
  }

  // Position nodes
  const nodeMap = new Map<string, LayoutNode>();
  for (const [layer, group] of layerGroups) {
    const x = PADDING + layer * LAYER_GAP_X;
    const totalHeight = group.length * NODE_GAP_Y;
    const startY = PADDING + Math.max(0, (400 - totalHeight) / 2);

    for (let i = 0; i < group.length; i++) {
      const n = group[i];
      const y = startY + i * NODE_GAP_Y;
      const ln: LayoutNode = { id: n.id, x, y, width: NODE_W, height: NODE_H, node: n, layer };
      nodeMap.set(n.id, ln);
    }
  }

  const layoutNodes = Array.from(nodeMap.values());
  const layoutEdges = visibleEdges
    .map(e => {
      const from = nodeMap.get(e.from);
      const to = nodeMap.get(e.to);
      if (from && to) return { from, to, edge: e };
      return null;
    })
    .filter(Boolean) as { from: LayoutNode; to: LayoutNode; edge: FlowEdge }[];

  return { layoutNodes, layoutEdges };
}

export function FlowTab({ flowData, currentFile }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<number>(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!flowData) return { layoutNodes: [], layoutEdges: [] };
    return layoutGraph(flowData.nodes, flowData.edges, currentFile);
  }, [flowData, currentFile]);

  const segmentPath = useMemo(() => {
    if (!flowData || flowData.segments.length === 0) return new Set<string>();
    const seg = flowData.segments[selectedSegment];
    return seg ? new Set(seg.path) : new Set<string>();
  }, [flowData, selectedSegment]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const { from, to, edge } of layoutEdges) {
      const fromX = from.x + from.width;
      const fromY = from.y + from.height / 2;
      const toX = to.x;
      const toY = to.y + to.height / 2;

      const inSegment = segmentPath.has(from.id) && segmentPath.has(to.id);
      const isHovered = hoveredNode === from.id || hoveredNode === to.id;

      ctx.beginPath();
      ctx.strokeStyle = inSegment ? "#4ec9b0" : isHovered ? "#007acc88" : "#444";
      ctx.lineWidth = inSegment ? 2 : 1;
      ctx.setLineDash(edge.type === "instantiate" ? [4, 3] : []);

      // Bezier curve
      const cx = (fromX + toX) / 2;
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(cx, fromY, cx, toY, toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow
      const angle = Math.atan2(toY - fromY, toX - cx);
      ctx.beginPath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - 8 * Math.cos(angle - 0.3), toY - 8 * Math.sin(angle - 0.3));
      ctx.lineTo(toX - 8 * Math.cos(angle + 0.3), toY - 8 * Math.sin(angle + 0.3));
      ctx.fill();
    }

    // Draw nodes
    for (const ln of layoutNodes) {
      const inSegment = segmentPath.has(ln.id);
      const isHovered = hoveredNode === ln.id;
      const isFileLocal = ln.node.file === currentFile;

      ctx.beginPath();
      ctx.roundRect(ln.x, ln.y, ln.width, ln.height, 6);

      if (inSegment) {
        ctx.fillStyle = "#1a2a2a";
        ctx.strokeStyle = "#4ec9b0";
        ctx.lineWidth = 2;
      } else if (isHovered) {
        ctx.fillStyle = "#1a2332";
        ctx.strokeStyle = "#007acc";
        ctx.lineWidth = 2;
      } else if (isFileLocal) {
        ctx.fillStyle = "#252526";
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
      } else {
        ctx.fillStyle = "#1e1e1e";
        ctx.strokeStyle = "#3c3c3c";
        ctx.lineWidth = 1;
      }

      ctx.fill();
      ctx.stroke();

      // Node label
      const label = ln.node.class
        ? `${ln.node.class}.${ln.node.name}`
        : ln.node.name;
      const displayLabel = label.length > 20 ? label.slice(0, 18) + "…" : label;

      ctx.font = "11px 'Cascadia Code', Consolas, monospace";
      ctx.fillStyle = inSegment ? "#4ec9b0" : isFileLocal ? "#ccc" : "#888";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayLabel, ln.x + ln.width / 2, ln.y + ln.height / 2);

      // Kind indicator
      const kindColor = ln.node.kind === "method" ? "#4ec9b0" : ln.node.kind === "class" ? "#dcdcaa" : "#9cdcfe";
      ctx.fillStyle = kindColor;
      ctx.fillRect(ln.x, ln.y, 3, ln.height);
    }

    ctx.restore();
  }, [layoutNodes, layoutEdges, offset, zoom, hoveredNode, segmentPath, currentFile]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - offset.x) / zoom;
    const my = (e.clientY - rect.top - offset.y) / zoom;

    let found: string | null = null;
    for (const ln of layoutNodes) {
      if (mx >= ln.x && mx <= ln.x + ln.width && my >= ln.y && my <= ln.y + ln.height) {
        found = ln.id;
        break;
      }
    }
    setHoveredNode(found);
  }, [layoutNodes, offset, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  if (!flowData || layoutNodes.length === 0) {
    return (
      <div className="vr-no-cards">
        <p>No flow data available.</p>
        <p style={{ fontSize: "11px", opacity: 0.6 }}>
          Run: <code>npx tsx extract-flow.ts &lt;project&gt;</code>
        </p>
      </div>
    );
  }

  return (
    <div className="vr-flow-panel">
      <style>{flowStyles}</style>

      {/* Segment selector */}
      {flowData.segments.length > 0 && (
        <div className="vr-flow-segments">
          {flowData.segments.map((seg, i) => (
            <button
              key={i}
              className={`vr-flow-seg-btn ${i === selectedSegment ? "vr-flow-seg-btn--active" : ""}`}
              onClick={() => setSelectedSegment(i)}
              title={seg.description}
            >
              {seg.name}
            </button>
          ))}
          <button
            className={`vr-flow-seg-btn ${selectedSegment === -1 ? "vr-flow-seg-btn--active" : ""}`}
            onClick={() => setSelectedSegment(-1)}
          >
            All
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="vr-flow-canvas-wrap"
        onMouseDown={(e) => { dragging.current = true; dragStart.current = { x: e.clientX, y: e.clientY }; }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="vr-flow-canvas" />
      </div>

      {/* Info bar */}
      <div className="vr-flow-info">
        <span>{layoutNodes.length} nodes</span>
        <span>{layoutEdges.length} edges</span>
        <span>{Math.round(zoom * 100)}%</span>
        {hoveredNode && (
          <span className="vr-flow-info-node">
            {layoutNodes.find(n => n.id === hoveredNode)?.node.class
              ? `${layoutNodes.find(n => n.id === hoveredNode)!.node.class}.${layoutNodes.find(n => n.id === hoveredNode)!.node.name}`
              : layoutNodes.find(n => n.id === hoveredNode)?.node.name}
          </span>
        )}
      </div>
    </div>
  );
}

const flowStyles = `
  .vr-flow-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .vr-flow-segments {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    border-bottom: 1px solid #333;
  }

  .vr-flow-seg-btn {
    padding: 3px 10px;
    background: rgba(78, 201, 176, 0.06);
    border: 1px solid #3c3c3c;
    border-radius: 12px;
    color: #888;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .vr-flow-seg-btn:hover {
    color: #ccc;
    border-color: #555;
  }

  .vr-flow-seg-btn--active {
    color: #4ec9b0;
    border-color: #4ec9b0;
    background: rgba(78, 201, 176, 0.12);
  }

  .vr-flow-canvas-wrap {
    flex: 1;
    overflow: hidden;
    cursor: grab;
    position: relative;
  }

  .vr-flow-canvas-wrap:active {
    cursor: grabbing;
  }

  .vr-flow-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .vr-flow-info {
    display: flex;
    gap: 12px;
    padding: 4px 10px;
    font-size: 10px;
    color: #666;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }

  .vr-flow-info-node {
    color: #4ec9b0;
    font-family: 'Cascadia Code', Consolas, monospace;
    margin-left: auto;
  }
`;
