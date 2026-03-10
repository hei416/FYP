import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProgressTracker } from './ProgressTracker';
import { ragDocMapping, getSourceColor, formatSourceName } from './ragDocMapping';
import topicContent from './topicContent.json';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import DocumentViewer from './DocumentViewer';

// ----------------- Content Database with Subtopics -----------------

const subtopicContent = {
  // Topic 1: Bridging from Python
  "python_syntax": {
    title: "Syntax Comparison",
    description: "Compare Python and Java syntax, understand semicolons, braces, and indentation differences.",
    links: [
      { label: "Python vs Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/python/java-vs-python-which-one-should-i-learn/" },
      { label: "Java Syntax - W3Schools", href: "https://www.w3schools.com/java/java_syntax.asp" },
    ],
  },
  "python_types": {
    title: "Type System Differences",
    description: "Learn about static typing in Java vs dynamic typing in Python.",
    links: [
      { label: "Java Data Types - W3Schools", href: "https://www.w3schools.com/java/java_data_types.asp" },
      { label: "Type System - GeeksforGeeks", href: "https://www.geeksforgeeks.org/data-types-in-java/" },
    ],
  },
  "python_compilation": {
    title: "Compilation vs Interpretation",
    description: "Understand Java's compile-execute model vs Python's interpretation.",
    links: [
      { label: "Java Program Execution - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-program-execution-process/" },
    ],
  },
  "python_structure": {
    title: "Basic Program Structure",
    description: "Learn Java class structure, main method, and package organization.",
    links: [
      { label: "Java Syntax - W3Schools", href: "https://www.w3schools.com/java/java_syntax.asp" },
      { label: "First Java Program - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-hello-world-program/" },
    ],
  },

  // Topic 2: Problem Solving with Java
  "ps_algorithm": {
    title: "Algorithm Design Basics",
    description: "Learn fundamental algorithm design patterns and problem-solving strategies.",
    links: [
      { label: "Java Algorithms - GeeksforGeeks", href: "https://www.geeksforgeeks.org/fundamentals-of-algorithms/" },
    ],
  },
  "ps_pseudocode": {
    title: "Pseudocode to Java",
    description: "Convert algorithmic pseudocode into working Java code.",
    links: [
      { label: "Java Examples - W3Schools", href: "https://www.w3schools.com/java/java_examples.asp" },
    ],
  },
  "ps_debugging": {
    title: "Debugging Techniques",
    description: "Master debugging tools and techniques for finding and fixing errors.",
    links: [
      { label: "Debugging in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/debugging-java-program/" },
    ],
  },
  "ps_optimization": {
    title: "Code Optimization",
    description: "Learn to write efficient, optimized Java code.",
    links: [
      { label: "Java Best Practices - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java-coding-best-practices/" },
    ],
  },

  // Topic 3: String
  "string_basics": {
    title: "String Basics & Immutability",
    description: "Understand String objects, creation, and immutable nature.",
    links: [
      { label: "Java Strings - W3Schools", href: "https://www.w3schools.com/java/java_strings.asp" },
      { label: "String in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/strings-in-java/" },
    ],
  },
  "string_methods": {
    title: "Common String Methods",
    description: "Master essential String methods: length(), charAt(), substring(), etc.",
    links: [
      { label: "String Methods - W3Schools", href: "https://www.w3schools.com/java/java_ref_string.asp" },
      { label: "String Methods - GeeksforGeeks", href: "https://www.geeksforgeeks.org/string-class-in-java/" },
    ],
  },
  "string_builder": {
    title: "StringBuilder & StringBuffer",
    description: "Learn mutable string alternatives for efficient string manipulation.",
    links: [
      { label: "StringBuilder - GeeksforGeeks", href: "https://www.geeksforgeeks.org/stringbuilder-class-in-java-with-examples/" },
      { label: "StringBuffer - GeeksforGeeks", href: "https://www.geeksforgeeks.org/stringbuffer-class-in-java/" },
    ],
  },
  "string_pool": {
    title: "String Pool & Memory",
    description: "Understand String pool, intern() method, and memory optimization.",
    links: [
      { label: "String Pool - GeeksforGeeks", href: "https://www.geeksforgeeks.org/string-pool-in-java/" },
    ],
  },

  // Topic 4: Array
  "array_basics": {
    title: "Array Declaration & Initialization",
    description: "Learn to declare, initialize, and access arrays in Java.",
    links: [
      { label: "Java Arrays - W3Schools", href: "https://www.w3schools.com/java/java_arrays.asp" },
      { label: "Arrays in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/arrays-in-java/" },
    ],
  },
  "array_traversal": {
    title: "Array Traversal & Manipulation",
    description: "Master loops for array traversal and common array operations.",
    links: [
      { label: "Array Loop - W3Schools", href: "https://www.w3schools.com/java/java_arrays_loop.asp" },
      { label: "Array Programs - GeeksforGeeks", href: "https://www.geeksforgeeks.org/array-data-structure/" },
    ],
  },
  "array_multidim": {
    title: "Multi-dimensional Arrays",
    description: "Work with 2D arrays and nested array structures.",
    links: [
      { label: "Multidimensional Arrays - W3Schools", href: "https://www.w3schools.com/java/java_arrays_multi.asp" },
      { label: "2D Arrays - GeeksforGeeks", href: "https://www.geeksforgeeks.org/multidimensional-arrays-in-java/" },
    ],
  },
  "array_utilities": {
    title: "Arrays Class Utilities",
    description: "Use java.util.Arrays for sorting, searching, and comparison.",
    links: [
      { label: "Arrays Class - GeeksforGeeks", href: "https://www.geeksforgeeks.org/array-class-in-java/" },
    ],
  },

  // Topic 5: Methods
  "method_declaration": {
    title: "Method Declaration & Syntax",
    description: "Learn method structure: modifiers, return type, name, parameters.",
    links: [
      { label: "Java Methods - W3Schools", href: "https://www.w3schools.com/java/java_methods.asp" },
      { label: "Methods in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/methods-in-java/" },
    ],
  },
  "method_params": {
    title: "Parameters & Return Types",
    description: "Understand parameter passing and return value handling.",
    links: [
      { label: "Method Parameters - W3Schools", href: "https://www.w3schools.com/java/java_methods_param.asp" },
      { label: "Return Statement - GeeksforGeeks", href: "https://www.geeksforgeeks.org/return-keyword-java/" },
    ],
  },
  "method_overloading": {
    title: "Method Overloading",
    description: "Create multiple methods with same name but different parameters.",
    links: [
      { label: "Method Overloading - W3Schools", href: "https://www.w3schools.com/java/java_methods_overloading.asp" },
      { label: "Method Overloading - GeeksforGeeks", href: "https://www.geeksforgeeks.org/method-overloading-in-java/" },
    ],
  },
  "method_varargs": {
    title: "Variable Arguments (Varargs)",
    description: "Use varargs to pass variable number of arguments to methods.",
    links: [
      { label: "Varargs - GeeksforGeeks", href: "https://www.geeksforgeeks.org/variable-arguments-varargs-in-java/" },
    ],
  },

  // Topic 6: Exception Handling and File IO
  "exception_trycatch": {
    title: "Try-Catch-Finally Blocks",
    description: "Handle exceptions using try-catch-finally statements.",
    links: [
      { label: "Java Exceptions - W3Schools", href: "https://www.w3schools.com/java/java_try_catch.asp" },
      { label: "Exception Handling - GeeksforGeeks", href: "https://www.geeksforgeeks.org/exceptions-in-java/" },
    ],
  },
  "exception_types": {
    title: "Exception Types & Hierarchy",
    description: "Understand checked vs unchecked exceptions and exception hierarchy.",
    links: [
      { label: "Exception Types - GeeksforGeeks", href: "https://www.geeksforgeeks.org/checked-vs-unchecked-exceptions-in-java/" },
      { label: "Exception Hierarchy - GeeksforGeeks", href: "https://www.geeksforgeeks.org/exception-handling-in-java/" },
    ],
  },
  "exception_custom": {
    title: "Creating Custom Exceptions",
    description: "Design and implement your own exception classes.",
    links: [
      { label: "Custom Exceptions - GeeksforGeeks", href: "https://www.geeksforgeeks.org/user-defined-custom-exception-in-java/" },
    ],
  },
  "file_io": {
    title: "File Reading & Writing",
    description: "Work with files using File, FileReader, FileWriter, BufferedReader.",
    links: [
      { label: "Java Files - W3Schools", href: "https://www.w3schools.com/java/java_files.asp" },
      { label: "File Handling - GeeksforGeeks", href: "https://www.geeksforgeeks.org/file-handling-in-java/" },
    ],
  },

  // Topic 7: Class - Constructor/Attributes/Methods
  "class_declaration": {
    title: "Class Declaration",
    description: "Learn class syntax, naming conventions, and structure.",
    links: [
      { label: "Java Classes - W3Schools", href: "https://www.w3schools.com/java/java_classes.asp" },
      { label: "Classes in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/classes-objects-java/" },
    ],
  },
  "class_constructor": {
    title: "Constructors",
    description: "Master default and parameterized constructors for object initialization.",
    links: [
      { label: "Java Constructors - W3Schools", href: "https://www.w3schools.com/java/java_constructors.asp" },
      { label: "Constructors - GeeksforGeeks", href: "https://www.geeksforgeeks.org/constructors-in-java/" },
    ],
  },
  "class_attributes": {
    title: "Instance Variables/Attributes",
    description: "Declare and use instance variables to store object state.",
    links: [
      { label: "Class Attributes - W3Schools", href: "https://www.w3schools.com/java/java_class_attributes.asp" },
      { label: "Instance Variables - GeeksforGeeks", href: "https://www.geeksforgeeks.org/variables-in-java/" },
    ],
  },
  "class_methods": {
    title: "Instance Methods",
    description: "Create methods that operate on object data.",
    links: [
      { label: "Class Methods - W3Schools", href: "https://www.w3schools.com/java/java_class_methods.asp" },
      { label: "Methods in Java - GeeksforGeeks", href: "https://www.geeksforgeeks.org/methods-in-java/" },
    ],
  },
  "class_this": {
    title: "this Keyword",
    description: "Use 'this' to refer to current object instance.",
    links: [
      { label: "this Keyword - GeeksforGeeks", href: "https://www.geeksforgeeks.org/this-reference-in-java/" },
    ],
  },

  // Topic 8: Class - Access Modifier/Static
  "modifier_access": {
    title: "Access Modifiers",
    description: "Control access with public, private, protected, and default modifiers.",
    links: [
      { label: "Java Modifiers - W3Schools", href: "https://www.w3schools.com/java/java_modifiers.asp" },
      { label: "Access Modifiers - GeeksforGeeks", href: "https://www.geeksforgeeks.org/access-modifiers-java/" },
    ],
  },
  "modifier_static_var": {
    title: "Static Variables",
    description: "Create class-level variables shared across all instances.",
    links: [
      { label: "Static Keyword - GeeksforGeeks", href: "https://www.geeksforgeeks.org/static-keyword-java/" },
    ],
  },
  "modifier_static_method": {
    title: "Static Methods",
    description: "Define methods that belong to class rather than instances.",
    links: [
      { label: "Static Methods - GeeksforGeeks", href: "https://www.geeksforgeeks.org/static-methods-vs-instance-methods-java/" },
    ],
  },
  "modifier_static_block": {
    title: "Static Blocks",
    description: "Initialize static variables using static initialization blocks.",
    links: [
      { label: "Static Block - GeeksforGeeks", href: "https://www.geeksforgeeks.org/static-blocks-in-java/" },
    ],
  },
  "modifier_final": {
    title: "final Keyword",
    description: "Create constants and prevent inheritance/overriding with final.",
    links: [
      { label: "Final Keyword - GeeksforGeeks", href: "https://www.geeksforgeeks.org/final-keyword-in-java/" },
    ],
  },

  // Topic 9: Inheritance
  "inherit_extends": {
    title: "extends Keyword",
    description: "Create child classes that inherit from parent classes.",
    links: [
      { label: "Java Inheritance - W3Schools", href: "https://www.w3schools.com/java/java_inheritance.asp" },
      { label: "Inheritance - GeeksforGeeks", href: "https://www.geeksforgeeks.org/inheritance-in-java/" },
    ],
  },
  "inherit_override": {
    title: "Method Overriding",
    description: "Override parent class methods in child classes.",
    links: [
      { label: "Method Overriding - GeeksforGeeks", href: "https://www.geeksforgeeks.org/overriding-in-java/" },
    ],
  },
  "inherit_super": {
    title: "super Keyword",
    description: "Access parent class methods and constructors using super.",
    links: [
      { label: "super Keyword - GeeksforGeeks", href: "https://www.geeksforgeeks.org/super-keyword/" },
    ],
  },
  "inherit_chain": {
    title: "Constructor Chaining",
    description: "Understand constructor invocation chain in inheritance.",
    links: [
      { label: "Constructor Chaining - GeeksforGeeks", href: "https://www.geeksforgeeks.org/constructor-chaining-java-examples/" },
    ],
  },
  "inherit_types": {
    title: "Inheritance Types",
    description: "Learn single, multilevel, and hierarchical inheritance.",
    links: [
      { label: "Types of Inheritance - GeeksforGeeks", href: "https://www.geeksforgeeks.org/types-of-inheritance-in-java/" },
    ],
  },

  // Topic 10: Polymorphism
  "poly_overload": {
    title: "Method Overloading",
    description: "Compile-time polymorphism through method overloading.",
    links: [
      { label: "Method Overloading - W3Schools", href: "https://www.w3schools.com/java/java_methods_overloading.asp" },
      { label: "Overloading - GeeksforGeeks", href: "https://www.geeksforgeeks.org/method-overloading-in-java/" },
    ],
  },
  "poly_override": {
    title: "Method Overriding",
    description: "Runtime polymorphism through method overriding.",
    links: [
      { label: "Java Polymorphism - W3Schools", href: "https://www.w3schools.com/java/java_polymorphism.asp" },
      { label: "Overriding - GeeksforGeeks", href: "https://www.geeksforgeeks.org/overriding-in-java/" },
    ],
  },
  "poly_dynamic": {
    title: "Dynamic Method Dispatch",
    description: "Understand runtime method binding and dynamic polymorphism.",
    links: [
      { label: "Dynamic Method Dispatch - GeeksforGeeks", href: "https://www.geeksforgeeks.org/dynamic-method-dispatch-runtime-polymorphism-java/" },
    ],
  },
  "poly_casting": {
    title: "Upcasting & Downcasting",
    description: "Type casting in inheritance hierarchies.",
    links: [
      { label: "Upcasting Downcasting - GeeksforGeeks", href: "https://www.geeksforgeeks.org/upcasting-vs-downcasting-in-java/" },
    ],
  },

  // Topic 11: Interface and Lambda Expression
  "interface_basics": {
    title: "Interface Basics",
    description: "Define and understand interface contracts in Java.",
    links: [
      { label: "Java Interfaces - W3Schools", href: "https://www.w3schools.com/java/java_interface.asp" },
      { label: "Interfaces - GeeksforGeeks", href: "https://www.geeksforgeeks.org/interfaces-in-java/" },
    ],
  },
  "interface_implement": {
    title: "Implementing Interfaces",
    description: "Implement single and multiple interfaces in classes.",
    links: [
      { label: "Interface Implementation - GeeksforGeeks", href: "https://www.geeksforgeeks.org/implementing-interfaces-in-java/" },
    ],
  },
  "interface_default": {
    title: "Default & Static Methods",
    description: "Use default and static methods in interfaces (Java 8+).",
    links: [
      { label: "Default Methods - GeeksforGeeks", href: "https://www.geeksforgeeks.org/default-methods-java/" },
    ],
  },
  "interface_functional": {
    title: "Functional Interfaces",
    description: "Learn functional interfaces and @FunctionalInterface annotation.",
    links: [
      { label: "Functional Interface - GeeksforGeeks", href: "https://www.geeksforgeeks.org/functional-interfaces-java/" },
    ],
  },
  "lambda_syntax": {
    title: "Lambda Expression Syntax",
    description: "Write concise lambda expressions for functional programming.",
    links: [
      { label: "Java Lambda - W3Schools", href: "https://www.w3schools.com/java/java_lambda.asp" },
      { label: "Lambda Expressions - GeeksforGeeks", href: "https://www.geeksforgeeks.org/lambda-expressions-java-8/" },
    ],
  },

  // Topic 12: Recursion and Revision
  "recursion_basics": {
    title: "Recursion Basics & Base Cases",
    description: "Understand recursive function calls and base case importance.",
    links: [
      { label: "Java Recursion - W3Schools", href: "https://www.w3schools.com/java/java_recursion.asp" },
      { label: "Recursion - GeeksforGeeks", href: "https://www.geeksforgeeks.org/recursion-in-java/" },
    ],
  },
  "recursion_vs_iterative": {
    title: "Recursive vs Iterative",
    description: "Compare recursive and iterative approaches to problem-solving.",
    links: [
      { label: "Recursion vs Iteration - GeeksforGeeks", href: "https://www.geeksforgeeks.org/difference-between-recursion-and-iteration/" },
    ],
  },
  "recursion_patterns": {
    title: "Common Recursive Patterns",
    description: "Learn factorial, fibonacci, and tree traversal patterns.",
    links: [
      { label: "Recursion Practice - GeeksforGeeks", href: "https://www.geeksforgeeks.org/recursion-practice-problems-solutions/" },
    ],
  },
  "revision_comprehensive": {
    title: "Comprehensive Review",
    description: "Review all Java fundamentals and prepare for advanced topics.",
    links: [
      { label: "Java Tutorial - W3Schools", href: "https://www.w3schools.com/java/" },
      { label: "Java Programming - GeeksforGeeks", href: "https://www.geeksforgeeks.org/java/" },
    ],
  },
};
export const JAVA_SUBTOPIC_IDS = Object.keys(subtopicContent);
export const JAVA_SUBTOPIC_COUNT = JAVA_SUBTOPIC_IDS.length;

