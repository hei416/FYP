import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { enhancedRagDocMapping } from './enhancedRagDocMapping';
import { getSourceColor, formatSourceName } from './ragDocMapping';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import DocumentViewer from './DocumentViewer';
import QuizReminderModal from './QuizReminderModal';

// ----------------- Content Database -----------------
const subtopicContent = {
  // Group 1: Advanced OOP
  "adv_abstract":   { title: "Abstract Classes",       description: "Abstract classes define templates for subclasses, mixing enforced contracts with shared behaviour.", links: [{ label: "Abstract Classes - Oracle", href: "https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html" }, { label: "Abstract Class - GeeksforGeeks", href: "https://www.geeksforgeeks.org/abstract-classes-in-java/" }] },
  "adv_interfaces": { title: "Interfaces & Default Methods", description: "Interfaces define contracts. Since Java 8 they support default and static methods.", links: [{ label: "Interfaces - Oracle", href: "https://docs.oracle.com/javase/tutorial/java/IandI/createinterface.html" }, { label: "Interfaces - GeeksforGeeks", href: "https://www.geeksforgeeks.org/interfaces-in-java/" }] },
  "adv_generics":   { title: "Generics",               description: "Write type-safe classes and methods using parameterised types.", links: [{ label: "Generics - Oracle", href: "https://docs.oracle.com/javase/tutorial/java/generics/" }, { label: "Generics - GeeksforGeeks", href: "https://www.geeksforgeeks.org/generics-in-java/" }] },

  // Group 2: Collections Framework
  "col_list":   { title: "List — ArrayList & LinkedList", description: "Ordered sequences backed by dynamic array or doubly-linked nodes.", links: [{ label: "Collections - Oracle", href: "https://docs.oracle.com/javase/tutorial/collections/" }, { label: "ArrayList - GeeksforGeeks", href: "https://www.geeksforgeeks.org/arraylist-in-java/" }] },
  "col_map":    { title: "Map — HashMap & TreeMap",       description: "Key-value pairs with O(1) average (HashMap) or sorted keys (TreeMap).", links: [{ label: "HashMap - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-util-hashmap-in-java-with-examples/" }] },
  "col_set":    { title: "Set — HashSet & TreeSet",       description: "Unique element collections; HashSet O(1) lookup, TreeSet sorted.", links: [{ label: "HashSet - GeeksforGeeks", href: "https://www.geeksforgeeks.org/hashset-in-java/" }] },
  "col_queue":  { title: "Queue & Deque",                 description: "FIFO queue and double-ended queue for efficient head/tail operations.", links: [{ label: "Queue - Oracle", href: "https://docs.oracle.com/javase/8/docs/api/java/util/Queue.html" }, { label: "Deque - GeeksforGeeks", href: "https://www.geeksforgeeks.org/deque-interface-java-example/" }] },

  // Group 3: Streams & Functional
  "stream_basics":  { title: "Stream API Basics",          description: "Declarative data processing pipelines with lazy evaluation.", links: [{ label: "Streams - GeeksforGeeks", href: "https://www.geeksforgeeks.org/stream-in-java/" }, { label: "Java Notes ch10", href: "http://math.hws.edu/javanotes/c10/" }] },
  "stream_lambda":  { title: "Lambda & Functional Interfaces", description: "Concise anonymous functions and the functional interface hierarchy.", links: [{ label: "Lambdas - GeeksforGeeks", href: "https://www.geeksforgeeks.org/lambda-expressions-java-8/" }] },
  "stream_ops":     { title: "Stream Operations: filter/map/reduce", description: "Core intermediate and terminal operations for transforming and aggregating data.", links: [{ label: "Stream operations - GeeksforGeeks", href: "https://www.geeksforgeeks.org/stream-in-java/" }] },

  // Group 4: Exception & I/O
  "exc_checked": { title: "Checked vs Unchecked Exceptions", description: "Understand the exception hierarchy and handling requirements.", links: [{ label: "Exceptions - Oracle", href: "https://docs.oracle.com/javase/tutorial/essential/exceptions/" }, { label: "Exceptions - GeeksforGeeks", href: "https://www.geeksforgeeks.org/exceptions-in-java/" }] },
  "exc_custom":  { title: "Custom Exceptions",               description: "Create domain-specific exceptions with meaningful messages.", links: [{ label: "Custom exceptions - GeeksforGeeks", href: "https://www.geeksforgeeks.org/user-defined-custom-exception-in-java/" }] },
  "file_read":   { title: "File I/O — Reading & Writing",    description: "BufferedReader/Writer and NIO.2 Files API for file operations.", links: [{ label: "Files - Oracle", href: "https://docs.oracle.com/javase/tutorial/essential/io/file.html" }, { label: "Java Notes ch11", href: "http://math.hws.edu/javanotes/c11/" }] },
  "file_streams": { title: "Byte & Character Streams",       description: "InputStream/OutputStream hierarchy and character-encoding streams.", links: [{ label: "I/O - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-io-tutorial/" }] },

  // Group 5: Concurrency
  "thread_basics":    { title: "Thread Basics",              description: "Creating and starting threads via Thread/Runnable.", links: [{ label: "Concurrency - Oracle", href: "https://docs.oracle.com/javase/tutorial/essential/concurrency/" }, { label: "Java Notes ch9", href: "http://math.hws.edu/javanotes/c9/" }] },
  "thread_sync":      { title: "Synchronisation & Locks",    description: "Prevent race conditions with synchronized and ReentrantLock.", links: [{ label: "Synchronisation - Oracle", href: "https://docs.oracle.com/javase/tutorial/essential/concurrency/sync.html" }, { label: "Synchronisation - GeeksforGeeks", href: "https://www.geeksforgeeks.org/synchronization-in-java/" }] },
  "thread_lifecycle": { title: "Thread Lifecycle & ExecutorService", description: "Thread state transitions and managed thread pools.", links: [{ label: "Thread lifecycle - GeeksforGeeks", href: "https://www.geeksforgeeks.org/lifecycle-and-states-of-a-thread-in-java/" }] },

  // Group 6: Data Structures
  "ds_arrays_lists":  { title: "Arrays & Array-Based Lists",  description: "Contiguous-memory structures; O(1) access, O(n) mid-insert.", links: [{ label: "ODS ch2", href: "http://opendatastructures.org/ods-java/2_Array_Based_Lists.html" }, { label: "Arrays - GeeksforGeeks", href: "https://www.geeksforgeeks.org/array-data-structure/" }] },
  "ds_stacks_queues": { title: "Stacks & Queues",             description: "LIFO/FIFO abstraction implemented with arrays or linked nodes.", links: [{ label: "ODS ch3", href: "http://opendatastructures.org/ods-java/3_Linked_Lists.html" }, { label: "Stack - GeeksforGeeks", href: "https://www.geeksforgeeks.org/stack-data-structure/" }] },
  "ds_trees":         { title: "Trees & Binary Search Trees", description: "Hierarchical structures; BST gives O(log n) average search/insert.", links: [{ label: "ODS ch6", href: "http://opendatastructures.org/ods-java/6_Binary_Trees.html" }, { label: "BST - GeeksforGeeks", href: "https://www.geeksforgeeks.org/binary-search-tree-data-structure/" }] },
  "ds_hashing":       { title: "Hash Tables",                 description: "O(1) average lookup via hash functions and collision resolution.", links: [{ label: "ODS ch5", href: "http://opendatastructures.org/ods-java/5_Hash_Tables.html" }, { label: "HashMap - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-util-hashmap-in-java-with-examples/" }] },

  // Group 7: Algorithms
  "algo_sorting":    { title: "Sorting Algorithms",        description: "MergeSort, QuickSort, HeapSort — all O(n log n); stability and trade-offs.", links: [{ label: "ODS ch11", href: "http://opendatastructures.org/ods-java/11_Sorting_Algorithms.html" }, { label: "Sorting - GeeksforGeeks", href: "https://www.geeksforgeeks.org/sorting-algorithms/" }] },
  "algo_searching":  { title: "Searching Algorithms",      description: "Binary search O(log n) vs linear O(n); in-built Arrays.binarySearch.", links: [{ label: "Binary search - GeeksforGeeks", href: "https://www.geeksforgeeks.org/binary-search/" }] },
  "algo_complexity": { title: "Algorithm Complexity — Big O", description: "Asymptotic analysis: time and space complexity, amortised cost.", links: [{ label: "ODS ch1", href: "http://opendatastructures.org/ods-java/1_Introduction.html" }, { label: "Complexity - GeeksforGeeks", href: "https://www.geeksforgeeks.org/analysis-of-algorithms-set-1-asymptotic-analysis/" }] },

  // Group 8: Advanced Patterns
  "adv_recursion": { title: "Advanced Recursion",               description: "Backtracking, memoisation, and divide & conquer patterns.", links: [{ label: "Java Notes ch7", href: "http://math.hws.edu/javanotes/c7/" }, { label: "Recursion - GeeksforGeeks", href: "https://www.geeksforgeeks.org/recursion/" }] },
  "adv_design":    { title: "Design Considerations & Robustness", description: "Preconditions, Optional, defensive programming, and robustness.", links: [{ label: "Java Notes ch8", href: "http://math.hws.edu/javanotes/c8/" }, { label: "Best Practices - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-coding-best-practices/" }] },
};

