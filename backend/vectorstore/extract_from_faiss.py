# extract_from_faiss.py
import pickle
from collections import defaultdict
import json

def load_faiss_vectorstore(vectorstore_path='./'):
    """Load and extract documents from FAISS vectorstore"""
    
    print("🔍 Loading FAISS vectorstore...")
    
    try:
        # Load the pickle file
        with open(f'{vectorstore_path}/index.pkl', 'rb') as f:
            store_data = pickle.load(f)
        
        print(f"✅ Loaded index.pkl")
        print(f"   Type: {type(store_data)}")
        
        # FAISS vectorstore typically stores as (faiss_index, docstore, index_to_docstore_id)
        if isinstance(store_data, tuple):
            print(f"   Tuple length: {len(store_data)}")
            
            # Try each element to find docstore
            for i, item in enumerate(store_data):
                print(f"\n   Tuple[{i}]:")
                print(f"     Type: {type(item)}")
                
                # Check for docstore attributes
                if hasattr(item, '_dict'):
                    print(f"     ✓ Found _dict attribute with {len(item._dict)} items")
                    return extract_documents_from_dict(item._dict)
                
                elif isinstance(item, dict):
                    print(f"     ✓ Is a dictionary with {len(item)} items")
                    # Check if it's a document dict
                    if item:
                        first_key = list(item.keys())[0]
                        first_val = item[first_key]
                        print(f"     Sample key: {first_key}")
                        print(f"     Sample value type: {type(first_val)}")
                        
                        if hasattr(first_val, 'page_content'):
                            print(f"     ✓ Contains LangChain Documents!")
                            return extract_documents_from_dict(item)
        
        # If not a tuple, try direct access
        elif hasattr(store_data, 'docstore'):
            print("   Found docstore attribute")
            if hasattr(store_data.docstore, '_dict'):
                return extract_documents_from_dict(store_data.docstore._dict)
        
        print("\n⚠️  Could not find documents in expected structure")
        return []
            
    except Exception as e:
        print(f"❌ Error loading vectorstore: {e}")
        import traceback
        traceback.print_exc()
        return []

def extract_documents_from_dict(doc_dict):
    """Extract documents from dictionary"""
    documents = []
    
    print(f"\n   📚 Extracting {len(doc_dict)} documents...")
    
    for doc_id, doc in doc_dict.items():
        try:
            # LangChain Document object
            if hasattr(doc, 'page_content') and hasattr(doc, 'metadata'):
                documents.append({
                    'id': doc_id,
                    'content': doc.page_content,
                    'metadata': doc.metadata
                })
            # Plain dict
            elif isinstance(doc, dict):
                documents.append({
                    'id': doc_id,
                    'content': doc.get('page_content', str(doc)),
                    'metadata': doc.get('metadata', {})
                })
            # String
            else:
                documents.append({
                    'id': doc_id,
                    'content': str(doc),
                    'metadata': {}
                })
        except Exception as e:
            print(f"      ⚠️  Skipped document {doc_id}: {e}")
    
    print(f"   ✅ Successfully extracted {len(documents)} documents")
    return documents

def categorize_by_source(documents):
    """Group documents by source folder"""
    sources = defaultdict(list)
    
    for doc in documents:
        metadata = doc.get('metadata', {})
        source_path = metadata.get('source', 'unknown')
        
        # Extract folder name from path
        folder = 'unknown'
        if '/' in source_path:
            parts = source_path.split('/')
            # Look for known source folders
            known_sources = ['w3schools', 'oracle', 'geeksforgeeks', 'books', 
                           'javanotes', 'data_structures', 'exceptions']
            for part in parts:
                if part in known_sources:
                    folder = part
                    break
            if folder == 'unknown':
                folder = parts[-2] if len(parts) >= 2 else parts[0]
        
        filename = source_path.split('/')[-1] if '/' in source_path else source_path
        
        sources[folder].append({
            'filename': filename,
            'source_path': source_path,
            'metadata': metadata,
            'content_preview': doc['content'][:200]
        })
    
    return sources