// Topic grouping for prerequisite gating
// Each group must be fully completed before the next group unlocks
export const TOPIC_GROUPS = [
  { id: 1, label: "Bridging from Python", subtopics: ["python_syntax", "python_types", "python_compilation", "python_structure"] },
  { id: 2, label: "Problem Solving with Java", subtopics: ["ps_algorithm", "ps_pseudocode", "ps_debugging", "ps_optimization"] },
  { id: 3, label: "String", subtopics: ["string_basics", "string_methods", "string_builder", "string_pool"] },
  { id: 4, label: "Array", subtopics: ["array_basics", "array_traversal", "array_multidim", "array_utilities"] },
  { id: 5, label: "Methods", subtopics: ["method_declaration", "method_params", "method_overloading", "method_varargs"] },
  { id: 6, label: "Exception Handling & File IO", subtopics: ["exception_trycatch", "exception_types", "exception_custom", "file_io"] },
  { id: 7, label: "Class Basics", subtopics: ["class_declaration", "class_constructor", "class_attributes", "class_methods", "class_this"] },
  { id: 8, label: "Access Modifier/Static", subtopics: ["modifier_access", "modifier_static_var", "modifier_static_method", "modifier_static_block", "modifier_final"] },
  { id: 9, label: "Inheritance", subtopics: ["inherit_extends", "inherit_override", "inherit_super", "inherit_chain", "inherit_types"] },
  { id: 10, label: "Polymorphism", subtopics: ["poly_overload", "poly_override", "poly_dynamic", "poly_casting"] },
  { id: 11, label: "Interface & Lambda", subtopics: ["interface_basics", "interface_implement", "interface_default", "interface_functional", "lambda_syntax"] },
  { id: 12, label: "Recursion & Revision", subtopics: ["recursion_basics", "recursion_vs_iterative", "recursion_patterns", "revision_comprehensive"] },
];

