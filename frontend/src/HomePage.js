import React, { useCallback, useState, useEffect } from "react";
import { ragDocMapping, getSourceColor, formatSourceName } from './ragDocMapping';
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
  { width = 200, bg = "#FFE8AA", border = "#E0B354", bold = false, fontSize = 13 } = {}
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
    fontSize: 15,
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

const initialNodes = [
  // Root
  makeNode("root", 400, 10, "Java Learning Path", { 
    width: 280, 
    bold: true, 
    bg: "#6366F1", 
    border: "#4F46E5",
    fontSize: 16 
  }),

  // === TOPIC 1: Bridging from Python ===
  makeTopicHeader("topic1", 400, 100, "1. Bridging from Python", { width: 260 }),
  makeNode("python_syntax", 200, 160, "Syntax Comparison", { width: 180 }),
  makeNode("python_types", 400, 160, "Type System Differences", { width: 200 }),
  makeNode("python_compilation", 620, 160, "Compilation vs Interpretation", { width: 220 }),
  makeNode("python_structure", 300, 230, "Basic Program Structure", { width: 200 }),

  // === TOPIC 2: Problem Solving ===
  makeTopicHeader("topic2", 400, 310, "2. Problem Solving with Java", { width: 280 }),
  makeNode("ps_algorithm", 200, 370, "Algorithm Design", { width: 170 }),
  makeNode("ps_pseudocode", 400, 370, "Pseudocode to Java", { width: 180 }),
  makeNode("ps_debugging", 600, 370, "Debugging Techniques", { width: 180 }),
  makeNode("ps_optimization", 300, 440, "Code Optimization", { width: 170 }),

  // === TOPIC 3: String ===
  makeTopicHeader("topic3", 400, 520, "3. String", { width: 200 }),
  makeNode("string_basics", 200, 580, "String Basics", { width: 170 }),
  makeNode("string_methods", 400, 580, "Common Methods", { width: 170 }),
  makeNode("string_builder", 600, 580, "StringBuilder/Buffer", { width: 180 }),
  makeNode("string_pool", 400, 650, "String Pool & Memory", { width: 190 }),

  // === TOPIC 4: Array ===
  makeTopicHeader("topic4", 400, 730, "4. Array", { width: 200 }),
  makeNode("array_basics", 200, 790, "Declaration & Init", { width: 170 }),
  makeNode("array_traversal", 400, 790, "Traversal & Manipulation", { width: 200 }),
  makeNode("array_multidim", 620, 790, "Multi-dimensional", { width: 180 }),
  makeNode("array_utilities", 400, 860, "Arrays Utilities", { width: 170 }),

  // === TOPIC 5: Methods ===
  makeTopicHeader("topic5", 400, 940, "5. Methods", { width: 200 }),
  makeNode("method_declaration", 200, 1000, "Declaration & Syntax", { width: 180 }),
  makeNode("method_params", 400, 1000, "Parameters & Return", { width: 180 }),
  makeNode("method_overloading", 600, 1000, "Method Overloading", { width: 180 }),
  makeNode("method_varargs", 400, 1070, "Varargs", { width: 140 }),

  // === TOPIC 6: Exception & File IO ===
  makeTopicHeader("topic6", 400, 1150, "6. Exception Handling & File IO", { width: 300 }),
  makeNode("exception_trycatch", 180, 1210, "Try-Catch-Finally", { width: 170 }),
  makeNode("exception_types", 380, 1210, "Exception Types", { width: 160 }),
  makeNode("exception_custom", 560, 1210, "Custom Exceptions", { width: 180 }),
  makeNode("file_io", 720, 1210, "File Reading/Writing", { width: 180 }),

  // === TOPIC 7: Class Basics ===
  makeTopicHeader("topic7", 400, 1300, "7. Class - Constructor/Attributes/Methods", { width: 360 }),
  makeNode("class_declaration", 150, 1360, "Class Declaration", { width: 170 }),
  makeNode("class_constructor", 340, 1360, "Constructors", { width: 150 }),
  makeNode("class_attributes", 510, 1360, "Instance Variables", { width: 170 }),
  makeNode("class_methods", 700, 1360, "Instance Methods", { width: 160 }),
  makeNode("class_this", 400, 1430, "this Keyword", { width: 150 }),

  // === TOPIC 8: Class Advanced ===
  makeTopicHeader("topic8", 400, 1520, "8. Class - Access Modifier/Static", { width: 320 }),
  makeNode("modifier_access", 180, 1580, "Access Modifiers", { width: 170 }),
  makeNode("modifier_static_var", 370, 1580, "Static Variables", { width: 160 }),
  makeNode("modifier_static_method", 560, 1580, "Static Methods", { width: 160 }),
  makeNode("modifier_static_block", 750, 1580, "Static Blocks", { width: 150 }),
  makeNode("modifier_final", 400, 1650, "final Keyword", { width: 150 }),

  // === TOPIC 9: Inheritance ===
  makeTopicHeader("topic9", 400, 1740, "9. Inheritance", { width: 240 }),
  makeNode("inherit_extends", 180, 1800, "extends Keyword", { width: 170 }),
  makeNode("inherit_override", 370, 1800, "Method Overriding", { width: 180 }),
  makeNode("inherit_super", 570, 1800, "super Keyword", { width: 160 }),
  makeNode("inherit_chain", 270, 1870, "Constructor Chaining", { width: 190 }),
  makeNode("inherit_types", 490, 1870, "Inheritance Types", { width: 180 }),

  // === TOPIC 10: Polymorphism ===
  makeTopicHeader("topic10", 400, 1960, "10. Polymorphism", { width: 260 }),
  makeNode("poly_overload", 200, 2020, "Method Overloading", { width: 180 }),
  makeNode("poly_override", 410, 2020, "Method Overriding", { width: 180 }),
  makeNode("poly_dynamic", 620, 2020, "Dynamic Dispatch", { width: 170 }),
  makeNode("poly_casting", 400, 2090, "Upcasting/Downcasting", { width: 200 }),

  // === TOPIC 11: Interface & Lambda ===
  makeTopicHeader("topic11", 400, 2180, "11. Interface & Lambda Expression", { width: 320 }),
  makeNode("interface_basics", 150, 2240, "Interface Basics", { width: 160 }),
  makeNode("interface_implement", 330, 2240, "Implementing Interfaces", { width: 200 }),
  makeNode("interface_default", 560, 2240, "Default/Static Methods", { width: 200 }),
  makeNode("interface_functional", 740, 2240, "Functional Interfaces", { width: 190 }),
  makeNode("lambda_syntax", 400, 2310, "Lambda Syntax", { width: 160 }),

  // === TOPIC 12: Recursion & Revision ===
  makeTopicHeader("topic12", 400, 2400, "12. Recursion & Revision", { width: 280 }),
  makeNode("recursion_basics", 200, 2460, "Recursion Basics", { width: 170 }),
  makeNode("recursion_vs_iterative", 410, 2460, "Recursive vs Iterative", { width: 200 }),
  makeNode("recursion_patterns", 640, 2460, "Common Patterns", { width: 170 }),
  makeNode("revision_comprehensive", 400, 2530, "Comprehensive Review", { width: 210, bg: "#10B981", border: "#059669", bold: true }),
];

