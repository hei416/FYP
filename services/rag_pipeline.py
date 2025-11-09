import json
import numpy as np
# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.metrics.pairwise import cosine_similarity

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from core.config import JSON_DATA, JSON_PATH
from typing import List, Dict, Any

# JSON Knowledge Base
def load_json_data():
    global JSON_DATA
    try:
        # Load both JSON knowledge bases
        with open("raw_java8_data.json", "r") as f1, open("raw_java8_data_copy.json", "r") as f2:
            JSON_DATA = json.load(f1) + json.load(f2)
        print(f"Loaded {len(JSON_DATA)} JSON knowledge entries")
    except Exception as e:
        print(f"Error loading JSON data: {str(e)}")
        JSON_DATA = []

# Initialize TF-IDF vectorizer (using cuML for GPU acceleration)
vectorizer = TfidfVectorizer(stop_words='english')
tfidf_matrix = None

def build_tfidf_matrix():
    global tfidf_matrix
    corpus = [json.dumps(entry) for entry in JSON_DATA]
    # Fit and transform on GPU
    tfidf_matrix = vectorizer.fit_transform(corpus)

def search_json_content(query: str, top_k: int = 5) -> str:
    if not JSON_DATA:
        return "No JSON data available"
    
    # Transform query on GPU
    query_vec = vectorizer.transform([query])
    
    # Perform cosine similarity on GPU using cuML
    cos_sim = cosine_similarity(query_vec, tfidf_matrix)
    
    top_indices = np.argsort(cos_sim[0])[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        entry = JSON_DATA[idx]
        if 'question' in entry and 'answer' in entry:
            results.append(f"Q: {entry['question']}\nA: {entry['answer']}")
        elif 'title' in entry and 'content' in entry:
            results.append(f"{entry['title']}:\n{entry['content']}")
        else:
            results.append(str(entry))
    
    return "\n\n".join(results)[:10000]