// Helper: check if a subtopic's prerequisites are completed
// Returns true if the previous group is fully completed (no warning needed)
export function isSubtopicUnlocked(subtopicId, completedTopics) {
  const groupIndex = TOPIC_GROUPS.findIndex(g => g.subtopics.includes(subtopicId));
  if (groupIndex <= 0) return true; // Topic 1 always has no prerequisites
  // Previous group must be fully completed for no warning
  const prevGroup = TOPIC_GROUPS[groupIndex - 1];
  return prevGroup.subtopics.every(id => completedTopics.includes(id));
}

// Helper: get the list of incomplete prerequisite topic names for a subtopic
export function getMissingPrerequisites(subtopicId, completedTopics) {
  const groupIndex = TOPIC_GROUPS.findIndex(g => g.subtopics.includes(subtopicId));
  if (groupIndex <= 0) return [];
  const prevGroup = TOPIC_GROUPS[groupIndex - 1];
  const missing = prevGroup.subtopics.filter(id => !completedTopics.includes(id));
  return { groupLabel: prevGroup.label, missing };
}

// Helper: get the group index (0-based) a subtopic belongs to
export function getSubtopicGroupIndex(subtopicId) {
  return TOPIC_GROUPS.findIndex(g => g.subtopics.includes(subtopicId));
}