export const ENHANCED_SUBTOPIC_IDS = Object.keys(subtopicContent);
export const ENHANCED_SUBTOPIC_COUNT = ENHANCED_SUBTOPIC_IDS.length;

export const ENHANCED_TOPIC_GROUPS = [
  { id: 1, label: "Advanced OOP",         subtopics: ["adv_abstract", "adv_interfaces", "adv_generics"] },
  { id: 2, label: "Collections Framework", subtopics: ["col_list", "col_map", "col_set", "col_queue"] },
  { id: 3, label: "Streams & Functional",  subtopics: ["stream_basics", "stream_lambda", "stream_ops"] },
  { id: 4, label: "Exception & I/O",       subtopics: ["exc_checked", "exc_custom", "file_read", "file_streams"] },
  { id: 5, label: "Concurrency",           subtopics: ["thread_basics", "thread_sync", "thread_lifecycle"] },
  { id: 6, label: "Data Structures",       subtopics: ["ds_arrays_lists", "ds_stacks_queues", "ds_trees", "ds_hashing"] },
  { id: 7, label: "Algorithms",            subtopics: ["algo_sorting", "algo_searching", "algo_complexity"] },
  { id: 8, label: "Advanced Patterns",     subtopics: ["adv_recursion", "adv_design"] },
];

