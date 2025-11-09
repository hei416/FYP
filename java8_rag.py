from bs4 import BeautifulSoup
from services.model_service import call_model
import re
import json
import sqlite3
import time 
from datetime import datetime
from services.model_service import call_embedding_model
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import cloudscraper
import random
import argparse
from rank_bm25 import BM25Okapi


# Initialize NLTK
nltk.download('punkt')
nltk.download('stopwords')

# Configuration
scraper = cloudscraper.create_scraper()

STACKOVERFLOW_URL = "https://stackoverflow.com/questions/tagged/java-8?sort=votes&pageSize=50"
SQLITE_DB_PATH = "conversation_history.db"
KNOWLEDGE_DB_PATH = "knowledge_base.db"
ORACLE_TUTORIALS_PATH = "oracle_java_tutorials_clean.json"

def setup_databases():
    """Initialize databases with required schemas"""
    # SQLite for conversation history
    with sqlite3.connect(SQLITE_DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            user_input TEXT NOT NULL,
            system_response TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session ON conversations (session_id)")
    
    # SQLite for knowledge base (replacing PostgreSQL)
    with sqlite3.connect(KNOWLEDGE_DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            code TEXT,
            metadata TEXT,  
            verified BOOLEAN DEFAULT FALSE,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            embedding_vector TEXT,
            reasoning_steps TEXT,
            reflection_tokens TEXT 
        )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_question ON knowledge_base (question)")

class StackOverflowCrawler:
    """Crawls Stack Overflow for Java 8 questions and answers"""
    def __init__(self, min_votes=0, min_answers=1):
        self.min_votes = min_votes
        self.min_answers = min_answers
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
        ]
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def _get_random_headers(self):
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept-Language': 'en-US,en;q=0.9'
        }
    
    def _preprocess_text(self, text):
        """Clean and tokenize text for analysis"""
        text = re.sub(r'<[^>]+>', '', text)
        tokens = word_tokenize(text.lower())
        stop_words = set(stopwords.words('english'))
        return [word for word in tokens if word.isalnum() and word not in stop_words]
    
    def _extract_full_text(self, element):
        """Extracts full text from an HTML element, preserving paragraph breaks."""
        if not element:
            return ""
        
        texts = []
        for content in element.contents:
            if content.name == 'p':
                texts.append(content.get_text(separator=' ', strip=True))
            elif content.name == 'pre' or content.name == 'code':
                texts.append(content.get_text(strip=True))
            elif isinstance(content, str):
                texts.append(content.strip())
            else:
                # For other tags, just get their text content
                texts.append(content.get_text(separator=' ', strip=True))
        
        # Join with double newlines for paragraphs, single for others
        return '\n\n'.join(filter(None, texts)).strip()

    def _extract_code(self, text):
        """Extract Java code blocks from text"""
        code_blocks = re.findall(r'<pre><code>(.*?)</code></pre>', text, re.DOTALL)
        return '\n'.join(code_block.strip() for code_block in code_blocks)
    
    def crawl(self, url, start_page=1, max_pages=5):
        """Crawl Stack Overflow and return structured Q&A pairs"""
        qa_pairs = []
        page = start_page
        
        while page <= start_page + max_pages -1:
            try:
                print(f"Crawling page {page}...")
                retries = 0
                max_retries = 5
                while retries < max_retries:
                    try:
                        response = scraper.get(f"{url}&page={page}", headers=self._get_random_headers(), timeout=15)
                        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                        break # If successful, break the retry loop
                    except requests.exceptions.RequestException as e:
                        retries += 1
                        wait_time = 2 ** retries + random.uniform(0, 2) # Exponential backoff
                        print(f"Error crawling page {page}: {e}. Retrying in {wait_time:.2f} seconds... (Attempt {retries}/{max_retries})")
                        time.sleep(wait_time)
                else: # This block executes if the while loop completes without a 'break'
                    print(f"Failed to crawl page {page} after {max_retries} attempts. Skipping.")
                    page += 1
                    time.sleep(random.uniform(10, 20)) # Longer sleep before moving to next page if current page fails
                    continue # Skip to the next page
                soup = BeautifulSoup(response.text, 'html.parser')
                questions = soup.select('div.question-summary,div.s-post-summary')
                
                if not questions:
                    print(f"No questions found on page {page}, skipping...")
                    page += 1
                    time.sleep(random.uniform(5, 10))
                    continue
                
                for q in questions:
                    try:
                        title = q.select_one('a.s-link').text.strip()
                        vote_elem = q.select_one('.s-post-summary--stats-item-number')
                        answer_elem = q.select('.s-post-summary--stats-item-number')[1]
                        
                        votes = int(vote_elem.text.strip()) if vote_elem else 0
                        answers = int(answer_elem.text.strip()) if answer_elem else 0
                        
                        if votes >= self.min_votes and answers >= self.min_answers:
                            path=q.select_one('a.s-link')['href']
                            question_url = f'https://stackoverflow.com{path}'
                            qa_pairs.extend(self._process_question(question_url, title))
                    except Exception as e:
                        print(f"Error processing question: {e}")
                        continue
                
                page += 1
                time.sleep(random.uniform(10, 15)) # Increased sleep duration
            except Exception as e:
                print(f"Error crawling page {page}: {e}")
                break
        
        return qa_pairs
    
    def _process_question(self, url, title):
        """Process individual question page"""
        retries = 0
        max_retries = 5
        while retries < max_retries:
            try:
                response = scraper.get(url, headers=self._get_random_headers(), timeout=15)
                response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                break # If successful, break the retry loop
            except requests.exceptions.RequestException as e:
                retries += 1
                wait_time = 2 ** retries + random.uniform(0, 2) # Exponential backoff
                print(f"Error fetching question page {url}: {e}. Retrying in {wait_time:.2f} seconds... (Attempt {retries}/{max_retries})")
                time.sleep(wait_time)
        else: # This block executes if the while loop completes without a 'break'
            print(f"Failed to fetch question page {url} after {max_retries} attempts. Skipping.")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract question body
        question_body = soup.select_one('.s-prose.js-post-body').text.strip()
        
        # Process answers
        answers = []
        answer_divs = soup.select('.answer')
        
        for div in answer_divs:
            if 'accepted-answer' in div.get('class', []):
                answer_body_div = div.select_one('.s-prose.js-post-body')
                answer_body = self._extract_full_text(answer_body_div)
                code = self._extract_code(str(div))
                answers.append({
                    'answer': answer_body,
                    'code': code,
                    'is_accepted': True
                })
            else:
                vote_count = int(div.select_one('.js-vote-count').text.strip())
                if vote_count >= self.min_votes:
                    answer_body_div = div.select_one('.s-prose.js-post-body')
                    answer_body = self._extract_full_text(answer_body_div)
                    code = self._extract_code(str(div))
                    answers.append({
                        'answer': answer_body,
                        'code': code,
                        'is_accepted': False
                    })
        
        # Create Q&A pairs
        results = []
        for answer in answers:
            results.append({
                'question': f"{title}\n{question_body}",
                'answer': answer['answer'],
                'code': answer['code'],
                'metadata': {
                    'url': url,
                    'votes': self.min_votes,
                    'is_accepted': answer['is_accepted'],
                    'source': 'stackoverflow'
                }
            })
        
        try:
            return results
        except Exception as e:
            print(f"Error processing question page {url}: {e}")
            return []

