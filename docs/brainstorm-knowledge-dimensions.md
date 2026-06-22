# Brainstorm: Knowledge Dimensions for Concept Cards & Design Panel

This document captures the brainstorm session defining what knowledge Vibe Reading should extract from code and present to users. It serves as the **guiding spec** for the enrichment workflow (SKILL.md).

## Core Principles

1. **Never directly fix data** — always refine the skill workflow so the agent generates the right content
2. **This is a template** — when processing any codebase, the agent should explore as many of these dimensions as the code supports
3. **Code-contextual** — every knowledge point must tie back to specific code. Not Wikipedia definitions, but "why is THIS here, what should YOU learn from it"
4. **Cross-language perspective** — always mention equivalent concepts in other languages (Java, Rust, Go, TypeScript, C++)

## Knowledge Hierarchy

```
Concept Card (per-entity knowledge)
├── Basic level (newcomers)
│   ├── Language features (dunder methods, decorators, type hints...)
│   ├── Core patterns (Facade, Strategy, Factory, Composition...)
│   ├── Data structures (deque, enum, dataclass...)
│   └── Framework basics (nn.Module, forward(), KV Cache...)
├── Advanced level (design-aware developers)
│   ├── Performance concepts (CUDA Graph, Flash Attention, Fusion...)
│   ├── Distributed concepts (Tensor Parallelism, All-Reduce, Actor...)
│   ├── Advanced patterns (Object Pool, Paged Memory, Descriptor...)
│   └── ML-specific (GQA, Continuous Batching, Prefill vs Decode...)
└── Embedded Gotcha (⚠️ inline warnings)
    └── Code-specific pitfalls (mutable+cache, stale hash, thread safety...)

Design Panel (per-entity or per-module design decisions)
├── Architecture choices (why Actor not Thread, why deque not PQ...)
├── Framework conventions (forward() hook design, weight_loader separation...)
├── Tradeoff discussions (memory vs speed, simplicity vs flexibility...)
└── Project structure (layer organization, config-driven arch...)
```

## Concept Card Knowledge Points (for enrichment agent guidance)

### Basic Level

| ID | Category | Knowledge Point | Key Elements to Include |
|----|----------|----------------|-------------------------|
| 1 | Language | Dunder Methods (__getitem__, __len__, __repr__) | Protocol methods, ecosystem integration, cross-lang (Java Iterable, Rust Index trait) |
| 2 | Language | @property (computed attributes) | Why derived values shouldn't be stored, freshness guarantee, cross-lang (C# get/set, Kotlin val) |
| 3 | Language | @dataclass(slots=True) | Memory savings mechanism, when to use, tradeoff (no dynamic attrs), cross-lang (C struct, Java record) |
| 4 | Language | Enum for state representation | Type safety vs strings/ints, IDE support, cross-lang (Rust enum, TS union) |
| 5 | Language | Context Manager (with statement) | Resource cleanup guarantee, __enter__/__exit__, cross-lang (Java try-with-resources, Rust Drop, Go defer) |
| 6 | Language | super().__init__() calling convention | Why required, consequences of not calling, MRO, cross-lang (Java auto-calls, C++ init list) |
| 7 | Language | __getstate__/__setstate__ (custom serialization) | When to customize pickle, excluding non-serializable fields |
| 8 | Language | Type Hints (Optional, Union, Dict) | Purpose (IDE + documentation), runtime not enforced, cross-lang (TS types, Rust types) |
| 9 | Language | if __name__ == "__main__" | Module vs script dual role, import guard |
| 10 | Language | __init__.py purpose | Package declaration, API aggregation, import control |
| 11 | Pattern | Facade Pattern | Name origin (building facade), why wrap, evolution (GoF → API Gateway), anti-pattern (too thick) |
| 12 | Pattern | Strategy Pattern (weight_loader) | Interchangeable algorithms, when to use, cross-lang |
| 13 | Pattern | Factory Function (get_rope, create_engine) | Why not direct construction, configuration convenience |
| 14 | Pattern | Composition over Inheritance | Composing objects vs extending classes, flexibility |
| 15 | Pattern | State Machine | Legal transitions, constraint enforcement, cross-lang |
| 16 | Pattern | Context Object | Bundling shared state, vs parameter threading, cross-lang (React Context, Go context.Context) |
| 17 | Data | deque vs list | Double-ended queue, O(1) both ends, when to use |
| 18 | Data | Reference Counting | Track owners, free at zero, vs GC tracing, cross-lang (Python/Swift RC, Java/Go tracing) |
| 19 | Engineering | Graceful Shutdown | Notify → wait → release, vs force kill, zombie prevention |
| 20 | Engineering | Idempotency | Operations safe to repeat, why important for automation |
| 21 | Engineering | Warmup / Lazy Initialization | Pay one-time cost upfront, JIT compilation, cache warming |
| 22 | Engineering | Benchmarking Pattern | Warmup runs → timed runs → statistics |
| 23 | Framework | nn.Module / nn.Parameter / register_buffer | Parameter (trainable) vs buffer (saved but not trained) |
| 24 | Framework | torch.no_grad() / inference_mode() | Disable gradient tracking, save memory in inference |
| 25 | ML | KV Cache | Avoid recomputing past tokens' attention, space-time tradeoff |
| 26 | ML | Autoregressive Generation | One token at a time, using all previous as context |
| 27 | ML | Temperature / Top-p Sampling | Controlling randomness and diversity in generation |
| 28 | ML | Embedding (discrete → continuous) | Lookup table, why needed, one-hot is too sparse |
| 29 | ML | Softmax | Normalize to probability distribution, numerical stability trick |
| 30 | ML | Residual Connection | gradient flow through addition, enabling deep networks |
| 31 | Tensor | Broadcasting | Auto-expansion rules, align from right, dimension-1 expands |

