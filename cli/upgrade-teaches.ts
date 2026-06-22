/**
 * Upgrade existing teaches entries to include rationale, cross_lang, gotcha fields.
 * Uses a knowledge-base approach: maps common concept tags to their cross-language
 * equivalents and common gotchas.
 *
 * Usage: npx tsx upgrade-teaches.ts <project-root>
 */
import * as fs from "fs";
import * as path from "path";
import type { FileAnalysis } from "./types.js";

interface TeachEntry {
  tag: string;
  explain: string;
  rationale?: string;
  cross_lang?: string;
  gotcha?: string;
}

interface ConceptKnowledge {
  cross_lang?: string;
  gotcha?: string;
}

const CONCEPT_KNOWLEDGE: Record<string, ConceptKnowledge> = {
  // Python language features
  "__slots__": {
    cross_lang: "C struct (fixed fields), Java record, Rust (all structs fixed by default), Go struct",
    gotcha: "Cannot add attributes dynamically; breaks pickle by default — implement __getstate__/__setstate__"
  },
  "Enum": {
    cross_lang: "Rust enum, Java enum, TypeScript const enum / union type, C++ enum class, Go iota",
    gotcha: "Python enums are singletons — comparison must use 'is' not '=='; subclassing is restricted"
  },
  "Enum for State": {
    cross_lang: "Rust enum (can carry data per variant), TypeScript union types, Java enum, Swift enum with associated values",
    gotcha: "Adding a new state later requires updating every switch/match — use exhaustive matching"
  },
  "@dataclass": {
    cross_lang: "Kotlin data class, Scala case class, Rust #[derive(Debug, Clone)], TypeScript interface + factory",
    gotcha: "Mutable default fields (list/dict) must use field(default_factory=...) or they share state"
  },
  "Configuration Dataclass": {
    cross_lang: "Kotlin data class, Rust config struct with serde, Go struct with json tags, TypeScript zod schema",
    gotcha: "Nested mutable defaults are shared across instances — always use field(default_factory=...)"
  },
  "@property": {
    cross_lang: "C# properties (get/set), Kotlin var with custom getter, Ruby attr_accessor, Java getter/setter",
    gotcha: "Heavy computation in a property looks like attribute access — callers wont expect it to be slow"
  },
  "Generator": {
    cross_lang: "Rust Iterator trait, Java Stream, C# IEnumerable/yield, Go channels, JavaScript function*",
    gotcha: "Generator state is consumed on iteration — cannot rewind. StopIteration propagates silently in comprehensions"
  },
  "Context Manager": {
    cross_lang: "Java try-with-resources, C# using statement, Rust Drop trait, Go defer",
    gotcha: "Exceptions in __exit__ can suppress the original exception if you return True"
  },
  "Decorator": {
    cross_lang: "Java annotations + AOP, TypeScript decorators, Rust proc_macro_attribute, C# attributes",
    gotcha: "Decorated function loses its original name/docstring — use @functools.wraps"
  },
  "Type Hints": {
    cross_lang: "TypeScript types, Rust types (enforced), Java generics, Go generics (1.18+)",
    gotcha: "Python type hints are NOT enforced at runtime — they're for tooling only. Use runtime validators like pydantic for enforcement"
  },

  // Design patterns
  "Object Pool": {
    cross_lang: "Java ThreadPoolExecutor / Apache Commons Pool, Go sync.Pool, Rust arena allocators, C++ boost::object_pool",
    gotcha: "Pool exhaustion under load requires strategy: block, grow, or reject. Stale objects must be health-checked"
  },
  "State Machine": {
    cross_lang: "Rust typestate pattern (compile-time states), Java State Pattern (GoF), TypeScript discriminated unions",
    gotcha: "Implicit states (boolean flags) allow impossible combinations — always make states explicit and transitions validated"
  },
  "Facade Pattern": {
    cross_lang: "Java Spring @Service classes, Go handler structs, TypeScript service classes, Rust public module API",
    gotcha: "Facade can become a God Object if it accumulates too many responsibilities — split by domain"
  },
  "Actor Pattern": {
    cross_lang: "Erlang/Elixir processes, Akka actors (Java/Scala), Go goroutines+channels, Rust actix",
    gotcha: "Unbounded mailbox/queue leads to OOM under pressure — always set capacity limits and back-pressure"
  },
  "Factory Function": {
    cross_lang: "Java static factory method, Rust ::new() convention, Go NewXxx() functions, TypeScript create functions",
    gotcha: "Over-abstracting with factories hides what's being created — use only when construction logic is non-trivial"
  },
  "Strategy Pattern": {
    cross_lang: "Java interfaces + dependency injection, Rust trait objects / generics, Go interfaces, TypeScript type parameter",
    gotcha: "Too many strategies with nearly identical code — consider template method or parameterization instead"
  },
  "Registry Pattern": {
    cross_lang: "Java ServiceLoader, Rust inventory crate, Go init() registration, TypeScript DI containers",
    gotcha: "Runtime registration means typos in names fail at runtime not compile time — consider compile-time registration"
  },

  // Data structures & algorithms
  "Reference Counting": {
    cross_lang: "Rust Rc<T>/Arc<T>, Swift ARC, Objective-C retain/release, C++ shared_ptr, Python default GC",
    gotcha: "Circular references leak memory — need weak references (weakref in Python, Weak<T> in Rust) to break cycles"
  },
  "Content-Addressable Storage": {
    cross_lang: "Git object store, Docker layers, IPFS, Rust content-addressed crates, Nix store paths",
    gotcha: "Hash collisions (however rare) can cause silent data corruption — use cryptographic hashes for critical data"
  },
  "Paged Memory": {
    cross_lang: "OS virtual memory (page tables), Java DirectByteBuffer pages, Rust mmap, Database B-tree pages",
    gotcha: "Internal fragmentation wastes the unused portion of the last page — tune page size to workload"
  },
  "Pre-allocation": {
    cross_lang: "C malloc + placement, Java ArrayList(initialCapacity), Rust Vec::with_capacity, Go make([]T, 0, n)",
    gotcha: "Over-allocation wastes memory; under-allocation causes reallocation. Profile actual usage to size correctly"
  },
  "Deterministic Hashing": {
    cross_lang: "Java Objects.hash (order-dependent), Rust Hash trait, Go maphash, C++ std::hash",
    gotcha: "Hash randomization (Python 3.3+) means hash() values differ between runs — use hashlib for persistence"
  },
  "Object Recycling": {
    cross_lang: "Java object reuse patterns, Rust mem::replace, Go sync.Pool, C++ placement new",
    gotcha: "Forgetting to reset ALL fields leaves stale state from previous use — prefer explicit reset() methods"
  },
  "Ring Buffer": {
    cross_lang: "Java ArrayDeque, Rust VecDeque, Go container/ring, C++ boost::circular_buffer",
    gotcha: "Fixed size means old data is silently overwritten — caller must check if full before write or accept loss"
  },
  "LRU Cache": {
    cross_lang: "Java LinkedHashMap(accessOrder=true), Rust lru crate, Go hashicorp/golang-lru, C++ custom with list+map",
    gotcha: "Unbounded cache grows forever — always set max_size. Thread safety requires synchronization on every access"
  },

  // Engineering practices
  "Benchmarking Pattern": {
    cross_lang: "Rust criterion crate, Go testing.B, Java JMH, C++ Google Benchmark",
    gotcha: "Without warmup, JIT/cache effects make first runs artificially slow — always discard initial iterations"
  },
  "Zero-State Initialization": {
    cross_lang: "Rust Default trait, Go zero values, Java default constructors, C++ value initialization",
    gotcha: "Zero state must be distinguishable from 'not yet initialized' — consider Option/Optional pattern"
  },
  "Separation of Config from Code": {
    cross_lang: "Java Spring @ConfigurationProperties, Rust config crate, Go viper, TypeScript dotenv + zod",
    gotcha: "Config sprawl — too many knobs makes system impossible to understand. Provide sensible defaults"
  },
  "Example-Driven Documentation": {
    cross_lang: "Rust doc tests (run in CI), Go Example functions, Python doctest, Java JUnit as docs",
    gotcha: "Examples rot when code changes — only CI-tested examples stay accurate"
  },
  "Defensive Copy": {
    cross_lang: "Java Collections.unmodifiableList, Rust Clone trait, Go copy(), C++ copy constructor",
    gotcha: "Deep copy is expensive for large structures — consider copy-on-write or immutable data structures"
  },
  "Assertion / Validation": {
    cross_lang: "Rust assert! / debug_assert!, Java assert / Preconditions.check, Go if err pattern, C assert()",
    gotcha: "Python assert statements are stripped with -O flag — never use for input validation in production"
  },
  "Lazy Initialization": {
    cross_lang: "Rust OnceCell/LazyCell, Java Supplier + memoize, Go sync.Once, Kotlin lazy delegate",
    gotcha: "In multithreaded code, lazy init without synchronization causes race conditions — use thread-safe variants"
  },

  // ML/GPU specific
  "CUDA Graph": {
    cross_lang: "Metal command buffers (Apple), Vulkan command buffers, DirectX command lists, OpenCL command queues",
    gotcha: "Only works with fixed tensor shapes — dynamic shapes (variable-length prefill) cannot use graphs"
  },
  "Flash Attention": {
    cross_lang: "Hardware-specific: CUDA (FlashAttention), Metal (MLX attention), no direct CPU equivalent",
    gotcha: "Requires specific GPU architectures (Ampere+). Custom attention masks may not be supported"
  },
  "Tensor Parallelism": {
    cross_lang: "MPI collective ops (any language), Horovod (Python/C++), DeepSpeed (Python), Megatron-LM",
    gotcha: "Communication overhead dominates for small tensors — only beneficial when model layers are large enough"
  },
  "Continuous Batching": {
    cross_lang: "No direct equivalent — LLM serving specific. Conceptually similar to OS process scheduling",
    gotcha: "Preemption priority must be carefully tuned — aggressive preemption wastes computed tokens"
  },
  "KV Cache Management": {
    cross_lang: "Conceptually similar to CPU cache management, database buffer pool, OS page cache",
    gotcha: "Cache fragmentation reduces effective GPU memory — paged attention (vLLM's key insight) solves this"
  },
  "Content Hashing": {
    cross_lang: "Git content-addressed objects, Docker layer caching, Nix derivation hashing, Rust cargo fingerprinting",
    gotcha: "Hash computation cost must be amortized — only worthwhile if duplicates are common enough"
  },
  "Prefix Caching": {
    cross_lang: "Trie-based caching (any language), HTTP conditional GET (ETag), memoization with partial key",
    gotcha: "Cache invalidation when model weights change — must version-key the cache"
  },
  "Greedy Scheduling": {
    cross_lang: "OS CPU scheduler (CFS), Go goroutine scheduler, Java ForkJoinPool work stealing",
    gotcha: "Greedy can starve long-running requests — need fairness bounds or priority aging"
  },

  // Composition / Architecture
  "Composition over Inheritance": {
    cross_lang: "Go interfaces + embedding, Rust traits + composition, TypeScript interfaces + mixins, Java delegation",
    gotcha: "Too much composition leads to 'lasagna code' — many thin layers that are hard to trace through"
  },
  "Logical-Physical Mapping": {
    cross_lang: "OS virtual memory (page tables), database logical/physical record IDs, filesystem inode→block mapping",
    gotcha: "Indirection adds lookup overhead — only worthwhile when remapping is actually needed"
  },
  "Minimal Valid State": {
    cross_lang: "Rust builder pattern (compile-time enforcement), Java Builder + required fields, Go functional options",
    gotcha: "Dont do heavy I/O in constructors — use factory methods for expensive setup"
  },
  "Hook / Event System": {
    cross_lang: "Java EventListener, Rust callbacks/closures, Go channels for events, C# events/delegates",
    gotcha: "Listener leaks — forgetting to unregister causes memory leaks and unexpected behavior"
  },
  "Weight Loading Separation": {
    cross_lang: "Java two-phase init (construct + configure), Rust Builder pattern, Go functional options",
    gotcha: "Partial loading (some weights missing) must be detected and reported, not silently ignored"
  },
};

