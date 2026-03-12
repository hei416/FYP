#!/usr/bin/env python3
"""
Add external resources (learning URLs) to each topic in topicContent.json
"""
import json

# External resources from the side panel (subtopicContent.links)
EXTERNAL_RESOURCES = {
    "python_syntax": [
        {"label": "Python vs Java - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/python/java-vs-python-which-one-should-i-learn/"},
        {"label": "Java Syntax - W3Schools", "href": "https://www.w3schools.com/java/java_syntax.asp"},
    ],
    "python_types": [
        {"label": "Java Data Types - W3Schools", "href": "https://www.w3schools.com/java/java_data_types.asp"},
        {"label": "Type System - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/data-types-in-java/"},
    ],
    "python_compilation": [
        {"label": "Java Program Execution - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/java-program-execution-process/"},
    ],
    "python_structure": [
        {"label": "Java Syntax - W3Schools", "href": "https://www.w3schools.com/java/java_syntax.asp"},
        {"label": "First Java Program - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/java-hello-world-program/"},
    ],
    "ps_algorithm": [
        {"label": "Java Algorithms - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/fundamentals-of-algorithms/"},
    ],
    "ps_pseudocode": [
        {"label": "Java Examples - W3Schools", "href": "https://www.w3schools.com/java/java_examples.asp"},
    ],
    "ps_debugging": [
        {"label": "Debugging in Java - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/debugging-java-program/"},
    ],
    "ps_optimization": [
        {"label": "Java Best Practices - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/java-coding-best-practices/"},
    ],
    "string_basics": [
        {"label": "Java Strings - W3Schools", "href": "https://www.w3schools.com/java/java_strings.asp"},
        {"label": "String in Java - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/strings-in-java/"},
    ],
    "string_methods": [
        {"label": "String Methods - W3Schools", "href": "https://www.w3schools.com/java/java_ref_string.asp"},
        {"label": "String Methods - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/string-class-in-java/"},
    ],
    "string_builder": [
        {"label": "StringBuilder - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/stringbuilder-class-in-java-with-examples/"},
        {"label": "StringBuffer - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/stringbuffer-class-in-java/"},
    ],
    "string_pool": [
        {"label": "String Pool - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/string-pool-in-java/"},
    ],
    "array_basics": [
        {"label": "Java Arrays - W3Schools", "href": "https://www.w3schools.com/java/java_arrays.asp"},
        {"label": "Arrays in Java - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/arrays-in-java/"},
    ],
    "array_traversal": [
        {"label": "Array Traversal - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/array-traversal/"},
    ],
    "array_multidim": [
        {"label": "Multidimensional Arrays - W3Schools", "href": "https://www.w3schools.com/java/java_arrays_multi.asp"},
        {"label": "2D Arrays - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/multidimensional-arrays-in-java/"},
    ],
    "array_utilities": [
        {"label": "Java Arrays Utility - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/arrays-class-in-java/"},
    ],
    "method_declaration": [
        {"label": "Java Methods - W3Schools", "href": "https://www.w3schools.com/java/java_methods.asp"},
    ],
    "method_params": [
        {"label": "Method Parameters - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/methods-in-java/"},
    ],
    "method_overloading": [
        {"label": "Method Overloading - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/method-overloading-in-java/"},
    ],
    "method_varargs": [
        {"label": "Varargs - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/variable-arguments-varargs-in-java/"},
    ],
    "exception_trycatch": [
        {"label": "Try-Catch - W3Schools", "href": "https://www.w3schools.com/java/java_try_catch.asp"},
        {"label": "Exception Handling - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/exceptions-in-java/"},
    ],
    "exception_types": [
        {"label": "Exception Types - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/exceptions-in-java/"},
    ],
    "exception_custom": [
        {"label": "Custom Exceptions - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/create-custom-exception-in-java/"},
    ],
    "file_io": [
        {"label": "File I/O - W3Schools", "href": "https://www.w3schools.com/java/java_files.asp"},
        {"label": "File Handling - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/file-handling-java-using-filewriter-and-filereader/"},
    ],
    "class_declaration": [
        {"label": "Java Classes - W3Schools", "href": "https://www.w3schools.com/java/java_classes.asp"},
    ],
    "class_constructor": [
        {"label": "Constructors - W3Schools", "href": "https://www.w3schools.com/java/java_constructors.asp"},
        {"label": "Constructors - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/constructors-in-java/"},
    ],
    "class_attributes": [
        {"label": "Attributes - W3Schools", "href": "https://www.w3schools.com/java/java_variables.asp"},
    ],
    "class_methods": [
        {"label": "Methods - W3Schools", "href": "https://www.w3schools.com/java/java_methods.asp"},
    ],
    "class_this": [
        {"label": "This Keyword - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/this-reference-in-java/"},
    ],
    "modifier_access": [
        {"label": "Access Modifiers - W3Schools", "href": "https://www.w3schools.com/java/java_modifiers.asp"},
        {"label": "Access Modifiers - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/access-modifiers-in-java/"},
    ],
    "modifier_static_var": [
        {"label": "Static Variables - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/static-keyword-in-java/"},
    ],
    "modifier_static_method": [
        {"label": "Static Methods - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/static-keyword-in-java/"},
    ],
    "modifier_static_block": [
        {"label": "Static Blocks - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/g-fact-26-the-initializer-block-in-java/"},
    ],
    "modifier_final": [
        {"label": "Final Keyword - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/final-keyword-in-java/"},
    ],
    "inherit_extends": [
        {"label": "Inheritance - W3Schools", "href": "https://www.w3schools.com/java/java_inheritance.asp"},
        {"label": "Inheritance - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/inheritance-in-java/"},
    ],
    "inherit_override": [
        {"label": "Method Overriding - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/overriding-in-java/"},
    ],
    "inherit_super": [
        {"label": "Super Keyword - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/super-keyword/"},
    ],
    "inherit_chain": [
        {"label": "Multilevel Inheritance - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/multilevel-inheritance-in-java/"},
    ],
    "inherit_types": [
        {"label": "Types of Inheritance - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/inheritance-in-java/"},
    ],
    "poly_overload": [
        {"label": "Method Overloading - W3Schools", "href": "https://www.w3schools.com/java/java_methods_overloading.asp"},
        {"label": "Polymorphism - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/polymorphism-in-java/"},
    ],
    "poly_override": [
        {"label": "Method Overriding - W3Schools", "href": "https://www.w3schools.com/java/java_polymorphism.asp"},
    ],
    "poly_dynamic": [
        {"label": "Dynamic Dispatch - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/dynamic-method-dispatch-runtime-polymorphism-in-java/"},
    ],
    "poly_casting": [
        {"label": "Type Casting - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/type-casting-in-java/"},
        {"label": "instanceof - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/instanceof-operator-in-java/"},
    ],
    "interface_basics": [
        {"label": "Interfaces - W3Schools", "href": "https://www.w3schools.com/java/java_interface.asp"},
        {"label": "Interfaces - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/interfaces-in-java/"},
    ],
    "interface_implement": [
        {"label": "Implementing Interfaces - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/interfaces-in-java/"},
    ],
    "interface_default": [
        {"label": "Default Methods - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/default-methods-in-java/"},
    ],
    "interface_functional": [
        {"label": "Functional Interfaces - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/functional-interfaces-java/"},
    ],
    "lambda_syntax": [
        {"label": "Lambda Expressions - W3Schools", "href": "https://www.w3schools.com/java/java_lambda.asp"},
        {"label": "Lambda Expressions - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/lambda-expressions-java-8/"},
    ],
    "recursion_basics": [
        {"label": "Recursion - W3Schools", "href": "https://www.w3schools.com/java/java_recursion.asp"},
        {"label": "Recursion - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/recursion-in-java/"},
    ],
    "recursion_vs_iterative": [
        {"label": "Recursion vs Iteration - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/recursion-vs-iteration/"},
    ],
    "recursion_patterns": [
        {"label": "Recursive Patterns - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/tail-recursion/"},
    ],
    "revision_comprehensive": [
        {"label": "Java Review - W3Schools", "href": "https://www.w3schools.com/java/"},
        {"label": "Complete Java Guide - GeeksforGeeks", "href": "https://www.geeksforgeeks.org/java/"},
    ],
}

def add_external_resources():
    """Add external resources to each topic in topicContent.json"""
    
    with open('/Users/hei/IdeaProjects/fyp/frontend/src/topicContent.json', 'r') as f:
        content = json.load(f)
    
    # Add externalResources to each topic
    for topic_id in content:
        if topic_id in EXTERNAL_RESOURCES:
            content[topic_id]['externalResources'] = EXTERNAL_RESOURCES[topic_id]
        else:
            # Default learning resources for topics without specific links
            content[topic_id]['externalResources'] = [
                {"label": "Java Documentation", "href": "https://docs.oracle.com/javase/"},
                {"label": "GeeksforGeeks Java", "href": "https://www.geeksforgeeks.org/java/"},
            ]
    
    # Save updated content
    with open('/Users/hei/IdeaProjects/fyp/frontend/src/topicContent.json', 'w') as f:
        json.dump(content, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Added external resources to {len(content)} topics")
    print(f"📁 Updated: /Users/hei/IdeaProjects/fyp/frontend/src/topicContent.json")

if __name__ == "__main__":
    add_external_resources()
    print("✨ Done! All topics now have external resources.")