def generate_topic_mapping(documents):
    """Map documents to Java learning topics with STRICT matching"""
    
    topic_mapping = {
        'basic_syntax': {
            'title': 'Basic Syntax',
            'description': 'Learn the fundamental syntax rules of Java programming.',
            'primary_keywords': ['java syntax', 'java output', 'java comment', 'java home'],
            'secondary_keywords': ['getting started', 'hello world'],
            'exclude': ['variable', 'data type', 'string', 'array', 'class', 'method'],
            'sources': []
        },
        'lifecycle': {
            'title': 'Lifecycle of a Program',
            'description': 'Understand how Java programs are compiled and executed.',
            'primary_keywords': ['program execution', 'compilation process'],
            'secondary_keywords': ['jvm', 'bytecode', 'java virtual machine'],
            'exclude': [],
            'sources': []
        },
        'data_types': {
            'title': 'Data Types',
            'description': 'Learn about primitive and reference data types in Java.',
            'primary_keywords': ['java data type', 'primitive type'],
            'secondary_keywords': ['int ', 'double ', 'boolean ', 'char ', 'float ', 'byte ', 'short ', 'long '],
            'exclude': ['string', 'array', 'variable scope', 'casting'],
            'sources': []
        },
        'variables_scopes': {
            'title': 'Variables & Scopes',
            'description': 'Understand variable declaration, initialization, and scope rules.',
            'primary_keywords': ['java variable', 'variable scope', 'java identifier'],
            'secondary_keywords': ['declaration', 'local variable', 'instance variable'],
            'exclude': ['data type', 'string', 'array'],
            'sources': []
        },
        'type_casting': {
            'title': 'Type Casting',
            'description': 'Learn about implicit and explicit type conversion in Java.',
            'primary_keywords': ['type casting', 'type conversion'],
            'secondary_keywords': ['widening', 'narrowing', 'explicit cast', 'implicit cast'],
            'exclude': [],
            'sources': []
        },
        'strings_methods': {
            'title': 'Strings & Methods',
            'description': 'Master String manipulation and common String methods.',
            'primary_keywords': ['java string', 'string method', 'string concatenation'],
            'secondary_keywords': ['substring', 'charat', 'special character', 'string class'],
            'exclude': ['array'],
            'sources': []
        },
        'arrays': {
            'title': 'Arrays',
            'description': 'Learn how to declare, initialize, and manipulate arrays.',
            'primary_keywords': ['java array', 'array loop', 'multidimensional array'],
            'secondary_keywords': ['array length', 'array element'],
            'exclude': ['arraylist', 'string'],
            'sources': []
        },
        'conditionals': {
            'title': 'Conditionals',
            'description': 'Master if-else, switch, and ternary operators.',
            'primary_keywords': ['java if', 'if else', 'java switch', 'java condition'],
            'secondary_keywords': ['ternary', 'short hand if'],
            'exclude': ['loop', 'while', 'for'],
            'sources': []
        },
        'loops': {
            'title': 'Loops',
            'description': 'Learn for, while, do-while loops and loop control statements.',
            'primary_keywords': ['while loop', 'for loop', 'for each'],
            'secondary_keywords': ['break', 'continue', 'do-while', 'loop control'],
            'exclude': ['if', 'switch', 'condition'],
            'sources': []
        },
        'classes_objs': {
            'title': 'Classes & Objects',
            'description': 'Understand the foundation of Object-Oriented Programming in Java.',
            'primary_keywords': ['classes and objects', 'java class', 'java object'],
            'secondary_keywords': ['oop concept', 'instance', 'new keyword'],
            'exclude': ['attribute', 'method', 'inheritance', 'interface', 'constructor'],
            'sources': []
        },
        'attributes_methods': {
            'title': 'Attributes & Methods',
            'description': 'Learn about class fields and member functions.',
            'primary_keywords': ['class attribute', 'class method', 'java constructor'],
            'secondary_keywords': ['member function', 'field', 'this keyword'],
            'exclude': ['modifier', 'static', 'inheritance', 'access'],
            'sources': []
        },
        'access_specifiers': {
            'title': 'Access Specifiers',
            'description': 'Master public, private, protected, and default access modifiers.',
            'primary_keywords': ['java modifier', 'access modifier', 'access control'],
            'secondary_keywords': ['public ', 'private ', 'protected '],
            'exclude': ['static', 'final', 'abstract'],
            'sources': []
        },
        'static_keyword': {
            'title': 'Static Keyword',
            'description': 'Understand static variables, methods, and blocks.',
            'primary_keywords': ['static keyword', 'static variable', 'static method'],
            'secondary_keywords': ['static block', 'static class'],
            'exclude': ['dynamic'],
            'sources': []
        },
        'inheritance': {
            'title': 'Inheritance',
            'description': 'Learn how classes can inherit properties from other classes.',
            'primary_keywords': ['java inheritance', 'extends keyword', 'super keyword'],
            'secondary_keywords': ['polymorphism', 'override', 'parent class', 'child class'],
            'exclude': ['interface', 'abstract'],
            'sources': []
        },
        'abstraction': {
            'title': 'Abstraction',
            'description': 'Master abstract classes and abstract methods.',
            'primary_keywords': ['java abstract', 'abstraction'],
            'secondary_keywords': ['abstract class', 'abstract method'],
            'exclude': ['interface'],
            'sources': []
        },
        'encapsulation': {
            'title': 'Encapsulation',
            'description': 'Learn data hiding using getters and setters.',
            'primary_keywords': ['java encapsulation', 'getter', 'setter'],
            'secondary_keywords': ['data hiding', 'get method', 'set method'],
            'exclude': [],
            'sources': []
        },
        'interfaces': {
            'title': 'Interfaces',
            'description': 'Understand interface contracts and multiple inheritance.',
            'primary_keywords': ['java interface', 'implements keyword'],
            'secondary_keywords': ['interface method', 'multiple inheritance'],
            'exclude': ['abstract'],
            'sources': []
        },
        'exception_handling': {
            'title': 'Exception Handling',
            'description': 'Master try-catch blocks and custom exceptions.',
            'primary_keywords': ['java exception', 'try catch', 'exception handling'],
            'secondary_keywords': ['throw', 'finally', 'checked exception', 'unchecked'],
            'exclude': [],
            'sources': []
        },
        'array_vs_arraylist': {
            'title': 'Array vs ArrayList',
            'description': 'Understand the differences between arrays and ArrayLists.',
            'primary_keywords': ['java arraylist', 'array vs arraylist'],
            'secondary_keywords': ['arraylist method', 'list interface'],
            'exclude': ['hashset', 'hashmap'],
            'sources': []
        },
        'collections': {
            'title': 'Collections',
            'description': 'Learn about Java Collections Framework.',
            'primary_keywords': ['java hashset', 'java hashmap', 'collection framework'],
            'secondary_keywords': ['iterator', 'treeset', 'linkedlist'],
            'exclude': ['arraylist', 'array'],
            'sources': []
        },
        'threads': {
            'title': 'Threads',
            'description': 'Learn multi-threading and concurrent programming.',
            'primary_keywords': ['java thread', 'multithreading', 'concurrency'],
            'secondary_keywords': ['runnable', 'synchronized', 'thread class'],
            'exclude': [],
            'sources': []
        },
    }
    
    # Categorize documents with PRIMARY + SECONDARY keyword logic
    for doc in documents:
        metadata = doc.get('metadata', {})
        source_path = metadata.get('source', '')
        content = doc.get('content', '').lower()[:2000]
        
        # Extract folder and filename
        folder = 'unknown'
        if '/' in source_path:
            parts = source_path.split('/')
            known_sources = ['w3schools', 'oracle', 'geeksforgeeks', 'books', 
                           'javanotes', 'data_structures', 'exceptions']
            for part in parts:
                if part in known_sources:
                    folder = part
                    break
            filename = parts[-1]
        else:
            filename = source_path
        
        filename_lower = filename.lower()
        is_chapter = 'chapter' in filename_lower or 'chapter' in content[:500]
        
        # Match to topics with STRICT logic
        matched = False
        for topic_key, topic_data in topic_mapping.items():
            # Must match at least one PRIMARY keyword
            has_primary = any(keyword in filename_lower or keyword in content 
                            for keyword in topic_data.get('primary_keywords', []))
            
            # OR match at least TWO secondary keywords
            secondary_matches = sum(1 for keyword in topic_data.get('secondary_keywords', [])
                                  if keyword in filename_lower or keyword in content)
            has_secondary = secondary_matches >= 2
            
            # Check exclusions
            has_exclusion = any(exclude in filename_lower or exclude in content
                              for exclude in topic_data.get('exclude', []))
            
            if (has_primary or has_secondary) and not has_exclusion:
                # Avoid duplicates
                if not any(s['file'] == filename for s in topic_data['sources']):
                    topic_data['sources'].append({
                        'file': filename,
                        'source': folder,
                        'type': 'chapter' if is_chapter else 'file'
                    })
                    matched = True
                    break  # Only first match
    
    return topic_mapping