const fallbackLinks = Object.keys(subtopicContent).reduce((acc, key) => {
  acc[key] = subtopicContent[key].links;
  return acc;
}, {});

const topicDescriptions = Object.keys(subtopicContent).reduce((acc, key) => {
  acc[key] = subtopicContent[key].description;
  return acc;
}, {});

// ----------------- Helpers -----------------

const makeNode = (
  id,
  x,
  y,
  label,
  { width = 200, bg = "#FFE8AA", border = "#E0B354", bold = false, fontSize = 15 } = {}
) => ({
  id: String(id),
  position: { x, y },
  data: { label },
  style: {
    width,
    padding: 10,
    borderRadius: 8,
    background: bg,
    border: `2px solid ${border}`,
    fontWeight: bold ? 600 : 500,
    fontSize,
    textAlign: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    cursor: "pointer",
    zIndex: 10,
  },
});

const makeTopicHeader = (
  id,
  x,
  y,
  label,
  { width = 260 } = {}
) => ({
  id: String(id),
  position: { x, y },
  data: { label },
  style: {
    width,
    padding: 12,
    borderRadius: 8,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    border: "2px solid #5a67d8",
    fontWeight: 700,
    fontSize: 17,
    color: "#FFFFFF",
    textAlign: "center",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    cursor: "default",
    pointerEvents: "none",
    zIndex: 5,
  },
  selectable: false,
  draggable: false,
});

// ----------------- Roadmap with Subtopics -----------------

// 4-sub x positions (span ~950px)
const X4 = [60, 300, 540, 780];
// 5-sub x positions
const X5 = [10, 200, 400, 600, 790];
const SUB_W = 190; // default subtopic width
const SUB_W5 = 175; // narrower for 5-sub groups
// vertical spacing: header → subs 80px, between-group gap 140px → 220px per group
const gy = (n) => 80 + (n - 1) * 220;  // header y for group n
const sy = (n) => gy(n) + 80;           // subtopic y for group n