### Advanced Level

| ID | Category | Knowledge Point | Key Elements to Include |
|----|----------|----------------|-------------------------|
| 32 | Pattern | Object Pool | Pre-allocate + return-not-destroy, GPU memory, cross-lang (Go sync.Pool, Java ThreadPool) |
| 33 | Pattern | Actor Pattern | Isolated execution, message-only communication, no shared state, cross-lang (Erlang, Akka, Go channels) |
| 34 | Distributed | Tensor Parallelism (Column/Row) | Weight matrix splitting, Megatron pattern, all-reduce at boundaries |
| 35 | Distributed | All-Reduce | Collective communication, every device contributes and receives sum |
| 36 | Distributed | Zero-Copy IPC | Shared memory avoids serialization, fastest IPC for large data |
| 37 | GPU | CUDA Graph | Record ops, replay without CPU launch overhead, fixed-shape requirement |
| 38 | GPU | Flash Attention | O(N) memory vs O(N²), online softmax, tiled computation |
| 39 | GPU | Operator Fusion | Combine small kernels into one, reduce memory traffic |
| 40 | GPU | Triton Kernel | Write GPU kernels in Python, compile to PTX |
| 41 | ML | Paged Memory / KV Cache | OS page tables applied to GPU, fixed-size blocks, indirection |
| 42 | ML | Grouped Query Attention (GQA) | Fewer KV heads than Q heads, reduces KV cache size |
| 43 | ML | Continuous Batching | Add new requests mid-generation, maximize GPU utilization |
| 44 | ML | Prefill vs Decode phases | Different optimizations for each, parallel vs sequential |
| 45 | ML | Weight Tying | Share embedding and output projection, halve vocab parameters |
| 46 | Language | Descriptor Protocol | __get__/__set__, how @property works underneath |
| 47 | Tensor | In-place Operations | Avoid allocation but conflicts with autograd |
| 48 | Tensor | View vs Copy | Shared underlying data, when contiguous() needed |
| 49 | Pattern | Event Loop | Infinite poll-dispatch loop, cross-lang (Node.js, asyncio) |

### Embedded Gotcha (⚠️ in concept cards)

- Mutable data + cached hash → stale hash after mutation
- Python hash() not stable across processes → use hashlib
- Manual refcount without weakref → leaks if cycle exists
- Direct forward() call skips hooks → use module(input)
- In-place op on leaf tensor → autograd breaks silently
- __slots__ prevents dynamic attributes → monkey patching fails

## Design Panel Knowledge Points