def save_js_mapping(topic_mapping, output='ragDocMapping.js'):
    """Generate JavaScript mapping file"""
    
    js_content = '''// ragDocMapping.js - Auto-generated from FAISS vectorstore
// Generated: ''' + __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '''

export const ragDocMapping = {
'''
    
    for topic_key, topic_data in topic_mapping.items():
        if not topic_data['sources']:
            continue
        
        # Escape quotes in strings
        title = topic_data['title'].replace('"', '\\"')
        desc = topic_data['description'].replace('"', '\\"')
        
        js_content += f'''  {topic_key}: {{
    title: "{title}",
    description: "{desc}",
    sources: [
'''
        
        for source in topic_data['sources']:
            file = source['file'].replace('"', '\\"').replace("'", "\\'")
            js_content += f'''      {{ file: "{file}", source: "{source['source']}", type: "{source['type']}" }},
'''
        
        js_content += '''    ],
  },

'''
    
    js_content += '''};

export const getSourceColor = (source) => {
  const colors = {
    w3schools: { bg: "#e0f2fe", border: "#0ea5e9", text: "#0369a1" },
    oracle: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    geeksforgeeks: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
    books: { bg: "#fce7f3", border: "#ec4899", text: "#9f1239" },
    javanotes: { bg: "#e9d5ff", border: "#a855f7", text: "#6b21a8" },
    data_structures: { bg: "#fed7aa", border: "#fb923c", text: "#9a3412" },
    exceptions: { bg: "#fecaca", border: "#ef4444", text: "#991b1b" },
  };
  return colors[source] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
};

export const formatSourceName = (source) => {
  const names = {
    w3schools: "W3Schools",
    oracle: "Oracle Docs",
    geeksforgeeks: "GeeksforGeeks",
    books: "Think Java",
    javanotes: "JavaNotes",
    data_structures: "Open Data Structures",
    exceptions: "Exception Guide",
  };
  return names[source] || source;
};
'''
    
    with open(output, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"✅ Generated {output}")