const initialNodes = [
  // Root
  makeNode("root", 350, 5, "☕ Java Learning Path", {
    width: 280,
    bold: true,
    bg: "#6366F1",
    border: "#4F46E5",
    fontSize: 18,
  }),

  // === TOPIC 1: Bridging from Python (4 subs) ===
  makeTopicHeader("topic1", 340, gy(1), "1. Bridging from Python", { width: 280 }),
  makeNode("python_syntax",       X4[0], sy(1), "Syntax Comparison",          { width: SUB_W }),
  makeNode("python_types",        X4[1], sy(1), "Type System Differences",    { width: SUB_W }),
  makeNode("python_compilation",  X4[2], sy(1), "Compilation vs Interpretation", { width: SUB_W }),
  makeNode("python_structure",    X4[3], sy(1), "Basic Program Structure",    { width: SUB_W }),

  // === TOPIC 2: Problem Solving (4 subs) ===
  makeTopicHeader("topic2", 325, gy(2), "2. Problem Solving with Java", { width: 310 }),
  makeNode("ps_algorithm",    X4[0], sy(2), "Algorithm Design",     { width: SUB_W }),
  makeNode("ps_pseudocode",   X4[1], sy(2), "Pseudocode to Java",   { width: SUB_W }),
  makeNode("ps_debugging",    X4[2], sy(2), "Debugging Techniques",  { width: SUB_W }),
  makeNode("ps_optimization", X4[3], sy(2), "Code Optimization",     { width: SUB_W }),

  // === TOPIC 3: String (4 subs) ===
  makeTopicHeader("topic3", 370, gy(3), "3. String", { width: 220 }),
  makeNode("string_basics",   X4[0], sy(3), "String Basics",          { width: SUB_W }),
  makeNode("string_methods",  X4[1], sy(3), "Common Methods",         { width: SUB_W }),
  makeNode("string_builder",  X4[2], sy(3), "StringBuilder/Buffer",   { width: SUB_W }),
  makeNode("string_pool",     X4[3], sy(3), "String Pool & Memory",   { width: SUB_W }),

  // === TOPIC 4: Array (4 subs) ===
  makeTopicHeader("topic4", 370, gy(4), "4. Array", { width: 220 }),
  makeNode("array_basics",     X4[0], sy(4), "Declaration & Init",       { width: SUB_W }),
  makeNode("array_traversal",  X4[1], sy(4), "Traversal & Manipulation", { width: SUB_W }),
  makeNode("array_multidim",   X4[2], sy(4), "Multi-dimensional",        { width: SUB_W }),
  makeNode("array_utilities",  X4[3], sy(4), "Arrays Utilities",         { width: SUB_W }),

  // === TOPIC 5: Methods (4 subs) ===
  makeTopicHeader("topic5", 370, gy(5), "5. Methods", { width: 220 }),
  makeNode("method_declaration",  X4[0], sy(5), "Declaration & Syntax",  { width: SUB_W }),
  makeNode("method_params",       X4[1], sy(5), "Parameters & Return",   { width: SUB_W }),
  makeNode("method_overloading",  X4[2], sy(5), "Method Overloading",    { width: SUB_W }),
  makeNode("method_varargs",      X4[3], sy(5), "Variable Arguments",    { width: SUB_W }),

  // === TOPIC 6: Exception & File IO (4 subs) ===
  makeTopicHeader("topic6", 310, gy(6), "6. Exception Handling & File IO", { width: 340 }),
  makeNode("exception_trycatch", X4[0], sy(6), "Try-Catch-Finally",   { width: SUB_W }),
  makeNode("exception_types",    X4[1], sy(6), "Exception Types",     { width: SUB_W }),
  makeNode("exception_custom",   X4[2], sy(6), "Custom Exceptions",   { width: SUB_W }),
  makeNode("file_io",            X4[3], sy(6), "File Reading/Writing", { width: SUB_W }),

  // === TOPIC 7: Class Basics (5 subs) ===
  makeTopicHeader("topic7", 280, gy(7), "7. Class - Constructor/Attributes/Methods", { width: 400 }),
  makeNode("class_declaration", X5[0], sy(7), "Class Declaration", { width: SUB_W5 }),
  makeNode("class_constructor", X5[1], sy(7), "Constructors",       { width: SUB_W5 }),
  makeNode("class_attributes",  X5[2], sy(7), "Instance Variables", { width: SUB_W5 }),
  makeNode("class_methods",     X5[3], sy(7), "Instance Methods",   { width: SUB_W5 }),
  makeNode("class_this",        X5[4], sy(7), "this Keyword",       { width: SUB_W5 }),

  // === TOPIC 8: Class Advanced (5 subs) ===
  makeTopicHeader("topic8", 290, gy(8), "8. Class - Access Modifier/Static", { width: 380 }),
  makeNode("modifier_access",        X5[0], sy(8), "Access Modifiers",  { width: SUB_W5 }),
  makeNode("modifier_static_var",    X5[1], sy(8), "Static Variables",  { width: SUB_W5 }),
  makeNode("modifier_static_method", X5[2], sy(8), "Static Methods",    { width: SUB_W5 }),
  makeNode("modifier_static_block",  X5[3], sy(8), "Static Blocks",     { width: SUB_W5 }),
  makeNode("modifier_final",         X5[4], sy(8), "final Keyword",     { width: SUB_W5 }),

  // === TOPIC 9: Inheritance (5 subs) ===
  makeTopicHeader("topic9", 340, gy(9), "9. Inheritance", { width: 280 }),
  makeNode("inherit_extends",  X5[0], sy(9), "extends Keyword",       { width: SUB_W5 }),
  makeNode("inherit_override", X5[1], sy(9), "Method Overriding",     { width: SUB_W5 }),
  makeNode("inherit_super",    X5[2], sy(9), "super Keyword",         { width: SUB_W5 }),
  makeNode("inherit_chain",    X5[3], sy(9), "Constructor Chaining",  { width: SUB_W5 }),
  makeNode("inherit_types",    X5[4], sy(9), "Inheritance Types",     { width: SUB_W5 }),

  // === TOPIC 10: Polymorphism (4 subs) ===
  makeTopicHeader("topic10", 340, gy(10), "10. Polymorphism", { width: 280 }),
  makeNode("poly_overload", X4[0], sy(10), "Method Overloading",     { width: SUB_W }),
  makeNode("poly_override", X4[1], sy(10), "Method Overriding",      { width: SUB_W }),
  makeNode("poly_dynamic",  X4[2], sy(10), "Dynamic Dispatch",       { width: SUB_W }),
  makeNode("poly_casting",  X4[3], sy(10), "Upcasting/Downcasting",  { width: SUB_W }),

  // === TOPIC 11: Interface & Lambda (5 subs) ===
  makeTopicHeader("topic11", 300, gy(11), "11. Interface & Lambda Expression", { width: 360 }),
  makeNode("interface_basics",     X5[0], sy(11), "Interface Basics",       { width: SUB_W5 }),
  makeNode("interface_implement",  X5[1], sy(11), "Implementing Interfaces", { width: SUB_W5 }),
  makeNode("interface_default",    X5[2], sy(11), "Default/Static Methods", { width: SUB_W5 }),
  makeNode("interface_functional", X5[3], sy(11), "Functional Interfaces",  { width: SUB_W5 }),
  makeNode("lambda_syntax",        X5[4], sy(11), "Lambda Syntax",          { width: SUB_W5 }),

  // === TOPIC 12: Recursion & Revision (4 subs) ===
  makeTopicHeader("topic12", 330, gy(12), "12. Recursion & Revision", { width: 300 }),
  makeNode("recursion_basics",         X4[0], sy(12), "Recursion Basics",     { width: SUB_W }),
  makeNode("recursion_vs_iterative",   X4[1], sy(12), "Recursive vs Iterative", { width: SUB_W }),
  makeNode("recursion_patterns",       X4[2], sy(12), "Common Patterns",      { width: SUB_W }),
  makeNode("revision_comprehensive",   X4[3], sy(12), "Comprehensive Review", { width: SUB_W, bg: "#10B981", border: "#059669", bold: true }),
];