def load_oracle_tutorials(json_path):
    """Loads and processes the Oracle Java tutorials JSON data."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    processed_data = []
    for item in data:
        # Use the title as the "question" and the text as the "answer"
        question = item.get('title', '').strip()
        answer = item.get('text', '').strip()
        
        if not question or not answer:
            continue
            
        # Extract code from the text
        code_blocks = re.findall(r'```java(.*?)```', answer, re.DOTALL)
        code = '\n'.join(block.strip() for block in code_blocks)

        processed_data.append({
            'question': question,
            'answer': answer,
            'code': code,
            'metadata': {
                'url': item.get('url'),
                'source': 'oracle_tutorials'
            }
        })
    return processed_data

class CLASSDatasetBuilder:
    """Builds CLASS methodology dataset from crawled data"""
    def __init__(self):

        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def create_dataset(self, raw_data, output_path):
        """Transform raw data into CLASS methodology format"""
        dataset = []
        
        for item in raw_data:
            # Step 1: Create step-by-step reasoning
            reasoning = self._generate_reasoning_steps(item['question'], item['answer'])
            
            # Step 2: Create conversational context
            conversational_context = self._create_conversational_context(item)
            
            # Step 3: Generate SELF-RAG reflection tokens
            reflection_tokens = self._generate_reflection_tokens(item['question'], item['answer'])

            # Step 4: Add analytical learning markers
            analytical_markers = {
                'verification_required': False,
                'knowledge_gap': False,
                'feedback_mechanism': "none"
            }
            
            # Step 5: Generate embedding
            embedding = self.embedding_model.encode(
                f"{item['question']} {item['answer']}"
            ).tolist()
            
            dataset.append({
                'id': f"java8-{hash(item['question'])}",
                'question': item['question'],
                'answer': item['answer'],
                'code': item['code'],
                'reasoning_steps': reasoning,
                'conversational_context': conversational_context,
                'analytical_markers': analytical_markers,
                'metadata': item['metadata'],
                'embedding': embedding,
                'reflection_tokens': reflection_tokens # Added reflection tokens
            })
        
        # Save dataset
        with open(output_path, 'w') as f:
            json.dump(dataset, f, indent=2)
        
        return dataset
    
    def _create_conversational_context(self, item):
        """Create conversational context for Q&A pair"""
        return [
            {"role": "user", "content": item['question']},
            {"role": "assistant", "content": item['answer']},
            {"role": "system", "content": f"Code example: {item['code']}"}
        ]
    
    def _generate_reasoning_steps(self, question, answer):
        """Generate step-by-step reasoning using DeepSeek"""
        prompt = f"""You're a Java tutor. Given the following Q&A pair, generate 4-6 clear reasoning steps to help a student understand the solution:

