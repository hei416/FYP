#!/usr/bin/env python3
"""
Generate all topic learning material using RAG endpoint.
"""
import httpx
import json
import asyncio
from typing import List, Dict

# All topics to generate
TOPICS = [
    # Group 1: Bridging from Python
    {"id": "python_syntax", "name": "Transitioning from Python to Java Syntax"},
    {"id": "python_types", "name": "Java Type System vs Python Dynamic Typing"},
    {"id": "python_compilation", "name": "Compilation vs Interpretation"},
    {"id": "python_structure", "name": "Java Project Structure and Organization"},
    
    # Group 2: Problem Solving with Java
    {"id": "ps_algorithm", "name": "Algorithm Design in Java"},
    {"id": "ps_pseudocode", "name": "Pseudocode to Java Code"},
    {"id": "ps_debugging", "name": "Debugging Java Programs"},
    {"id": "ps_optimization", "name": "Code Optimization Techniques"},
    
    # Group 3: String
    {"id": "string_basics", "name": "String Basics in Java"},
    {"id": "string_methods", "name": "String Methods and Manipulation"},
    {"id": "string_builder", "name": "StringBuilder and StringBuffer"},
    {"id": "string_pool", "name": "String Pool and Memory Management"},
    
    # Group 4: Array
    {"id": "array_basics", "name": "Java Arrays Fundamentals"},
    {"id": "array_traversal", "name": "Array Traversal and Iteration"},
    {"id": "array_multidim", "name": "Multidimensional Arrays"},
    {"id": "array_utilities", "name": "Arrays Utility Class"},
    
    # Group 5: Methods
    {"id": "method_declaration", "name": "Method Declaration in Java"},
    {"id": "method_params", "name": "Method Parameters and Arguments"},
    {"id": "method_overloading", "name": "Method Overloading"},
    {"id": "method_varargs", "name": "Variable Arguments (Varargs)"},
    
    # Group 6: Exception Handling & File IO
    {"id": "exception_trycatch", "name": "Try-Catch Exception Handling"},
    {"id": "exception_types", "name": "Exception Types and Hierarchy"},
    {"id": "exception_custom", "name": "Custom Exceptions"},
    {"id": "file_io", "name": "File Input and Output"},
    
    # Group 7: Class Basics
    {"id": "class_declaration", "name": "Class Declaration"},
    {"id": "class_constructor", "name": "Constructors"},
    {"id": "class_attributes", "name": "Class Attributes and Fields"},
    {"id": "class_methods", "name": "Class Methods"},
    {"id": "class_this", "name": "The 'this' Keyword"},
    
    # Group 8: Access Modifier/Static
    {"id": "modifier_access", "name": "Access Modifiers"},
    {"id": "modifier_static_var", "name": "Static Variables"},
    {"id": "modifier_static_method", "name": "Static Methods"},
    {"id": "modifier_static_block", "name": "Static Blocks"},
    {"id": "modifier_final", "name": "Final Keyword"},
    
    # Group 9: Inheritance
    {"id": "inherit_extends", "name": "Inheritance with extends"},
    {"id": "inherit_override", "name": "Method Overriding"},
    {"id": "inherit_super", "name": "The super Keyword"},
    {"id": "inherit_chain", "name": "Inheritance Chain"},
    {"id": "inherit_types", "name": "Types of Inheritance"},
    
    # Group 10: Polymorphism
    {"id": "poly_overload", "name": "Compile-time Polymorphism"},
    {"id": "poly_override", "name": "Runtime Polymorphism"},
    {"id": "poly_dynamic", "name": "Dynamic Method Dispatch"},
    {"id": "poly_casting", "name": "Type Casting and instanceof"},
    
    # Group 11: Interface & Lambda
    {"id": "interface_basics", "name": "Interface Basics"},
    {"id": "interface_implement", "name": "Implementing Interfaces"},
    {"id": "interface_default", "name": "Default Methods in Interfaces"},
    {"id": "interface_functional", "name": "Functional Interfaces"},
    {"id": "lambda_syntax", "name": "Lambda Expressions"},
    
    # Group 12: Recursion & Revision
    {"id": "recursion_basics", "name": "Recursion Fundamentals"},
    {"id": "recursion_vs_iterative", "name": "Recursion vs Iteration"},
    {"id": "recursion_patterns", "name": "Recursive Patterns and Techniques"},
    {"id": "revision_comprehensive", "name": "Comprehensive Java Review"},
]

BASE_URL = "http://localhost:8000"
ENDPOINT = "/api/topics/generate-content"

async def generate_topic(session: httpx.AsyncClient, topic: Dict) -> Dict:
    """Generate content for a single topic."""
    try:
        print(f"📚 Generating: {topic['name']}...", end=" ", flush=True)
        
        response = await session.post(
            f"{BASE_URL}{ENDPOINT}",
            json={
                "topic_id": topic["id"],
                "topic_name": topic["name"]
            },
            timeout=120.0
        )
        
        response.raise_for_status()
        result = response.json()
        
        content = result.get("content", {})
        print(f"✅")
        
        return {
            "topic_id": topic["id"],
            "content": content,
            "success": True
        }
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {
            "topic_id": topic["id"],
            "content": None,
            "success": False,
            "error": str(e)
        }

async def main():
    """Generate all topics concurrently."""
    print(f"\n🚀 Generating content for {len(TOPICS)} topics using RAG...\n")
    
    all_content = {}
    failed_topics = []
    
    async with httpx.AsyncClient() as session:
        # Generate topics in batches to avoid overwhelming the server
        batch_size = 3
        for i in range(0, len(TOPICS), batch_size):
            batch = TOPICS[i:i+batch_size]
            print(f"Batch {i//batch_size + 1}/{(len(TOPICS) + batch_size - 1)//batch_size}:")
            
            tasks = [generate_topic(session, topic) for topic in batch]
            results = await asyncio.gather(*tasks)
            
            for result in results:
                if result["success"]:
                    all_content[result["topic_id"]] = result["content"]
                else:
                    failed_topics.append({
                        "id": result["topic_id"],
                        "error": result.get("error", "Unknown error")
                    })
            
            print()
    
    # Save to topicContent.json
    output_file = "/Users/hei/IdeaProjects/fyp/frontend/src/topicContent.json"
    with open(output_file, "w") as f:
        json.dump(all_content, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"✅ Generated: {len(all_content)} topics")
    if failed_topics:
        print(f"❌ Failed: {len(failed_topics)} topics")
        for topic in failed_topics:
            print(f"   - {topic['id']}: {topic['error']}")
    print(f"{'='*60}")
    print(f"📁 Saved to: {output_file}")
    
    return all_content

if __name__ == "__main__":
    content = asyncio.run(main())
    print("\n✨ Done! All topic content has been generated using RAG.")