// Between-group animated edge style
const groupEdge = { animated: true, style: { stroke: "#6366F1", strokeWidth: 3 } };

const initialEdges = [
  // Root → Topic 1
  { id: "root-t1", source: "root", target: "topic1", ...groupEdge },

  // Topic 1 fan-out
  { id: "t1-a", source: "topic1", target: "python_syntax" },
  { id: "t1-b", source: "topic1", target: "python_types" },
  { id: "t1-c", source: "topic1", target: "python_compilation" },
  { id: "t1-d", source: "topic1", target: "python_structure" },

  // Topic 1 → Topic 2
  { id: "g1-g2", source: "topic1", target: "topic2", ...groupEdge },

  // Topic 2 fan-out
  { id: "t2-a", source: "topic2", target: "ps_algorithm" },
  { id: "t2-b", source: "topic2", target: "ps_pseudocode" },
  { id: "t2-c", source: "topic2", target: "ps_debugging" },
  { id: "t2-d", source: "topic2", target: "ps_optimization" },

  // Topic 2 → Topic 3
  { id: "g2-g3", source: "topic2", target: "topic3", ...groupEdge },

  // Topic 3 fan-out
  { id: "t3-a", source: "topic3", target: "string_basics" },
  { id: "t3-b", source: "topic3", target: "string_methods" },
  { id: "t3-c", source: "topic3", target: "string_builder" },
  { id: "t3-d", source: "topic3", target: "string_pool" },

  // Topic 3 → Topic 4
  { id: "g3-g4", source: "topic3", target: "topic4", ...groupEdge },

  // Topic 4 fan-out
  { id: "t4-a", source: "topic4", target: "array_basics" },
  { id: "t4-b", source: "topic4", target: "array_traversal" },
  { id: "t4-c", source: "topic4", target: "array_multidim" },
  { id: "t4-d", source: "topic4", target: "array_utilities" },

  // Topic 4 → Topic 5
  { id: "g4-g5", source: "topic4", target: "topic5", ...groupEdge },

  // Topic 5 fan-out
  { id: "t5-a", source: "topic5", target: "method_declaration" },
  { id: "t5-b", source: "topic5", target: "method_params" },
  { id: "t5-c", source: "topic5", target: "method_overloading" },
  { id: "t5-d", source: "topic5", target: "method_varargs" },

  // Topic 5 → Topic 6
  { id: "g5-g6", source: "topic5", target: "topic6", ...groupEdge },

  // Topic 6 fan-out
  { id: "t6-a", source: "topic6", target: "exception_trycatch" },
  { id: "t6-b", source: "topic6", target: "exception_types" },
  { id: "t6-c", source: "topic6", target: "exception_custom" },
  { id: "t6-d", source: "topic6", target: "file_io" },

  // Topic 6 → Topic 7
  { id: "g6-g7", source: "topic6", target: "topic7", ...groupEdge },

  // Topic 7 fan-out (5 subs)
  { id: "t7-a", source: "topic7", target: "class_declaration" },
  { id: "t7-b", source: "topic7", target: "class_constructor" },
  { id: "t7-c", source: "topic7", target: "class_attributes" },
  { id: "t7-d", source: "topic7", target: "class_methods" },
  { id: "t7-e", source: "topic7", target: "class_this" },

  // Topic 7 → Topic 8
  { id: "g7-g8", source: "topic7", target: "topic8", ...groupEdge },

  // Topic 8 fan-out (5 subs)
  { id: "t8-a", source: "topic8", target: "modifier_access" },
  { id: "t8-b", source: "topic8", target: "modifier_static_var" },
  { id: "t8-c", source: "topic8", target: "modifier_static_method" },
  { id: "t8-d", source: "topic8", target: "modifier_static_block" },
  { id: "t8-e", source: "topic8", target: "modifier_final" },

  // Topic 8 → Topic 9
  { id: "g8-g9", source: "topic8", target: "topic9", ...groupEdge },

  // Topic 9 fan-out (5 subs)
  { id: "t9-a", source: "topic9", target: "inherit_extends" },
  { id: "t9-b", source: "topic9", target: "inherit_override" },
  { id: "t9-c", source: "topic9", target: "inherit_super" },
  { id: "t9-d", source: "topic9", target: "inherit_chain" },
  { id: "t9-e", source: "topic9", target: "inherit_types" },

  // Topic 9 → Topic 10
  { id: "g9-g10", source: "topic9", target: "topic10", ...groupEdge },

  // Topic 10 fan-out
  { id: "t10-a", source: "topic10", target: "poly_overload" },
  { id: "t10-b", source: "topic10", target: "poly_override" },
  { id: "t10-c", source: "topic10", target: "poly_dynamic" },
  { id: "t10-d", source: "topic10", target: "poly_casting" },

  // Topic 10 → Topic 11
  { id: "g10-g11", source: "topic10", target: "topic11", ...groupEdge },

  // Topic 11 fan-out (5 subs)
  { id: "t11-a", source: "topic11", target: "interface_basics" },
  { id: "t11-b", source: "topic11", target: "interface_implement" },
  { id: "t11-c", source: "topic11", target: "interface_default" },
  { id: "t11-d", source: "topic11", target: "interface_functional" },
  { id: "t11-e", source: "topic11", target: "lambda_syntax" },

  // Topic 11 → Topic 12
  { id: "g11-g12", source: "topic11", target: "topic12", ...groupEdge },

  // Topic 12 fan-out
  { id: "t12-a", source: "topic12", target: "recursion_basics" },
  { id: "t12-b", source: "topic12", target: "recursion_vs_iterative" },
  { id: "t12-c", source: "topic12", target: "recursion_patterns" },
  { id: "t12-d", source: "topic12", target: "revision_comprehensive" },
];