Question: {question}

Answer: {answer}

Respond with a numbered list."""
        
        output = call_deepseek(prompt)
        return [line.strip() for line in output.split("\n") if line.strip()]

    def _generate_reflection_tokens(self, question, answer):
        """Generate SELF-RAG style reflection tokens (ISREL, ISSUP) using DeepSeek."""
        prompt = f"""You are an expert evaluator. Given the following question and answer, determine the relevance and support of the answer.

Question: {question}

Answer: {answer}

Provide your evaluation in the following format:
ISREL: [Relevant/Irrelevant]
ISSUP: [Fully/Partially/NoSupport]"""
        
        output = call_deepseek(prompt)
        
        isrel_match = re.search(r"ISREL: (Relevant|Irrelevant)", output)
        issup_match = re.search(r"ISSUP: (Fully|Partially|NoSupport)", output)
        
        isrel = isrel_match.group(1) if isrel_match else "Irrelevant"
        issup = issup_match.group(1) if issup_match else "NoSupport"
        
        return {"isrel": isrel, "issup": issup}

def retry_on_exception(retries=3, delay=5, backoff_factor=2):
    def decorator(func):
        def wrapper(*args, **kwargs):
            _retries = retries
            _delay = delay
            while _retries > 0:
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    print(f"Error: {e}. Retrying in {_delay} seconds...")
                    time.sleep(_delay)
                    _retries -= 1
                    _delay *= backoff_factor
            raise requests.exceptions.RequestException(f"Failed after {retries} attempts.")
        return wrapper
    return decorator

@retry_on_exception(retries=5, delay=10, backoff_factor=2)
def call_deepseek(prompt: str, model: str = "deepseek") -> str:
    """Call DeepSeek API for text generation using the centralized model service"""
    messages = [{"role": "user", "content": prompt}]
    try:
        response = call_model(model, messages)
        if "Model API error" in response:
            raise Exception(response)
        return response
    except Exception as e:
        print(f"An unexpected error occurred during DeepSeek call: {e}")
        return "Sorry, an unexpected error occurred while connecting to my knowledge source."


class KnowledgeBaseLoader:
    """Loads processed data into the SQLite knowledge base."""
    def __init__(self, db_path=KNOWLEDGE_DB_PATH):
        self.db_path = db_path

    def load_data(self, dataset):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for item in dataset:
                embedding_str = ','.join(map(str, item['embedding'])) if item['embedding'] is not None else None
                metadata_str = json.dumps(item['metadata'])
                reasoning_steps_str = json.dumps(item['reasoning_steps']) # Store reasoning steps
                reflection_tokens_str = json.dumps(item['reflection_tokens']) # Store reflection tokens

                cursor.execute(
                    """INSERT INTO knowledge_base (question, answer, code, metadata, embedding_vector, reasoning_steps, reflection_tokens) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (item['question'], item['answer'], item['code'], metadata_str, embedding_str, reasoning_steps_str, reflection_tokens_str)
                )
            conn.commit()