if __name__ == "__main__":
    print("="*70)
    print("FAISS VECTORSTORE DOCUMENT EXTRACTION")
    print("="*70)
    
    # Extract documents
    documents = load_faiss_vectorstore('./')
    
    if not documents:
        print("\n❌ Failed to extract documents. Check vectorstore format.")
        exit(1)
    
    print(f"\n✅ Total documents extracted: {len(documents)}")
    
    # Show sample
    if documents:
        sample = documents[0]
        print(f"\n📄 Sample Document:")
        print(f"   ID: {sample['id']}")
        print(f"   Metadata: {sample['metadata']}")
        print(f"   Content: {sample['content'][:150]}...")
    
    # Categorize by source
    sources = categorize_by_source(documents)
    print(f"\n📁 Documents by Source:")
    total = 0
    for folder, docs in sorted(sources.items()):
        count = len(docs)
        print(f"   {folder:20} : {count:3} documents")
        total += count
    print(f"   {'TOTAL':20} : {total:3} documents")
    
    # Generate topic mapping
    print(f"\n🗂️  Categorizing by Java topics...")
    topic_mapping = generate_topic_mapping(documents)
    
    # Show topic stats
    print(f"\n📚 Topics Mapped:")
    for topic_key, topic_data in topic_mapping.items():
        if topic_data['sources']:
            print(f"   {topic_data['title']:30} : {len(topic_data['sources']):2} sources")
    
    # Save JavaScript file
    print(f"\n📝 Generating JavaScript mapping file...")
    save_js_mapping(topic_mapping, 'ragDocMapping.js')
    
    # Save JSON summary
    summary = {
        'total_documents': len(documents),
        'sources': {folder: len(docs) for folder, docs in sources.items()},
        'topics': {
            topic_key: {
                'title': topic_data['title'],
                'description': topic_data['description'],
                'source_count': len(topic_data['sources']),
                'sources': topic_data['sources']
            }
            for topic_key, topic_data in topic_mapping.items()
            if topic_data['sources']
        }
    }
    
    with open('faiss_summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    
    print("✅ Saved detailed summary to faiss_summary.json")
    
    print("\n" + "="*70)
    print("✅ EXTRACTION COMPLETE!")
    print("="*70)
    print("\nNext steps:")
    print("1. Copy ragDocMapping.js to your React frontend")
    print("2. Import it in JavaRoadmap.js")
    print("3. Replace the old nodeContent with ragDocMapping")