// ----------------- Component -----------------

export default function JavaRoadmap() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [completedTopics, setCompletedTopics] = useState(() => {
    const saved = localStorage.getItem('java-roadmap-completed');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionTopics, setSuggestionTopics] = useState([]);

  // Show quiz/test suggestion when ≥2 groups are complete but user has no attempts yet
  useEffect(() => {
    const dismissed = sessionStorage.getItem('suggestionDismissed');
    if (dismissed) return;

    const progress = new ProgressTracker().getProgress();
    const quizAttempts = progress?.quizzes?.attempted || 0;
    const testAttempts = progress?.tests?.attempted || 0;
    if (quizAttempts > 0 || testAttempts > 0) return; // already attempted

    // Count fully-completed groups
    const completedGroups = TOPIC_GROUPS.filter(g =>
      g.subtopics.every(id => completedTopics.includes(id))
    );
    if (completedGroups.length < 2) return;

    // Take the two most recently completed groups to suggest
    const suggested = completedGroups.slice(-2).map(g => g.label);
    setSuggestionTopics(suggested);
    setShowSuggestion(true);
  }, [completedTopics]);

  const dismissSuggestion = () => {
    sessionStorage.setItem('suggestionDismissed', '1');
    setShowSuggestion(false);
  };

  const handleViewDocument = useCallback((file, source) => {
    setViewingDocument({ file, source });
  }, []);

  const closeDocumentViewer = useCallback(() => {
    setViewingDocument(null);
  }, []);

  useEffect(() => {
    localStorage.setItem('java-roadmap-completed', JSON.stringify(completedTopics));
  }, [completedTopics]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.style?.cursor === "pointer") {
          const originalBg = node.data?.originalBg || "#FFE8AA";
          const originalBorder = node.data?.originalBorder || "#E0B354";
          const unlocked = isSubtopicUnlocked(node.id, completedTopics);

          if (completedTopics.includes(node.id) && unlocked) {
            // ✅ Completed with prerequisites met — solid green
            const label = node.data.label;
            return {
              ...node,
              data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder },
              style: { ...node.style, background: "#86EFAC", border: "2px solid #22C55E", opacity: 1, cursor: "pointer" },
            };
          } else if (completedTopics.includes(node.id) && !unlocked) {
            // ✅⚠️ Completed but prerequisites skipped — blue
            const label = node.data.label;
            return {
              ...node,
              data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder },
              style: { ...node.style, background: "#DBEAFE", border: "2px solid #3B82F6", opacity: 1, cursor: "pointer" },
            };
          } else if (!unlocked) {
            // ⚠️ Prerequisites not met — warning style (amber), still clickable
            const label = node.data.label;
            return {
              ...node,
              data: { ...node.data, label: `⚠️ ${label.replace(/^⚠️ /, '')}`, originalBg, originalBorder },
              style: { ...node.style, background: "#FEF3C7", border: "2px dashed #F59E0B", opacity: 0.85, cursor: "pointer" },
            };
          } else {
            // 🔓 Prerequisites met, not completed — normal
            const label = node.data.label;
            return {
              ...node,
              data: { ...node.data, label: label.replace(/^⚠️ /, ''), originalBg, originalBorder },
              style: { ...node.style, background: originalBg, border: `2px solid ${originalBorder}`, opacity: 1, cursor: "pointer" },
            };
          }
        }
        return node;
      })
    );
  }, [completedTopics, setNodes]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    if (node.style?.pointerEvents !== "none") {
      // Warn if prerequisites aren't met, but still allow proceeding
      if (subtopicContent[node.id] && !isSubtopicUnlocked(node.id, completedTopics)) {
        const { groupLabel, missing } = getMissingPrerequisites(node.id, completedTopics);
        const missingCount = missing.length;
        const proceed = window.confirm(
          `⚠️ Heads up!\n\nYou have ${missingCount} incomplete topic${missingCount > 1 ? 's' : ''} in "${groupLabel}" that may be related to this content.\n\nYou can still continue, but you might miss some foundational concepts.\n\nProceed anyway?`
        );
        if (!proceed) return;
      }
      // Navigate to the full-screen topic page
      navigate(`/topic/${node.id}`);
    }
  }, [completedTopics, navigate]);

  const closePanel = () => setSelectedNode(null);

  const toggleCompletion = () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    setCompletedTopics((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
  };

  const getTopicContent = (nodeId) => {
    const subtopic = subtopicContent[nodeId];
    const ragContent = ragDocMapping[nodeId];
    const links = fallbackLinks[nodeId] || [];
    const description = topicDescriptions[nodeId] || "Learn about this Java topic.";

    return {
      title: ragContent?.title || subtopic?.title || selectedNode?.data.label || "Topic Details",
      description: ragContent?.description || description,
      sources: ragContent?.sources || [],
      fallbackLinks: links,
      hasSources: ragContent?.sources && ragContent.sources.length > 0
    };
  };

  const content = selectedNode ? getTopicContent(selectedNode.id) : null;
  const isCompleted = selectedNode && completedTopics.includes(selectedNode.id);
  const isSkippedComplete = isCompleted && selectedNode && !isSubtopicUnlocked(selectedNode.id, completedTopics);

  // Count only subtopic nodes (not headers)
  const totalTopics = Object.keys(subtopicContent).length;
  const completedCount = completedTopics.filter(id => subtopicContent[id]).length;
  const progressPercentage = Math.round((completedCount / totalTopics) * 100);

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-auto">
      {/* Progress bar */}
      <div className="fixed top-12 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-800">Java Learning Roadmap with Subtopics</h1>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-gray-700">Learning Progress</span>
            <span className="text-base font-bold text-indigo-600">{completedCount} / {totalTopics} subtopics</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="text-right mt-1">
            <span className="text-xl font-bold text-indigo-600">{progressPercentage}%</span>
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
          fitViewOptions={{
            padding: 0.08,
            nodes: [
              { id: 'root' },
              { id: 'topic1' }, { id: 'python_syntax' }, { id: 'python_structure' },
              { id: 'topic2' }, { id: 'ps_algorithm' }, { id: 'ps_optimization' },
              { id: 'topic3' }, { id: 'string_basics' }, { id: 'string_pool' },
              { id: 'topic4' }, { id: 'array_basics' }, { id: 'array_utilities' },
            ],
          }}
          minZoom={0.25}
          maxZoom={1.5}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          nodesDraggable={false}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: {
              stroke: "#64748B",
              strokeWidth: 2,
            },
          }}
        >
          <Background variant="dots" gap={16} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Side Panel */}
      <div
        className={`fixed top-[190px] right-0 z-30 w-96 transform bg-white shadow-xl border-l border-gray-200 transition-transform duration-300 ease-out flex flex-col ${
            selectedNode ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ 
            height: 'calc(100vh - 190px)', 
            maxHeight: 'calc(100vh - 190px)'
        }}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-800">
            {content?.title || 'Details'}
            </h2>
            <button
            onClick={closePanel}
            className="rounded-md p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors z-50"
            aria-label="Close"
            >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100vh - 150px)' }}>
            <div className="p-5 space-y-5">
            {content ? (
                <>
                {/* Completion Badge */}
                {isCompleted && !isSkippedComplete && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-base font-semibold text-green-800">Completed! 🎉</span>
                    </div>
                )}
                {isSkippedComplete && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
                    <div className="flex items-center mb-1">
                        <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-base font-semibold text-amber-800">Completed (prerequisites skipped)</span>
                    </div>
                    <p className="text-sm text-amber-700 ml-7">Some earlier topics haven't been completed yet. Consider reviewing them to fill any gaps.</p>
                    </div>
                )}

                {/* Completion Badge */}
                {isCompleted && !isSkippedComplete && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-base font-semibold text-green-800">Completed! 🎉</span>
                    </div>
                )}
                {isSkippedComplete && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
                    <div className="flex items-center mb-1">
                        <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-base font-semibold text-amber-800">Completed (prerequisites skipped)</span>
                    </div>
                    <p className="text-sm text-amber-700 ml-7">Some earlier topics haven't been completed yet. Consider reviewing them to fill any gaps.</p>
                    </div>
                )}

                {/* Main Learning Material - Link to Full Screen */}
                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r">
                  <p className="text-sm text-gray-700 mb-3">
                    Read the full learning material for this topic in a dedicated page with full-screen experience.
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = `/learn/${selectedNode.id}`;
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Full Learning Material
                  </button>
                </div>

              {/* External Learning Resources - Secondary Material */}
              {content.hasSources ? (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
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
                            className="w-full flex items-start p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
                          >
                            <div className="flex-shrink-0 mr-3 mt-0.5">
                              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-gray-900 group-hover:text-indigo-700 break-words">
                                {source.file}
                              </div>

                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1"
                                style={{
                                  backgroundColor: colors.bg,
                                  color: colors.text,
                                  border: `1px solid ${colors.border}`
                                }}
                              >
                                {sourceName}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <a 
                      href="/ragAI" 
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center group"
                    >
                      <svg className="w-5 h-5 mr-2 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Ask AI Tutor About This Topic
                    </a>
                  </div>
                </div>
              ) : content.fallbackLinks.length > 0 ? (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    External Learning Resources
                  </h3>
                  <ul className="space-y-3">
                    {content.fallbackLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start p-3 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                        >
                          <svg className="w-5 h-5 mr-3 mt-0.5 text-indigo-600 group-hover:text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <div className="flex-1">
                            <div className="text-base font-medium text-gray-900 group-hover:text-indigo-700">
                              {link.label}
                            </div>
                            <div className="text-sm text-gray-500 mt-1 break-all">
                              {new URL(link.href).hostname}
                            </div>
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
                  className={`w-full font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isCompleted ? (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Mark as Incomplete
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark as Completed
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-sm">
                No content available for this topic yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

      <DocumentViewer
        isOpen={viewingDocument !== null}
        onClose={closeDocumentViewer}
        documentFile={viewingDocument?.file}
        documentSource={viewingDocument?.source}
      />

      {/* Quiz & Test Suggestion Popup */}
      {showSuggestion && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-3">🎯</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Test Yourself?</h2>
            <p className="text-gray-500 text-sm mb-4">
              You've completed chapters including:
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {suggestionTopics.map((t, i) => (
                <span key={i} className="inline-flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 font-semibold py-2 px-4 rounded-lg text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Put your knowledge to the test! Aim for <strong>≥70%</strong> on the quiz and <strong>≥60%</strong> on the practical test to count toward your progress.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  dismissSuggestion();
                  navigate('/quiz', { state: { preSelectedTopics: suggestionTopics } });
                }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Take Quiz
              </button>
              <button
                onClick={() => {
                  dismissSuggestion();
                  navigate('/practical-test');
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Take Practical Test
              </button>
              <button
                onClick={dismissSuggestion}
                className="w-full text-gray-400 hover:text-gray-600 font-medium py-2 px-6 rounded-xl transition-colors text-sm"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
