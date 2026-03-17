"""
Shared mapping from subtopic IDs to main topic names.
Used by routers/rag.py and routers/practical_tests.py.
"""
from typing import List

SUBTOPIC_TO_MAIN_TOPIC = {
    # Bridging from Python
    "python_syntax": "Bridging from Python",
    "python_types": "Bridging from Python",
    "python_compilation": "Bridging from Python",
    "python_structure": "Bridging from Python",
    # Problem Solving with Java
    "ps_algorithm": "Problem Solving with Java",
    "ps_pseudocode": "Problem Solving with Java",
    "ps_debugging": "Problem Solving with Java",
    "ps_optimization": "Problem Solving with Java",
    # String
    "string_basics": "String",
    "string_methods": "String",
    "string_builder": "String",
    "string_pool": "String",
    # Array
    "array_basics": "Array",
    "array_traversal": "Array",
    "array_multidim": "Array",
    "array_utilities": "Array",
    # Methods
    "method_declaration": "Methods",
    "method_params": "Methods",
    "method_overloading": "Methods",
    "method_varargs": "Methods",
    # Exception Handling & File IO
    "exception_trycatch": "Exception Handling and File IO",
    "exception_types": "Exception Handling and File IO",
    "exception_custom": "Exception Handling and File IO",
    "file_io": "Exception Handling and File IO",
    # Class Basics
    "class_declaration": "Class - constructor/attributes/methods",
    "class_constructor": "Class - constructor/attributes/methods",
    "class_attributes": "Class - constructor/attributes/methods",
    "class_methods": "Class - constructor/attributes/methods",
    "class_this": "Class - constructor/attributes/methods",
    # Access Modifier/Static
    "modifier_access": "Class - access modifier/static",
    "modifier_static_var": "Class - access modifier/static",
    "modifier_static_method": "Class - access modifier/static",
    "modifier_static_block": "Class - access modifier/static",
    "modifier_final": "Class - access modifier/static",
    # Inheritance
    "inherit_extends": "Inheritance",
    "inherit_override": "Inheritance",
    "inherit_super": "Inheritance",
    "inherit_chain": "Inheritance",
    "inherit_types": "Inheritance",
    # Polymorphism
    "poly_overload": "Polymorphism",
    "poly_override": "Polymorphism",
    "poly_dynamic": "Polymorphism",
    "poly_casting": "Polymorphism",
    # Interface & Lambda
    "interface_basics": "Interface and Lambda expression",
    "interface_implement": "Interface and Lambda expression",
    "interface_default": "Interface and Lambda expression",
    "interface_functional": "Interface and Lambda expression",
    "lambda_syntax": "Interface and Lambda expression",
    # Recursion & Revision
    "recursion_basics": "Recursion and Revision",
    "recursion_vs_iterative": "Recursion and Revision",
    "recursion_patterns": "Recursion and Revision",
    "revision_comprehensive": "Recursion and Revision",
}


def convert_topic_ids_to_main_topics(topic_identifiers: List[str]) -> List[str]:
    """Convert subtopic IDs to main topic names."""
    main_topics = set()
    for identifier in topic_identifiers:
        if identifier in SUBTOPIC_TO_MAIN_TOPIC:
            main_topics.add(SUBTOPIC_TO_MAIN_TOPIC[identifier])
        else:
            main_topics.add(identifier)
    return list(main_topics)


def to_main_topic(topic_id: str) -> str:
    """Convert a single subtopic ID to its main topic name."""
    return SUBTOPIC_TO_MAIN_TOPIC.get(topic_id, topic_id)


def to_main_topics(topic_ids: List[str]) -> List[str]:
    """Convert a list of subtopic IDs to unique main topic names."""
    return list({to_main_topic(t) for t in topic_ids})
