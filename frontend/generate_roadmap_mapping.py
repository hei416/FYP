# backend/generate_roadmap_mapping.py

import pickle
import json
import numpy as np
from collections import defaultdict
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

print("="*70)
print("GENERATING ROADMAP TOPIC MAPPING")
print("="*70)

# Initialize embeddings (same as notebook)
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Define roadmap topics
ROADMAP_TOPICS = {
    "basic_syntax": "Java basic syntax variables operators semicolon",
    "lifecycle": "Java program compilation execution JVM bytecode",
    "data_types": "Java primitive data types int double boolean String",
    "variables_scopes": "Java variables declaration scope local instance",
    "type_casting": "Java type casting implicit explicit conversion",
    "strings_methods": "Java String methods charAt substring concat",
    "arrays": "Java arrays declaration initialization access",
    "conditionals": "Java if else switch case conditional",
    "loops": "Java for while do-while loop iteration",
    "classes_objs": "Java class object constructor instance",
    "attributes_methods": "Java class attributes fields methods",
    "access_specifiers": "Java access modifiers public private protected",
    "static_keyword": "Java static keyword class method",
    "inheritance": "Java inheritance extends super subclass",
    "abstraction": "Java abstraction abstract class method",
    "encapsulation": "Java encapsulation private getter setter",
    "interfaces": "Java interface implements abstract methods",
    "array_vs_arraylist": "Java Array ArrayList difference",
    "set": "Java Set HashSet TreeSet unique elements",
    "map": "Java Map HashMap key value pair",
    "threads": "Java threads multithreading concurrency",
    "spring_boot": "Spring Boot framework REST API",
    "junit": "JUnit testing framework unit test",
    "exception_handling": "Java exception try catch finally throw",
    "lambda_expressions": "Java lambda expressions functional",
    # Add more topics as needed
}

# Load vectorstore
vectorstore_path = "./vectorstore"
print(f"\nLoading vectorstore from {vectorstore_path}...")

vectorstore = FAISS.load_local(
    vectorstore_path,
    embeddings,
    allow_dangerous_deserialization=True
)

print(f"✅ Loaded vectorstore with {vectorstore.index.ntotal} vectors\n")

# Generate mapping
topic_mapping = {}

for topic_id, query in ROADMAP_TOPICS.items():
    print(f"🔍 {topic_id}...", end=" ")
    
    # Search for relevant documents
    docs_with_scores = vectorstore.similarity_search_with_score(query, k=10)
    
    sources = []
    seen_files = set()
    
    for doc, score in docs_with_scores:
        metadata = doc.metadata if hasattr(doc, 'metadata') else {}
        source_path = metadata.get('source', '')
        
        if not source_path:
            continue
        
        # Parse path
        if '/' in source_path:
            parts = source_path.split('/')
            folder = parts[-2] if len(parts) >= 2 else 'unknown'
            filename = parts[-1]
        else:
            folder = 'unknown'
            filename = source_path
        
        if filename in seen_files:
            continue
        seen_files.add(filename)
        
        # Determine type
        doc_type = 'chapter' if folder in ['books', 'javanotes', 'data_structures'] else 'tutorial'
        
        # Extract URL
        content = doc.page_content if hasattr(doc, 'page_content') else str(doc)
        url = None
        for line in content.split('\n')[:30]:
            if line.startswith('URL:'):
                url = line.replace('URL:', '').strip()
                if '[' in url and '](' in url:
                    import re
                    match = re.search(r'\]\((.*?)\)', url)
                    if match:
                        url = match.group(1)
                break
        
        sources.append({
            'file': filename,
            'source': folder,
            'type': doc_type,
            'url': url
        })
        
        if len(sources) >= 5:
            break
    
    if sources:
        topic_mapping[topic_id] = {
            'title': topic_id.replace('_', ' ').title(),
            'description': f"Learn about {topic_id.replace('_', ' ')}",
            'sources': sources
        }
        print(f"✅ {len(sources)} sources")
    else:
        print("❌ No sources")

print(f"\n{'='*70}")
print(f"Mapped {len(topic_mapping)}/{len(ROADMAP_TOPICS)} topics")
print(f"{'='*70}\n")

# Generate JavaScript file
js_output = """// Auto-generated ragDocMapping.js
// Run 'python backend/generate_roadmap_mapping.py' to regenerate

export const ragDocMapping = {
"""

for topic_id, data in topic_mapping.items():
    js_output += f"  {topic_id}: {{\n"
    js_output += f"    title: \"{data['title']}\",\n"
    js_output += f"    description: \"{data['description']}\",\n"
    js_output += f"    sources: [\n"
    
    for source in data['sources']:
        js_output += f"      {{ "
        js_output += f"file: \"{source['file']}\", "
        js_output += f"source: \"{source['source']}\", "
        js_output += f"type: \"{source['type']}\""
        if source.get('url'):
            js_output += f", url: \"{source['url']}\""
        js_output += f" }},\n"
    
    js_output += f"    ]\n"
    js_output += f"  }},\n"

js_output += """}

export const getSourceColor = (source) => {
  const colors = {
    w3schools: { bg: '#E7F9ED', text: '#047857', border: '#10B981' },
    books: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    oracle: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
    geeksforgeeks: { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' },
    javanotes: { bg: '#FCE7F3', text: '#9F1239', border: '#F43F5E' },
    data_structures: { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },
  };
  return colors[source] || { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
};

export const formatSourceName = (source) => {
  const names = {
    w3schools: 'W3Schools',
    books: 'Think Java',
    oracle: 'Oracle Docs',
    geeksforgeeks: 'GeeksforGeeks',
    javanotes: 'JavaNotes',
    data_structures: 'Data Structures'
  };
  return names[source] || source;
};

export const isBookSource = (source) => {
  return ['books', 'javanotes', 'data_structures'].includes(source);
};
"""

# Save files
frontend_path = '../frontend/src/ragDocMapping.js'
json_path = './ragDocMapping.json'

with open(frontend_path, 'w', encoding='utf-8') as f:
    f.write(js_output)
print(f"✅ Generated: {frontend_path}")

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(topic_mapping, f, indent=2)
print(f"✅ Also saved: {json_path}")

print(f"\n🎉 Done! Import in React with:")
print(f"   import {{ ragDocMapping }} from './ragDocMapping.js'")