const initialEdges = [
  // Root to Topic 1
  { id: "root-t1", source: "root", target: "topic1" },

  // Topic 1 connections
  { id: "t1-ps", source: "topic1", target: "python_syntax" },
  { id: "t1-pt", source: "topic1", target: "python_types" },
  { id: "t1-pc", source: "topic1", target: "python_compilation" },
  { id: "t1-pst", source: "topic1", target: "python_structure" },

  // Topic 1 to Topic 2
  { id: "t1-t2", source: "python_structure", target: "topic2" },

  // Topic 2 connections
  { id: "t2-alg", source: "topic2", target: "ps_algorithm" },
  { id: "t2-pseudo", source: "topic2", target: "ps_pseudocode" },
  { id: "t2-debug", source: "topic2", target: "ps_debugging" },
  { id: "t2-opt", source: "topic2", target: "ps_optimization" },

  // Topic 2 to Topic 3
  { id: "t2-t3", source: "ps_optimization", target: "topic3" },

  // Topic 3 connections
  { id: "t3-sb", source: "topic3", target: "string_basics" },
  { id: "t3-sm", source: "topic3", target: "string_methods" },
  { id: "t3-sbuild", source: "topic3", target: "string_builder" },
  { id: "t3-sp", source: "topic3", target: "string_pool" },

  // Topic 3 to Topic 4
  { id: "t3-t4", source: "string_pool", target: "topic4" },

  // Topic 4 connections
  { id: "t4-ab", source: "topic4", target: "array_basics" },
  { id: "t4-at", source: "topic4", target: "array_traversal" },
  { id: "t4-am", source: "topic4", target: "array_multidim" },
  { id: "t4-au", source: "topic4", target: "array_utilities" },

  // Topic 4 to Topic 5
  { id: "t4-t5", source: "array_utilities", target: "topic5" },

  // Topic 5 connections
  { id: "t5-md", source: "topic5", target: "method_declaration" },
  { id: "t5-mp", source: "topic5", target: "method_params" },
  { id: "t5-mo", source: "topic5", target: "method_overloading" },
  { id: "t5-mv", source: "topic5", target: "method_varargs" },

  // Topic 5 to Topic 6
  { id: "t5-t6", source: "method_varargs", target: "topic6" },

  // Topic 6 connections
  { id: "t6-tc", source: "topic6", target: "exception_trycatch" },
  { id: "t6-et", source: "topic6", target: "exception_types" },
  { id: "t6-ec", source: "topic6", target: "exception_custom" },
  { id: "t6-fi", source: "topic6", target: "file_io" },

  // Topic 6 to Topic 7
  { id: "t6-t7", source: "file_io", target: "topic7" },

  // Topic 7 connections
  { id: "t7-cd", source: "topic7", target: "class_declaration" },
  { id: "t7-cc", source: "topic7", target: "class_constructor" },
  { id: "t7-ca", source: "topic7", target: "class_attributes" },
  { id: "t7-cm", source: "topic7", target: "class_methods" },
  { id: "t7-th", source: "topic7", target: "class_this" },

  // Topic 7 to Topic 8
  { id: "t7-t8", source: "class_this", target: "topic8" },

  // Topic 8 connections
  { id: "t8-ma", source: "topic8", target: "modifier_access" },
  { id: "t8-sv", source: "topic8", target: "modifier_static_var" },
  { id: "t8-sm", source: "topic8", target: "modifier_static_method" },
  { id: "t8-sb", source: "topic8", target: "modifier_static_block" },
  { id: "t8-mf", source: "topic8", target: "modifier_final" },

  // Topic 8 to Topic 9
  { id: "t8-t9", source: "modifier_final", target: "topic9" },

  // Topic 9 connections
  { id: "t9-ie", source: "topic9", target: "inherit_extends" },
  { id: "t9-io", source: "topic9", target: "inherit_override" },
  { id: "t9-is", source: "topic9", target: "inherit_super" },
  { id: "t9-ic", source: "topic9", target: "inherit_chain" },
  { id: "t9-it", source: "topic9", target: "inherit_types" },

  // Topic 9 to Topic 10
  { id: "t9-t10", source: "inherit_types", target: "topic10" },

  // Topic 10 connections
  { id: "t10-pol", source: "topic10", target: "poly_overload" },
  { id: "t10-pov", source: "topic10", target: "poly_override" },
  { id: "t10-pd", source: "topic10", target: "poly_dynamic" },
  { id: "t10-pc", source: "topic10", target: "poly_casting" },

  // Topic 10 to Topic 11
  { id: "t10-t11", source: "poly_casting", target: "topic11" },

  // Topic 11 connections
  { id: "t11-ib", source: "topic11", target: "interface_basics" },
  { id: "t11-ii", source: "topic11", target: "interface_implement" },
  { id: "t11-id", source: "topic11", target: "interface_default" },
  { id: "t11-if", source: "topic11", target: "interface_functional" },
  { id: "t11-ls", source: "topic11", target: "lambda_syntax" },

  // Topic 11 to Topic 12
  { id: "t11-t12", source: "lambda_syntax", target: "topic12" },

  // Topic 12 connections
  { id: "t12-rb", source: "topic12", target: "recursion_basics" },
  { id: "t12-rv", source: "topic12", target: "recursion_vs_iterative" },
  { id: "t12-rp", source: "topic12", target: "recursion_patterns" },
  { id: "t12-rc", source: "topic12", target: "revision_comprehensive" },
];