class KnowledgeBaseDB:
    """Handles retrieval from the SQLite knowledge base."""
    def __init__(self, db_path=KNOWLEDGE_DB_PATH):
        self.db_path = db_path
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.bm25_index = None
        self.documents = []
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        """Loads all data from the knowledge base and builds the BM25 index."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, question, answer, code, embedding_vector, reasoning_steps, reflection_tokens FROM knowledge_base")
            
            self.documents = []
            for row in cursor.fetchall():
                db_id, question, answer, code, embedding_str, reasoning_steps_str, reflection_tokens_str = row
                
                embedding = np.array([float(x) for x in embedding_str.split(',')]) if embedding_str else None
                reasoning_steps = json.loads(reasoning_steps_str) if reasoning_steps_str else []
                reflection_tokens = json.loads(reflection_tokens_str) if reflection_tokens_str else {}

                self.documents.append({
                    'id': db_id,
                    'question': question,
                    'answer': answer,
                    'code': code,
                    'embedding': embedding,
                    'reasoning_steps': reasoning_steps,
                    'reflection_tokens': reflection_tokens # Added reflection tokens
                })
            
            # Build BM25 index
            if self.documents:
                tokenized_corpus = [
                    self._preprocess_text(doc['question'] + " " + doc['answer'] + " ".join(doc['reasoning_steps']))
                    for doc in self.documents
                ]
                self.bm25_index = BM25Okapi(tokenized_corpus)

    def _preprocess_text(self, text):
        """Clean and tokenize text for BM25 indexing."""
        text = re.sub(r'<[^>]+>', '', text)
        tokens = word_tokenize(text.lower())
        stop_words = set(stopwords.words('english'))
        return [word for word in tokens if word.isalnum() and word not in stop_words]

    def _cosine_similarity(self, v1, v2):
        """Calculates cosine similarity between two vectors."""
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

    def _reciprocal_rank_fusion(self, results, k=60):
        """Applies Reciprocal Rank Fusion to combine ranked lists."""
        fused_scores = {}
        for ranks in results:
            for rank, doc_id in enumerate(ranks):
                if doc_id not in fused_scores:
                    fused_scores[doc_id] = 0
                fused_scores[doc_id] += 1 / (k + rank)
        
        reranked_results = sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)
        return [doc_id for doc_id, score in reranked_results]

    def search(self, query_text, top_k=3):
        """Searches for the most similar entries using blended retrieval (dense + BM25)."""
        query_embedding = self.embedding_model.encode(query_text)
        tokenized_query = self._preprocess_text(query_text)

        dense_results = []
        bm25_results = []

        # Dense retrieval
        if self.documents:
            dense_scores = []
            for i, doc in enumerate(self.documents):
                if doc['embedding'] is not None:
                    similarity = self._cosine_similarity(query_embedding, doc['embedding'])
                    dense_scores.append((similarity, doc['id']))
            dense_scores.sort(key=lambda x: x[0], reverse=True)
            dense_results = [doc_id for score, doc_id in dense_scores[:top_k*2]] # Get more for RRF

        # BM25 retrieval
        if self.bm25_index and tokenized_query:
            bm25_scores = self.bm25_index.get_scores(tokenized_query)
            bm25_ranked_docs = sorted(
                [(score, self.documents[i]['id']) for i, score in enumerate(bm25_scores)],
                key=lambda x: x[0],
                reverse=True
            )
            bm25_results = [doc_id for score, doc_id in bm25_ranked_docs[:top_k*2]] # Get more for RRF

        # Combine using RRF
        combined_ranks = self._reciprocal_rank_fusion([dense_results, bm25_results])
        
        final_results = []
        doc_map = {doc['id']: doc for doc in self.documents}
        for doc_id in combined_ranks:
            if doc_id in doc_map:
                doc = doc_map[doc_id]
                final_results.append((doc['question'], doc['answer'], doc['code'], doc['reasoning_steps'], doc['reflection_tokens']))
            if len(final_results) >= top_k:
                break
        
        return final_results


def generate_tutor_response(history, question, context):
    """Generates a response from the LLM based on context and history."""
    prompt = f"""You are a helpful Java 8 tutor. Your student has a question. Use the provided context to give a clear and concise answer. If the context isn't relevant, rely on your general knowledge.

Conversation History:
{history}

Context from Knowledge Base:
{context}

Student's Question: {question}