function inferRationale(entity: Record<string, unknown>, tag: string): string | undefined {
  const name = (entity.name as string) || "";
  const description = (entity.description as string) || "";
  const why = (entity.why as string) || "";
  
  if (why && why.length > 20) {
    return `Used here because: ${why}`;
  }
  
  if (description && description.length > 30) {
    const first = description.split(/[.!]/).filter(s => s.trim().length > 10)[0];
    if (first) return first.trim();
  }
  
  return undefined;
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function findKnowledge(tag: string): ConceptKnowledge | undefined {
  if (CONCEPT_KNOWLEDGE[tag]) return CONCEPT_KNOWLEDGE[tag];
  
  const normalized = normalizeTag(tag);
  for (const [key, val] of Object.entries(CONCEPT_KNOWLEDGE)) {
    if (normalizeTag(key) === normalized) return val;
    if (normalized.includes(normalizeTag(key)) || normalizeTag(key).includes(normalized)) return val;
  }
  return undefined;
}

function upgradeFile(jsonPath: string): { upgraded: number; total: number } {
  const analysis: FileAnalysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  let upgraded = 0;
  
  for (const entity of analysis.entities) {
    const detail = entity.detail as Record<string, unknown>;
    const teaches = detail.teaches as unknown[];
    if (!Array.isArray(teaches)) continue;
    
    let entityModified = false;
    const newTeaches: unknown[] = [];
    
    for (const t of teaches) {
      if (typeof t === "string") {
        newTeaches.push(t);
        continue;
      }
      if (typeof t !== "object" || t === null) {
        newTeaches.push(t);
        continue;
      }
      
      const entry = t as TeachEntry;
      if (entry.rationale && entry.cross_lang) {
        newTeaches.push(entry);
        continue;
      }
      
      const knowledge = findKnowledge(entry.tag);
      const updated: TeachEntry = { ...entry };
      
      if (!updated.rationale) {
        const inferred = inferRationale(detail, entry.tag);
        if (inferred) {
          updated.rationale = inferred;
          entityModified = true;
        } else if (knowledge) {
          updated.rationale = `Applied here to leverage ${entry.tag.toLowerCase()} benefits in this context`;
          entityModified = true;
        }
      }
      
      if (!updated.cross_lang && knowledge?.cross_lang) {
        updated.cross_lang = knowledge.cross_lang;
        entityModified = true;
      }
      
      if (!updated.gotcha && knowledge?.gotcha) {
        updated.gotcha = knowledge.gotcha;
        entityModified = true;
      }
      
      newTeaches.push(updated);
    }
    
    if (entityModified) {
      detail.teaches = newTeaches;
      upgraded++;
    }
  }
  
  if (upgraded > 0) {
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  }
  return { upgraded, total: analysis.entities.length };
}

function main() {
  const projectRoot = process.argv[2];
  if (!projectRoot) {
    console.error("Usage: npx tsx upgrade-teaches.ts <project-root>");
    process.exit(1);
  }
  
  const filesDir = path.join(projectRoot, ".vibe-reading", "files");
  if (!fs.existsSync(filesDir)) {
    console.error(`[upgrade-teaches] No .vibe-reading/files/ found.`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(filesDir).filter(f => f.endsWith(".json")).sort();
  let totalUpgraded = 0;
  let totalEntities = 0;
  
  for (const f of files) {
    const jsonPath = path.join(filesDir, f);
    const { upgraded, total } = upgradeFile(jsonPath);
    totalUpgraded += upgraded;
    totalEntities += total;
    if (upgraded > 0) {
      console.log(`  [ok] ${f}: ${upgraded}/${total} entities upgraded`);
    }
  }
  
  console.log(`\n[upgrade-teaches] Done: ${totalUpgraded}/${totalEntities} entities upgraded with rationale/cross_lang/gotcha`);
}

main();