| ID | Design Decision | Discussion Points |
|----|-----------------|-------------------|
| D1 | Why Actor (separate process) for ModelRunner | GIL prevents thread parallelism, process isolation, shared memory for speed |
| D2 | Why enum state not boolean flags | Illegal state prevention, exhaustive matching, clarity |
| D3 | PyTorch forward() hook architecture | __call__ adds pre/post hooks, grad tracking, mode switching |
| D4 | weight_loader separation from __init__ | Model construction vs weight loading are different lifecycle phases |
| D5 | Why deque not priority queue for scheduler | FCFS fairness, O(1) preemption reinsertion, simplicity |
| D6 | Why global Context not parameter passing | 10+ params threading through deep call stacks is worse |
| D7 | Pre-Norm vs Post-Norm choice | Training stability, modern default, historical evolution |
| D8 | Prefix Caching design | When useful (shared system prompts), hash-based lookup |
| D9 | shared_memory vs pipe/socket | Zero-copy for tensors, no serialization, fastest for large data |
| D10 | Fixed block_size for KV cache | Simplicity, no fragmentation, predictable allocation |
| D11 | Event loop vs per-request call for ModelRunner | Batching requirement, amortize overhead |
| D12 | BlockManager separate from Sequence | Single responsibility, centralized pool management |
| D13 | Layered architecture (layers/ → models/ → engine/) | Abstraction levels, reusability, testing isolation |
| D14 | Config-driven architecture | Same code for different model sizes, no hardcoding |

## How This Guides the Workflow

The enrichment agent (enrich.ts / SKILL.md) should:

1. **For each entity**, identify which knowledge dimensions from this table are present in the code
2. **Generate teaches** that are contextualized: "this code uses X because Y" not just "X is..."
3. **Include rationale**: why used here, what if not used, when NOT to use
4. **Cross-language**: mention equivalents so polyglot users can connect
5. **Gotcha**: if there's a pitfall, embed it with ⚠️
6. **Level assignment**: basic = anyone can learn, advanced = needs programming experience
7. **Design decisions** go to design panel, not concept card — the "why choose this approach" discussion

## Panel Architecture

### Panel 1: Concept (DONE — carries knowledge + design)
- Per-entity cards with all brainstormed content (concepts, design decisions, gotchas)
- Basic/Advanced filter toggle
- Teaches tooltips with explanations
- Code editor (Monaco) on center panel shows source with card highlighting

### Panel 2: Flow (Call Chain Visualization)
**Purpose**: Show the invoke chain — how functions/classes call each other across files.

**Layout change**: When Flow tab is active, **replace the Monaco code editor** with a **canvas/graph panel**.

**Visual design**:
- Entity = node block (small rectangle with name)
- Class = virtual container grouping its methods
- File = larger bounding box grouping its classes
- Arrows = call relationships (A calls B)
- Color = architectural layer (layers/, engine/, models/)

**Key interaction**: **Flow chain segmentation**
- Automatically segment the full call graph into named "typical flows":
  - "Bootstrap" — system initialization sequence
  - "Request Handling" — from user input to first token
  - "Decode Step" — one iteration of autoregressive generation
  - "Preemption" — resource reclamation when memory is full
  - "Shutdown" — graceful exit sequence
- Top bar shows flow chips; clicking one highlights that path, fades others to 20%
- Default: show all flows

**Data pipeline** (new tool needed):
1. TreeSitter: extract all call expressions + function definitions
2. Import resolution: map cross-file calls to their definitions
3. Build directed call graph
4. Flow segmentation: identify entry points (main, API handlers), DFS/BFS to find typical paths
5. Agent enrichment: name and describe each flow chain

**Reference**: understand-anything uses similar graph visualization with architecture layers and guided tours.
Differentiator: our flow-chain segmentation + highlight is unique.

### Panel 3: History (Code Evolution)
**Purpose**: Understand how code got to its current state — creation, modifications, purpose of changes.

**Core user questions**:
1. "Is this code stable?" — last modification time, activity level
2. "How did it evolve?" — key turning points, refactoring history
3. "Who owns it?" — primary author, expertise mapping
4. "Why was it changed so many times?" — bug-prone vs actively iterated

**Data source**: Git history (`git log --follow`, `git blame -L`, `git log --diff-filter=A`)

**Analysis tool**: `analyze-history.ts` (new CLI)
- Input: project root + .vibe-reading entity list
- Output: `.vibe-reading/history/<file>.json`

**Per-entity data structure**:
```json
{
  "name": "Scheduler",
  "line_range": [8, 100],
  "created": {"commit": "abc123", "author": "alice", "date": "2024-01-15", "message": "Initial scheduler"},
  "last_modified": {"commit": "def456", "author": "bob", "date": "2024-06-20", "message": "Add preemption"},
  "modification_count": 8,
  "authors": ["alice", "bob"],
  "primary_author": "alice",
  "activity": "medium",
  "key_changes": [
    {"commit": "ghi789", "date": "2024-03-10", "message": "Refactor preemption", "significance": "major"}
  ],
  "age_days": 524,
  "churn_rate": 0.3
}
```