export function isEnhancedSubtopicUnlocked(subtopicId, completedTopics) {
  const groupIndex = ENHANCED_TOPIC_GROUPS.findIndex(g => g.subtopics.includes(subtopicId));
  if (groupIndex <= 0) return true;
  const prevGroup = ENHANCED_TOPIC_GROUPS[groupIndex - 1];
  return prevGroup.subtopics.every(id => completedTopics.includes(id));
}

export function getMissingEnhancedPrerequisites(subtopicId, completedTopics) {
  const groupIndex = ENHANCED_TOPIC_GROUPS.findIndex(g => g.subtopics.includes(subtopicId));
  if (groupIndex <= 0) return [];
  const prevGroup = ENHANCED_TOPIC_GROUPS[groupIndex - 1];
  const missing = prevGroup.subtopics.filter(id => !completedTopics.includes(id));
  return { groupLabel: prevGroup.label, missing };
}

// ----------------- Helpers -----------------
const makeNode = (id, x, y, label, { width = 200, bg = "#D1FAE5", border = "#34D399", bold = false, fontSize = 15 } = {}) => ({
  id: String(id),
  position: { x, y },
  data: { label },
  style: { width, padding: 10, borderRadius: 8, background: bg, border: `2px solid ${border}`, fontWeight: bold ? 600 : 500, fontSize, textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer", zIndex: 10 },
});

const makeTopicHeader = (id, x, y, label, { width = 260 } = {}) => ({
  id: String(id),
  position: { x, y },
  data: { label },
  style: { width, padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #059669 0%, #047857 100%)", border: "2px solid #065F46", fontWeight: 700, fontSize: 17, color: "#FFFFFF", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.2)", cursor: "default", pointerEvents: "none", zIndex: 5 },
  selectable: false,
  draggable: false,
});

// X positions
const X2 = [230, 570];
const X3 = [130, 400, 670];
const X4 = [60, 300, 540, 780];
const SUB_W  = 190;
const SUB_W3 = 195;
const gy = (n) => 80 + (n - 1) * 220;
const sy = (n) => gy(n) + 80;

const initialNodes = [
  // Root
  makeNode("root", 330, 5, "🚀 Enhanced Java Learning Path", { width: 300, bold: true, bg: "#059669", border: "#065F46", fontSize: 18 }),

  // === GROUP 1: Advanced OOP (3 subs) ===
  makeTopicHeader("etopic1", 330, gy(1), "1. Advanced OOP", { width: 280 }),
  makeNode("adv_abstract",   X3[0], sy(1), "Abstract Classes",         { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("adv_interfaces", X3[1], sy(1), "Interfaces & Default Methods", { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("adv_generics",   X3[2], sy(1), "Generics",                 { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 2: Collections (4 subs) ===
  makeTopicHeader("etopic2", 310, gy(2), "2. Collections Framework", { width: 310 }),
  makeNode("col_list",  X4[0], sy(2), "List: ArrayList/LinkedList", { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("col_map",   X4[1], sy(2), "Map: HashMap/TreeMap",       { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("col_set",   X4[2], sy(2), "Set: HashSet/TreeSet",       { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("col_queue", X4[3], sy(2), "Queue & Deque",              { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 3: Streams & Functional (3 subs) ===
  makeTopicHeader("etopic3", 310, gy(3), "3. Streams & Functional", { width: 310 }),
  makeNode("stream_basics",  X3[0], sy(3), "Stream API Basics",    { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("stream_lambda",  X3[1], sy(3), "Lambda & Functional",  { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("stream_ops",     X3[2], sy(3), "filter/map/reduce",    { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 4: Exception & I/O (4 subs) ===
  makeTopicHeader("etopic4", 305, gy(4), "4. Exception & I/O", { width: 330 }),
  makeNode("exc_checked",  X4[0], sy(4), "Checked vs Unchecked",   { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("exc_custom",   X4[1], sy(4), "Custom Exceptions",      { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("file_read",    X4[2], sy(4), "File Reading & Writing", { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("file_streams", X4[3], sy(4), "Byte & Char Streams",    { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 5: Concurrency (3 subs) ===
  makeTopicHeader("etopic5", 340, gy(5), "5. Concurrency", { width: 260 }),
  makeNode("thread_basics",    X3[0], sy(5), "Thread Basics",         { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("thread_sync",      X3[1], sy(5), "Synchronisation",       { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("thread_lifecycle", X3[2], sy(5), "Lifecycle & ExecutorService", { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 6: Data Structures (4 subs) ===
  makeTopicHeader("etopic6", 320, gy(6), "6. Data Structures", { width: 290 }),
  makeNode("ds_arrays_lists",  X4[0], sy(6), "Arrays & Array Lists", { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("ds_stacks_queues", X4[1], sy(6), "Stacks & Queues",      { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("ds_trees",         X4[2], sy(6), "Trees & BST",           { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("ds_hashing",       X4[3], sy(6), "Hash Tables",           { width: SUB_W, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 7: Algorithms (3 subs) ===
  makeTopicHeader("etopic7", 330, gy(7), "7. Algorithms", { width: 270 }),
  makeNode("algo_sorting",    X3[0], sy(7), "Sorting Algorithms",     { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("algo_searching",  X3[1], sy(7), "Searching Algorithms",   { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("algo_complexity", X3[2], sy(7), "Algorithm Complexity",   { width: SUB_W3, bg: "#D1FAE5", border: "#34D399" }),

  // === GROUP 8: Advanced Patterns (2 subs) ===
  makeTopicHeader("etopic8", 310, gy(8), "8. Advanced Patterns", { width: 310 }),
  makeNode("adv_recursion", X2[0], sy(8), "Advanced Recursion",                { width: 200, bg: "#D1FAE5", border: "#34D399" }),
  makeNode("adv_design",    X2[1], sy(8), "Design & Robustness", { width: 200, bg: "#10B981", border: "#059669", bold: true }),
];

const groupEdge = { animated: true, style: { stroke: "#059669", strokeWidth: 3 } };

const initialEdges = [
  { id: "root-t1", source: "root", target: "etopic1", ...groupEdge },
  { id: "t1-a", source: "etopic1", target: "adv_abstract" },
  { id: "t1-b", source: "etopic1", target: "adv_interfaces" },
  { id: "t1-c", source: "etopic1", target: "adv_generics" },

  { id: "g1-g2", source: "etopic1", target: "etopic2", ...groupEdge },
  { id: "t2-a", source: "etopic2", target: "col_list" },
  { id: "t2-b", source: "etopic2", target: "col_map" },
  { id: "t2-c", source: "etopic2", target: "col_set" },
  { id: "t2-d", source: "etopic2", target: "col_queue" },

  { id: "g2-g3", source: "etopic2", target: "etopic3", ...groupEdge },
  { id: "t3-a", source: "etopic3", target: "stream_basics" },
  { id: "t3-b", source: "etopic3", target: "stream_lambda" },
  { id: "t3-c", source: "etopic3", target: "stream_ops" },

  { id: "g3-g4", source: "etopic3", target: "etopic4", ...groupEdge },
  { id: "t4-a", source: "etopic4", target: "exc_checked" },
  { id: "t4-b", source: "etopic4", target: "exc_custom" },
  { id: "t4-c", source: "etopic4", target: "file_read" },
  { id: "t4-d", source: "etopic4", target: "file_streams" },

  { id: "g4-g5", source: "etopic4", target: "etopic5", ...groupEdge },
  { id: "t5-a", source: "etopic5", target: "thread_basics" },
  { id: "t5-b", source: "etopic5", target: "thread_sync" },
  { id: "t5-c", source: "etopic5", target: "thread_lifecycle" },

  { id: "g5-g6", source: "etopic5", target: "etopic6", ...groupEdge },
  { id: "t6-a", source: "etopic6", target: "ds_arrays_lists" },
  { id: "t6-b", source: "etopic6", target: "ds_stacks_queues" },
  { id: "t6-c", source: "etopic6", target: "ds_trees" },
  { id: "t6-d", source: "etopic6", target: "ds_hashing" },

  { id: "g6-g7", source: "etopic6", target: "etopic7", ...groupEdge },
  { id: "t7-a", source: "etopic7", target: "algo_sorting" },
  { id: "t7-b", source: "etopic7", target: "algo_searching" },
  { id: "t7-c", source: "etopic7", target: "algo_complexity" },

  { id: "g7-g8", source: "etopic7", target: "etopic8", ...groupEdge },
  { id: "t8-a", source: "etopic8", target: "adv_recursion" },
  { id: "t8-b", source: "etopic8", target: "adv_design" },
];

// ----------------- Component -----------------
export default function EnhancedHomePage() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [completedTopics, setCompletedTopics] = useState(() => {
    const saved = localStorage.getItem('enhanced-roadmap-completed');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showQuizReminder, setShowQuizReminder] = useState(false);
  const [reminderChapterCount, setReminderChapterCount] = useState(0);

  const handleViewDocument = useCallback((file, source) => {
    setViewingDocument({ file, source });
  }, []);

  const closeDocumentViewer = useCallback(() => {
    setViewingDocument(null);
  }, []);

  useEffect(() => {
    localStorage.setItem('enhanced-roadmap-completed', JSON.stringify(completedTopics));
  }, [completedTopics]);

  useEffect(() => {
    const count = completedTopics.filter(id => subtopicContent[id]).length;
    if (count > 0 && count % 2 === 0) {
      const dismissedKey = `enhanced_quiz_reminder_dismissed_at_${count}`;
      if (!localStorage.getItem(dismissedKey)) {
        setReminderChapterCount(count);
        setShowQuizReminder(true);
      }
    }
  }, [completedTopics]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.style?.cursor === "pointer") {
          const originalBg    = node.data?.originalBg    || "#D1FAE5";
          const originalBorder = node.data?.originalBorder || "#34D399";
          const unlocked = isEnhancedSubtopicUnlocked(node.id, completedTopics);

          if (completedTopics.includes(node.id) && unlocked) {
            const label = node.data.label;
            return { ...node, data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder }, style: { ...node.style, background: "#86EFAC", border: "2px solid #22C55E", opacity: 1, cursor: "pointer" } };
          } else if (completedTopics.includes(node.id) && !unlocked) {
            const label = node.data.label;
            return { ...node, data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder }, style: { ...node.style, background: "#DBEAFE", border: "2px solid #3B82F6", opacity: 1, cursor: "pointer" } };
          } else if (!unlocked) {
            const label = node.data.label;
            return { ...node, data: { ...node.data, label: `⚠️ ${label.replace(/^⚠️ /, '')}`, originalBg, originalBorder }, style: { ...node.style, background: "#FEF3C7", border: "2px dashed #F59E0B", opacity: 0.85, cursor: "pointer" } };
          } else {
            const label = node.data.label;
            return { ...node, data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder }, style: { ...node.style, background: originalBg, border: `2px solid ${originalBorder}`, opacity: 1, cursor: "pointer" } };
          }
        }
        return node;
      })
    );
  }, [completedTopics, setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    if (node.style?.pointerEvents !== "none") {
      if (subtopicContent[node.id] && !isEnhancedSubtopicUnlocked(node.id, completedTopics)) {
        const { groupLabel, missing } = getMissingEnhancedPrerequisites(node.id, completedTopics);
        const missingCount = missing.length;
        const proceed = window.confirm(
          `⚠️ Heads up!\n\nYou have ${missingCount} incomplete topic${missingCount > 1 ? 's' : ''} in "${groupLabel}" that may be related to this content.\n\nYou can still continue, but you might miss some foundational concepts.\n\nProceed anyway?`
        );
        if (!proceed) return;
      }
      navigate(`/enhanced-topic/${node.id}`);
    }
  }, [completedTopics, navigate]);

  const closePanel = () => setSelectedNode(null);

  const toggleCompletion = () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    setCompletedTopics((prev) => {
      const isNowCompleted = !prev.includes(nodeId);
      const next = isNowCompleted ? [...prev, nodeId] : prev.filter(id => id !== nodeId);
      if (isNowCompleted) {
        const group = ENHANCED_TOPIC_GROUPS.find(g => g.subtopics.includes(nodeId));
        if (group) {
          const groupDone = group.subtopics.every(id => next.includes(id));
          if (groupDone) {
            const stored = localStorage.getItem('enhanced-codetutor-learning-progress');
            const progress = stored ? JSON.parse(stored) : null;
            const quizAttempted = progress?.quizzes?.attempted ?? 0;
            const testAttempted = progress?.tests?.attempted ?? 0;
            if (quizAttempted === 0 || testAttempted === 0) {
              setTimeout(() => {
                const go = window.confirm(
                  `🎉 You completed "${group.label}"!\n\n` +
                  (quizAttempted === 0 ? `💡 You haven't attempted any quizzes yet — try one!\n` : '') +
                  (testAttempted === 0 ? `💡 You haven't attempted any practical tests yet!\n` : '') +
                  `\nGo to Quizzes now?`
                );
                if (go) window.location.href = '/quiz';
              }, 300);
            }
          }
        }
      }
      return next;
    });
  };

  const getTopicContent = (nodeId) => {
    const subtopic = subtopicContent[nodeId];
    const ragContent = enhancedRagDocMapping[nodeId];
    const links = subtopic?.links || [];
    const description = subtopic?.description || "Learn about this Enhanced Java topic.";
    return {
      title: ragContent?.title || subtopic?.title || selectedNode?.data.label || "Topic Details",
      description: ragContent?.description || description,
      sources: ragContent?.sources || [],
      fallbackLinks: links,
      hasSources: ragContent?.sources && ragContent.sources.length > 0,
    };
  };

  const content = selectedNode ? getTopicContent(selectedNode.id) : null;
  const isCompleted = selectedNode && completedTopics.includes(selectedNode.id);
  const isSkippedComplete = isCompleted && selectedNode && !isEnhancedSubtopicUnlocked(selectedNode.id, completedTopics);

  const totalTopics = Object.keys(subtopicContent).length;
  const completedCount = completedTopics.filter(id => subtopicContent[id]).length;
  const progressPercentage = Math.round((completedCount / totalTopics) * 100);

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-auto">
      {/* Progress bar */}
      <div className="fixed top-12 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-800">🚀 Enhanced Java Learning Roadmap</h1>
            <span className="text-sm text-green-700 font-medium bg-green-100 px-2 py-1 rounded">Enhanced Java</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-gray-700">Learning Progress</span>
            <span className="text-base font-bold text-green-600">{completedCount} / {totalTopics} subtopics</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-gradient-to-r from-emerald-400 to-green-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <div className="text-right mt-1">
            <span className="text-xl font-bold text-green-600">{progressPercentage}%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '120px', height: 'calc(100vh - 120px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.08, nodes: [{ id: 'root' }, { id: 'etopic1' }, { id: 'adv_abstract' }, { id: 'adv_generics' }, { id: 'etopic2' }] }}
          minZoom={0.25}
          maxZoom={1.5}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          nodesDraggable={false}
          defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "#64748B", strokeWidth: 2 } }}
        >
          <Background variant="dots" gap={16} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Side Panel */}
      <div
        className={`fixed top-[190px] right-0 z-30 w-96 transform bg-white shadow-xl border-l border-gray-200 transition-transform duration-300 ease-out flex flex-col ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ height: 'calc(100vh - 190px)', maxHeight: 'calc(100vh - 190px)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">{content?.title || 'Details'}</h2>
          <button onClick={closePanel} className="rounded-md p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors z-50" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100vh - 150px)' }}>
          <div className="p-5 space-y-5">
            {content ? (
              <>
                {isCompleted && !isSkippedComplete && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span className="text-base font-semibold text-green-800">Completed! 🎉</span>
                  </div>
                )}
                {isSkippedComplete && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
                    <div className="flex items-center mb-1">
                      <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      <span className="text-base font-semibold text-amber-800">Completed (prerequisites skipped)</span>
                    </div>
                    <p className="text-sm text-amber-700 ml-7">Some earlier topics haven't been completed yet.</p>
                  </div>
                )}

                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                  <p className="text-sm text-gray-700 mb-3">View the full learning material for this topic.</p>
                  <button
                    onClick={() => navigate(`/enhanced-topic/${selectedNode.id}`)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    View Full Learning Material
                  </button>
                </div>

                {content.hasSources ? (
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      External Learning Resources ({content.sources.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {content.sources.map((source, idx) => {
                        const colors = getSourceColor(source.source);
                        const sourceName = formatSourceName(source.source);
                        return (
                          <div key={idx} className="group">
                            <button
                              onClick={() => handleViewDocument(source.file, source.source)}
                              className="w-full flex items-start p-3 rounded-lg border border-gray-200 bg-white hover:border-green-400 hover:bg-green-50 transition-all text-left"
                            >
                              <div className="flex-shrink-0 mr-3 mt-0.5">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-medium text-gray-900 group-hover:text-green-700 break-words">{source.file}</div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>{sourceName}</span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <a href="/ragAI" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center group">
                        <svg className="w-5 h-5 mr-2 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        Ask AI Tutor About This Topic
                      </a>
                    </div>
                  </div>
                ) : content.fallbackLinks.length > 0 ? (
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">External Learning Resources</h3>
                    <ul className="space-y-3">
                      {content.fallbackLinks.map((link, idx) => (
                        <li key={idx}>
                          <a href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-start p-3 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group">
                            <svg className="w-5 h-5 mr-3 mt-0.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <div className="flex-1">
                              <div className="text-base font-medium text-gray-900 group-hover:text-green-700">{link.label}</div>
                              <div className="text-sm text-gray-500 mt-1 break-all">{new URL(link.href).hostname}</div>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={toggleCompletion}
                    className={`w-full font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center ${isCompleted ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  >
                    {isCompleted ? (
                      <><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Mark as Incomplete</>
                    ) : (
                      <><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Mark as Completed</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-gray-500 text-sm">No content available for this topic yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <QuizReminderModal
        show={showQuizReminder}
        chapterCount={reminderChapterCount}
        onClose={() => setShowQuizReminder(false)}
        onDismiss={() => {
          localStorage.setItem(`enhanced_quiz_reminder_dismissed_at_${reminderChapterCount}`, 'true');
          setShowQuizReminder(false);
        }}
      />
      <DocumentViewer
        isOpen={viewingDocument !== null}
        onClose={closeDocumentViewer}
        documentFile={viewingDocument?.file}
        documentSource={viewingDocument?.source}
      />
    </div>
  );
}