Your Answer:"""
    
    return call_deepseek(prompt)


class CLASSRAGSystem:
    """The main RAG system for answering questions."""
    def __init__(self, session_id):
        self.session_id = session_id
        self.history = []
        self.knowledge_db = KnowledgeBaseDB()

    def answer_question(self, question: str) -> str:
        # 1. Retrieve relevant context
        context_entries = self.knowledge_db.search(question, top_k=3)
        
        # Format context
        context = "\n".join(
            f"Q: {e[0]}\nA: {e[1]}" 
            for e in context_entries
        )
        
        # 2. Generate response
        response = generate_tutor_response(self.history, question, context)
        
        # 3. Update history
        self.history.extend([
            {"role": "user", "content": question},
            {"role": "assistant", "content": response}
        ])
        self._store_conversation(question, response)
        
        return response

    def _store_conversation(self, question, response):
        """Stores the conversation turn in the database."""
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO conversations (session_id, user_input, system_response) VALUES (?, ?, ?)",
                (self.session_id, question, response)
            )
            conn.commit()



# Main Execution
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Java 8 RAG System")
    parser.add_argument('--run-pipeline', action='store_true', help='Run the full data crawling and processing pipeline.')
    parser.add_argument('--process-only', action='store_true', help='Only process raw data without crawling.')
    parser.add_argument('--chat', action='store_true', help='Start an interactive chat session.')
    args = parser.parse_args()

    if args.run_pipeline:
        # Step 1: Setup databases
        print("Setting up databases...")
        setup_databases()
        
        # Step 2: Crawl Stack Overflow and load Oracle tutorials
        print("Crawling Stack Overflow...")
        crawler = StackOverflowCrawler(min_votes=5, min_answers=2)
        stackoverflow_data = crawler.crawl(STACKOVERFLOW_URL, start_page=11, max_pages=200)
        print(f"Collected {len(stackoverflow_data)} Q&A pairs from Stack Overflow")

        print("Loading Oracle tutorials...")
        oracle_data = load_oracle_tutorials(ORACLE_TUTORIALS_PATH)
        print(f"Loaded {len(oracle_data)} documents from Oracle tutorials.")

        raw_data = stackoverflow_data + oracle_data
        
        # Save combined raw data
        with open('raw_java8_data.json', 'w') as f:
            json.dump(raw_data, f, indent=2)
        
        # Step 3: Create CLASS dataset
        print("Creating CLASS dataset...")
        dataset_builder = CLASSDatasetBuilder()
        class_dataset = dataset_builder.create_dataset(
            raw_data, 
            'java8_class_dataset.json'
        )
        
        # Step 4: Load into database
        print("Loading data into knowledge base...")
        loader = KnowledgeBaseLoader()
        loader.load_data(class_dataset)
        
        print("Process completed successfully!")
        print(f"Total knowledge base entries: {len(class_dataset)}")

    elif args.process_only:
        # Step 1: Setup databases
        print("Setting up databases...")
        setup_databases()

        # Step 2: Load raw data from files
        print("Loading raw data from raw_java8_data.json and raw_java8_data copy.json...")
        raw_data = []
        # try:
        #     with open('raw_java8_data.json', 'r') as f:
        #         json_data = json.load(f)
        #         raw_data.extend(json_data)
        #         print(f"Loaded {len(json_data)} items from raw_java8_data.json.")
        # except FileNotFoundError:
        #     print("Warning: raw_java8_data.json not found. Skipping.")
        
        try:
            with open('raw_java8_data copy.json', 'r') as f:
                json_data = json.load(f)
                raw_data.extend(json_data)
                print(f"Loaded {len(json_data)} items from raw_java8_data copy.json.")
        except FileNotFoundError:
            print("Warning: raw_java8_data copy.json not found. Skipping.")

        if not raw_data:
            print("Error: No raw data found from any source. Please ensure at least one raw data file exists.")
            exit()
        
        print(f"Total raw data items loaded: {len(raw_data)}")

        # Step 2: Create CLASS dataset
        print("Creating CLASS dataset (this will use DeepSeek)...")
        dataset_builder = CLASSDatasetBuilder()
        class_dataset = dataset_builder.create_dataset(
            raw_data, 
            'java8_class_dataset.json'
        )
        
        # Step 3: Load into database
        print("Loading data into knowledge base...")
        loader = KnowledgeBaseLoader()
        loader.load_data(class_dataset)
        
        print("Processing completed successfully!")
        print(f"Total knowledge base entries: {len(class_dataset)}")

    elif args.chat:
        session_id = f"chat_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        rag_system = CLASSRAGSystem(session_id)
        print("Starting chat session with Java 8 Tutor. Type 'exit' to end.")
        while True:
            user_query = input("You: ")
            if user_query.lower() == 'exit':
                break
            response = rag_system.answer_question(user_query)
            print(f"Tutor: {response}")
    else:
        print("Please specify an action: --run-pipeline or --chat")

