// enhancedRagDocMapping.js — Enhanced Java course RAG document sources

export const enhancedRagDocMapping = {
  // ─── Advanced OOP ────────────────────────────────────────────────────────
  adv_abstract: {
    title: "Abstract Classes & Abstraction",
    description: "Deep dive into abstract classes, abstract methods, and design contracts.",
    sources: [
      { file: "oracle_002_interfaces_inheritance.txt", source: "oracle", type: "file" },
      { file: "gfg_002_inheritance-in-java.txt",       source: "geeksforgeeks", type: "file" },
      { file: "gfg_003_inheritance-in-java.txt",       source: "geeksforgeeks", type: "file" },
      { file: "c5-OOP.txt",                            source: "javanotes", type: "file" },
    ],
  },

  adv_interfaces: {
    title: "Interfaces & Default Methods",
    description: "Interface design, multiple implementation, default and static interface methods.",
    sources: [
      { file: "oracle_002_interfaces_inheritance.txt", source: "oracle", type: "file" },
      { file: "gfg_005_interfaces-in-java.txt",        source: "geeksforgeeks", type: "file" },
      { file: "gfg_007_interfaces-in-java.txt",        source: "geeksforgeeks", type: "file" },
      { file: "c5-OOP.txt",                            source: "javanotes", type: "file" },
    ],
  },

  adv_generics: {
    title: "Generics",
    description: "Type parameters, bounded wildcards, and generic methods/classes.",
    sources: [
      { file: "c10-generics-streams.txt", source: "javanotes", type: "file" },
      { file: "oracle_002_interfaces_inheritance.txt", source: "oracle", type: "file" },
    ],
  },

  // ─── Collections Framework ───────────────────────────────────────────────
  col_list: {
    title: "List — ArrayList & LinkedList",
    description: "Dynamic arrays and linked lists: add, remove, iterate, sort.",
    sources: [
      { file: "gfg_007_arraylist-in-java.txt",  source: "geeksforgeeks", type: "file" },
      { file: "gfg_010_arraylist-in-java.txt",  source: "geeksforgeeks", type: "file" },
      { file: "oracle_003_collections.txt",     source: "oracle", type: "file" },
      { file: "c6-arrays-arraylists.txt",       source: "javanotes", type: "file" },
    ],
  },

  col_map: {
    title: "Map — HashMap & TreeMap",
    description: "Key-value storage, hash buckets, ordering, and iteration patterns.",
    sources: [
      { file: "gfg_006_collections-in-java-2.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_009_collections-in-java-2.txt", source: "geeksforgeeks", type: "file" },
      { file: "oracle_003_collections.txt",        source: "oracle", type: "file" },
      { file: "c6-arrays-arraylists.txt",          source: "javanotes", type: "file" },
    ],
  },

  col_set: {
    title: "Set — HashSet & TreeSet",
    description: "Unique-element collections, set operations, and ordering guarantees.",
    sources: [
      { file: "gfg_006_collections-in-java-2.txt", source: "geeksforgeeks", type: "file" },
      { file: "oracle_003_collections.txt",        source: "oracle", type: "file" },
      { file: "c6-arrays-arraylists.txt",          source: "javanotes", type: "file" },
    ],
  },

  col_queue: {
    title: "Queue & Deque",
    description: "FIFO queues, priority queues, double-ended queues, and use-cases.",
    sources: [
      { file: "gfg_006_collections-in-java-2.txt", source: "geeksforgeeks", type: "file" },
      { file: "oracle_003_collections.txt",        source: "oracle", type: "file" },
      { file: "ods_chapter_03.txt",                source: "data_structures", type: "file" },
    ],
  },

  // ─── Streams & Functional ────────────────────────────────────────────────
  stream_basics: {
    title: "Stream API Basics",
    description: "Creating streams from collections, lazy evaluation, and terminal operations.",
    sources: [
      { file: "gfg_010_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_017_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "c10-generics-streams.txt",   source: "javanotes", type: "file" },
    ],
  },

  stream_lambda: {
    title: "Lambda Expressions & Functional Interfaces",
    description: "Syntax, method references, Predicate/Function/Consumer patterns.",
    sources: [
      { file: "gfg_010_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_017_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "c10-generics-streams.txt",   source: "javanotes", type: "file" },
    ],
  },

  stream_ops: {
    title: "Stream Operations: filter, map, reduce",
    description: "Intermediate and terminal operations, collectors, and parallel streams.",
    sources: [
      { file: "gfg_010_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_017_stream-in-java.txt", source: "geeksforgeeks", type: "file" },
      { file: "c10-generics-streams.txt",   source: "javanotes", type: "file" },
    ],
  },

  // ─── Exception & I/O ─────────────────────────────────────────────────────
  exc_checked: {
    title: "Checked vs Unchecked Exceptions",
    description: "Exception hierarchy, checked exceptions, and the throws clause.",
    sources: [
      { file: "gfg_checked_unchecked.txt", source: "exceptions", type: "file" },
      { file: "gfg_exceptions.txt",        source: "exceptions", type: "file" },
      { file: "oracle_004_exceptions.txt", source: "oracle", type: "file" },
      { file: "c8-correctness-robustness.txt", source: "javanotes", type: "file" },
    ],
  },

  exc_custom: {
    title: "Custom Exceptions",
    description: "Creating domain-specific exception classes, exception chaining.",
    sources: [
      { file: "gfg_exceptions.txt",        source: "exceptions", type: "file" },
      { file: "oracle_004_exceptions.txt", source: "oracle", type: "file" },
      { file: "c8-correctness-robustness.txt", source: "javanotes", type: "file" },
    ],
  },

  file_read: {
    title: "File I/O — Reading & Writing",
    description: "BufferedReader, FileWriter, try-with-resources, and NIO.2 Paths.",
    sources: [
      { file: "gfg_009_java-io-tutorial.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_013_java-io-tutorial.txt", source: "geeksforgeeks", type: "file" },
      { file: "c11-io-files-networking.txt",  source: "javanotes", type: "file" },
    ],
  },

  file_streams: {
    title: "Byte & Character Streams",
    description: "InputStream/OutputStream hierarchy, serialization, and piped streams.",
    sources: [
      { file: "gfg_009_java-io-tutorial.txt", source: "geeksforgeeks", type: "file" },
      { file: "gfg_013_java-io-tutorial.txt", source: "geeksforgeeks", type: "file" },
      { file: "c11-io-files-networking.txt",  source: "javanotes", type: "file" },
    ],
  },

  // ─── Concurrency ─────────────────────────────────────────────────────────
  thread_basics: {
    title: "Thread Basics",
    description: "Creating threads via Thread and Runnable, thread lifecycle, sleep/join.",
    sources: [
      { file: "oracle_005_concurrency.txt",        source: "oracle", type: "file" },
      { file: "gfg_008_multithreading-in-java.txt",source: "geeksforgeeks", type: "file" },
      { file: "gfg_012_multithreading-in-java.txt",source: "geeksforgeeks", type: "file" },
      { file: "c9-threads.txt",                    source: "javanotes", type: "file" },
    ],
  },

  thread_sync: {
    title: "Synchronisation & Locks",
    description: "synchronized keyword, volatile, ReentrantLock, deadlock avoidance.",
    sources: [
      { file: "oracle_005_concurrency.txt",        source: "oracle", type: "file" },
      { file: "gfg_008_multithreading-in-java.txt",source: "geeksforgeeks", type: "file" },
      { file: "gfg_012_multithreading-in-java.txt",source: "geeksforgeeks", type: "file" },
      { file: "c9-threads.txt",                    source: "javanotes", type: "file" },
    ],
  },

  thread_lifecycle: {
    title: "Thread Lifecycle & ExecutorService",
    description: "Thread states, thread pools, Callable/Future, and CompletableFuture.",
    sources: [
      { file: "oracle_005_concurrency.txt",        source: "oracle", type: "file" },
      { file: "gfg_008_multithreading-in-java.txt",source: "geeksforgeeks", type: "file" },
      { file: "c9-threads.txt",                    source: "javanotes", type: "file" },
    ],
  },

  // ─── Data Structures ─────────────────────────────────────────────────────
  ds_arrays_lists: {
    title: "Arrays & Array-Based Lists",
    description: "Performance characteristics of array-backed structures, resizing.",
    sources: [
      { file: "ods_chapter_01.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_02.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_03.txt", source: "data_structures", type: "file" },
    ],
  },

  ds_stacks_queues: {
    title: "Stacks & Queues",
    description: "LIFO/FIFO principles, array and linked implementations, use-cases.",
    sources: [
      { file: "ods_chapter_02.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_03.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_04.txt", source: "data_structures", type: "file" },
    ],
  },

  ds_trees: {
    title: "Trees & Binary Search Trees",
    description: "BST operations, tree traversals, balanced trees, heaps.",
    sources: [
      { file: "ods_chapter_06.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_07.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_08.txt", source: "data_structures", type: "file" },
    ],
  },

  ds_hashing: {
    title: "Hash Tables",
    description: "Hash functions, collision resolution (chaining vs open addressing).",
    sources: [
      { file: "ods_chapter_05.txt", source: "data_structures", type: "file" },
    ],
  },

  // ─── Algorithms ──────────────────────────────────────────────────────────
  algo_sorting: {
    title: "Sorting Algorithms",
    description: "Comparison and non-comparison sorts: MergeSort, QuickSort, HeapSort.",
    sources: [
      { file: "ods_chapter_11.txt", source: "data_structures", type: "file" },
      { file: "c7-recursion.txt",   source: "javanotes", type: "file" },
    ],
  },

  algo_searching: {
    title: "Searching Algorithms",
    description: "Linear search, binary search, hashing for O(1) lookup.",
    sources: [
      { file: "ods_chapter_05.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_11.txt", source: "data_structures", type: "file" },
    ],
  },

  algo_complexity: {
    title: "Algorithm Complexity — Big O",
    description: "Time and space complexity notation, amortized analysis, trade-offs.",
    sources: [
      { file: "ods_chapter_01.txt", source: "data_structures", type: "file" },
      { file: "ods_chapter_12.txt", source: "data_structures", type: "file" },
    ],
  },

  // ─── Advanced Patterns ───────────────────────────────────────────────────
  adv_recursion: {
    title: "Advanced Recursion",
    description: "Recursive backtracking, memoization, divide & conquer patterns.",
    sources: [
      { file: "c7-recursion.txt", source: "javanotes", type: "file" },
      { file: "ods_chapter_12.txt", source: "data_structures", type: "file" },
    ],
  },

  adv_design: {
    title: "Design Considerations & Robustness",
    description: "Code correctness, test-driven thinking, defensive programming.",
    sources: [
      { file: "c8-correctness-robustness.txt", source: "javanotes", type: "file" },
      { file: "oracle_000_oop_concepts.txt",   source: "oracle", type: "file" },
    ],
  },
};