// ----------------- Component -----------------

export default function JavaRoadmap() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [completedTopics, setCompletedTopics] = useState(() => {
    const saved = localStorage.getItem('java-roadmap-completed');
    return saved ? JSON.parse(saved) : [];
  });

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

          if (completedTopics.includes(node.id)) {
            return {
              ...node,
              data: { ...node.data, originalBg, originalBorder },
              style: { ...node.style, background: "#86EFAC", border: "2px solid #22C55E" },
            };
          } else {
            return {
              ...node,
              data: { ...node.data, originalBg, originalBorder },
              style: { ...node.style, background: originalBg, border: `2px solid ${originalBorder}` },
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
      setSelectedNode(node);
    }
  }, []);

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
            <h1 className="text-lg font-bold text-gray-800">Java Learning Roadmap with Subtopics</h1>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-700">Learning Progress</span>
            <span className="text-sm font-bold text-indigo-600">{completedCount} / {totalTopics} subtopics</span>
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
          minZoom={0.3}
          maxZoom={1.2}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          nodesDraggable={false}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: {
              stroke: "#9CA3AF",
              strokeWidth: 1.5,
            },
          }}
        >
          <Background variant="dots" gap={16} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Slide-out panel */}
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
                {isCompleted && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-semibold text-green-800">Completed! 🎉</span>
                    </div>
                )}

                {/* Description */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                    <p className="text-sm text-gray-700 leading-relaxed">
                    {content.description}
                    </p>
          </div>

              {/* RAG Sources or Fallback Links */}
              {content.hasSources ? (
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Knowledge Base Sources ({content.sources.length})
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
                              <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 break-words">
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
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Learning Resources
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
                            <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                              {link.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 break-all">
                              {new URL(link.href).hostname}
                            </div>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded">
                  No learning resources available for this topic yet.
                </div>
              )}

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
    </div>
  );
}