**UI elements**:
- Timeline visualization (dots on line, each = a commit)
- Activity indicator: 🔥 Active / ⚡ Recent / 💤 Stable
- Author breakdown (pie or bar)
- Key changes list with commit messages

**Interactions**:
- Click timeline dot → Monaco shows code at that commit (git show)
- Click key change → show diff
- Hover entity → highlight in editor (same as Concept)
- Color coding by activity level

**Value**: Quickly judge code stability, find owners, understand design evolution.

### Panel 4: Jump (Dependencies & Navigation)
**Purpose**: Understand relationships — who imports what, who uses what, and provide intelligent navigation recommendations.

**Core user questions**:
1. "Where is this class used?" — find all consumers
2. "If I change this, what breaks?" — impact analysis
3. "What does this file depend on?" — prerequisites
4. "What related code should I read together?" — reading path

**Data source**: TreeSitter (imports, class inheritance, function calls, type annotations)

**Analysis tool**: `analyze-deps.ts` (new CLI)
- Input: project root + all source files
- Output: `.vibe-reading/deps/graph.json`

**Data structure**:
```json
{
  "files": {
    "scheduler.py": {
      "imports": ["block_manager", "sequence"],
      "imported_by": ["llm_engine"],
      "exports": ["Scheduler"]
    }
  },
  "entities": {
    "scheduler.py::Scheduler": {
      "uses": ["BlockManager", "Sequence"],
      "used_by": ["LLMEngine.__init__", "LLMEngine.step"],
      "inherits": [],
      "inherited_by": []
    }
  },
  "modules": [
    {"name": "Engine Core", "files": ["llm_engine.py", "scheduler.py", "..."], "description": "..."}
  ]
}
```

**UI elements**:
- Dependencies section (what this file imports) with [→ jump] links
- Dependents section (who imports this file) with [→ jump] links
- Per-entity: Uses / Used-by lists
- "Related reading" recommendations (agent-generated reading order)
- Impact analysis mode: "If you change X, these are affected..."

**Interactions**:
- [→ jump] links: click to navigate to that file/entity
- Entity selection changes the Uses/Used-by view
- Impact analysis button: shows transitive dependents

**Value**: Understand code neighborhood, navigate efficiently, assess change impact, get reading order suggestions.

### Panel Design Principles

1. **Each panel answers a different question**:
   - Concept: "What can I learn here?"
   - Flow: "How does execution move through the system?"
   - History: "How did this evolve over time?"
   - Jump: "What is connected to what?"

2. **Panels share entity selection** — clicking an entity in any panel should highlight it in all others

3. **Center panel adapts**: Concept/History/Jump use Monaco editor; Flow uses canvas graph

4. **Data is pre-computed** — each panel has its own analysis step in the pipeline (like analyze.ts for AST)

## Concept Illustrations (Manim + SVG)

### When to Generate Illustrations

The enrichment agent should evaluate each entity: "Would a diagram make this concept significantly clearer?" Generate illustrations for:
- Matrix operations (tensor parallelism splits, attention computation)
- Memory layouts (paged KV cache, block tables, physical/logical mapping)
- Communication topologies (all-reduce, ring communication)
- State transitions (state machines, lifecycle flows)
- Architectural diagrams (layer composition, module relationships)
- Algorithm visualizations (flash attention tiling, object pool lifecycle)

Do NOT generate illustrations for:
- Simple one-liner concepts (what @property does)
- Pure text-explainable patterns (facade pattern definition)
- Trivial data structures (what a list is)

### Tool Selection (Agent Decides)

| Complexity | Tool | Output |
|-----------|------|--------|
| Simple (boxes + arrows, state machines) | Node.js SVG generation | .svg file |
| Complex (matrix operations, data flow, animations) | Manim (Python) | .png or .svg |

### Pipeline Integration

```
Step 3.5: Illustration Generation (after deep enrichment)
├── Agent reads enriched entities
├── For each entity, decides: needs illustration? → yes/no
├── If yes:
│   ├── Simple → write SVG generation script → run → save .svg
│   └── Complex → write Manim scene → render → save .png/.svg
├── Store in: .vibe-reading/illustrations/<file-path>__<entity-name>.svg
└── Viewer renders <img> in card when illustration file exists
```

### Reference Implementation

See `gemm_sp_paper/figures/src/prepack-mapping.js` for SVG generation pattern:
- Define color palette
- Build SVG string with rectangles, arrows, text labels
- Write to output file

For Manim: standard `Scene` subclass with `self.play()` animations rendered to image.
