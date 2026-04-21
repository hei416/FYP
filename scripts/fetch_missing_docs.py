"""
fetch_missing_docs.py
Fetches and saves all missing/broken KB content for the FYP RAG system.
Fixes: data_structures/ (12 stubs), javanotes/ (12 stubs), + 10 missing GFG topics.
Run once from repo root: python scripts/fetch_missing_docs.py
"""

import os, time, re, requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FYP-RAG-Builder/1.0)"}
DELAY   = 1.5   # seconds between requests — be polite to servers

# ── OUTPUT DIRS ─────────────────────────────────────────────
REPO_ROOT = "/Users/hei/IdeaProjects/fyp"
BASE      = os.path.join(REPO_ROOT, "java_docs", "java_knowledge")
DIR_GFG   = os.path.join(BASE, "geeksforgeeks")
DIR_DS    = os.path.join(BASE, "data_structures")
DIR_JN    = os.path.join(BASE, "javanotes")

print(f"BASE dir: {BASE}")
print(f"BASE exists: {os.path.exists(BASE)}")
if not os.path.exists(BASE):
    print("❌ ERROR: BASE path not found — check REPO_ROOT")
    exit(1)

os.makedirs(DIR_GFG, exist_ok=True)
os.makedirs(DIR_DS,  exist_ok=True)
os.makedirs(DIR_JN,  exist_ok=True)


# ════════════════════════════════════════════════════════════
# HELPER: scrape a GFG article
# ════════════════════════════════════════════════════════════
def scrape_gfg(url: str, topic: str) -> str:
    """Scrape a GFG page and return formatted text."""
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # GFG main article content
    article = soup.find("article") or soup.find("div", class_=re.compile(r"article|content|post"))
    if not article:
        article = soup.find("div", {"class": "text"}) or soup.body

    # Clean up nav/ads/scripts
    for tag in article.find_all(["script", "style", "nav", "footer",
                                  "aside", "button", "figure"]):
        tag.decompose()

    text = article.get_text(separator="\n", strip=True)
    # Collapse excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    header = f"Source: GeeksforGeeks\nTopic: {topic}\nURL: {url}\n"
    return header + text


# ════════════════════════════════════════════════════════════
# HELPER: scrape a Javanotes chapter (Eck's free textbook)
# ════════════════════════════════════════════════════════════
def scrape_javanotes(url: str, chapter: str) -> str:
    """Scrape a Javanotes chapter page."""
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    body = soup.find("div", class_="content") or soup.find("body")
    for tag in body.find_all(["script", "style", "nav"]):
        tag.decompose()

    text = body.get_text(separator="\n", strip=True)
    text = re.sub(r'\n{3,}', '\n\n', text)

    header = f"Source: Introduction to Programming Using Java (Eck)\nChapter: {chapter}\nURL: {url}\n"
    return header + text


# ════════════════════════════════════════════════════════════
# HELPER: scrape Open Data Structures chapters (ODS Java)
# Uses the correct working URLs
# ════════════════════════════════════════════════════════════
def scrape_ods(url: str, chapter: str) -> str:
    """Fetch ODS LaTeX source from GitHub — readable plain text."""
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()

    # Strip LaTeX commands for cleaner RAG chunking
    text = r.text
    text = re.sub(r'\\begin\{[^}]+\}|\\end\{[^}]+\}', '', text)
    text = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', text)  # \cmd{text} → text
    text = re.sub(r'\\[a-zA-Z]+\b', '', text)               # lone \commands
    text = re.sub(r'[{}]', '', text)
    text = re.sub(r'%.*', '', text)                          # LaTeX comments
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    header = f"Source: Open Data Structures in Java (Morin)\nChapter: {chapter}\nURL: {url}\n"
    return header + text


# ════════════════════════════════════════════════════════════
# HELPER: save file (skip if already large enough)
# ════════════════════════════════════════════════════════════
def save(path: str, content: str, min_bytes: int = 1000):
    if os.path.exists(path) and os.path.getsize(path) >= min_bytes:
        print(f"  ⏭  SKIP (already exists): {os.path.basename(path)}")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ SAVED ({len(content):,} chars): {os.path.basename(path)}")


def fetch(fn, *args):
    try:
        return fn(*args)
    except Exception as e:
        print(f"  ❌ FAILED {args[0] if args else ''}: {e}")
        return None


# ════════════════════════════════════════════════════════════
# 1. MISSING GFG TOPICS  (10 new files)
# ════════════════════════════════════════════════════════════
GFG_MISSING = [
    ("gfg_020_lambda-expressions-java.txt",
     "https://www.geeksforgeeks.org/lambda-expressions-java-8/",
     "lambda-expressions-java-8"),

    ("gfg_021_functional-interface-java.txt",
     "https://www.geeksforgeeks.org/functional-interfaces-java/",
     "functional-interfaces-java"),

    ("gfg_022_optional-java.txt",
     "https://www.geeksforgeeks.org/java-8-optional-class/",
     "java-8-optional-class"),

    ("gfg_023_method-chaining-java.txt",
     "https://www.geeksforgeeks.org/method-chaining-in-java-with-examples/",
     "method-chaining-in-java"),

    ("gfg_024_generics-java.txt",
     "https://www.geeksforgeeks.org/generics-in-java/",
     "generics-in-java"),

    ("gfg_025_autoboxing-unboxing-java.txt",
     "https://www.geeksforgeeks.org/autoboxing-unboxing-java/",
     "autoboxing-unboxing-java"),

    ("gfg_026_arraylist-vs-linkedlist.txt",
     "https://www.geeksforgeeks.org/arraylist-vs-linkedlist-java/",
     "arraylist-vs-linkedlist-java"),

    ("gfg_027_comparable-comparator-java.txt",
     "https://www.geeksforgeeks.org/comparable-vs-comparator-in-java/",
     "comparable-vs-comparator-java"),

    ("gfg_028_instanceof-java.txt",
     "https://www.geeksforgeeks.org/java-instanceof-and-its-applications/",
     "java-instanceof"),

    ("gfg_029_method-overriding-java.txt",
     "https://www.geeksforgeeks.org/overriding-in-java/",
     "method-overriding-java"),
]

print("=" * 60)
print("1. FETCHING MISSING GFG TOPICS")
print("=" * 60)
for filename, url, topic in GFG_MISSING:
    print(f"\n→ {topic}")
    content = fetch(scrape_gfg, url, topic)
    if content:
        save(os.path.join(DIR_GFG, filename), content)
    time.sleep(DELAY)


# ════════════════════════════════════════════════════════════
# 2. FIX DATA_STRUCTURES (ODS Java — correct working URLs)
# ════════════════════════════════════════════════════════════
# ODS uses a single-page HTML version at opendatastructures.org
# The multi-page version has dead links; use the PDF mirror or
# the GitHub-hosted HTML instead.
ODS_CHAPTERS = [
    ("ods_chapter_01.txt", "https://opendatastructures.org/ods-java/ods-javabook.html",
     "Chapter 1: Array-Based Lists"),
    # The full book is one large HTML; we scrape per section below
]

# Better approach: scrape the single-file HTML version by section
ODS_SECTIONS = [
    ("ods_chapter_01.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/intro.tex",
     "1. Introduction"),

    ("ods_chapter_02.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/arrays.tex",
     "2. Array-Based Lists (ArrayStack, FastArrayStack, ArrayDeque)"),

    ("ods_chapter_03.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/linkedlists.tex",
     "3. Linked Lists (SLList, DLList, SEList)"),

    ("ods_chapter_04.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/skiplists.tex",
     "4. Skiplists"),

    ("ods_chapter_05.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/hashing.tex",
     "5. Hash Tables"),

    ("ods_chapter_06.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/binarytrees.tex",
     "6. Binary Trees"),

    ("ods_chapter_07.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/rbs.tex",
     "7. Random Binary Search Trees"),

    ("ods_chapter_08.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/scapegoat.tex",
     "8. Scapegoat Trees"),

    ("ods_chapter_09.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/redblack.tex",
     "9. Red-Black Trees"),

    ("ods_chapter_10.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/heaps.tex",
     "10. Heaps"),

    ("ods_chapter_11.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/sorting.tex",
     "11. Sorting Algorithms"),

    ("ods_chapter_12.txt",
     "https://raw.githubusercontent.com/patmorin/ods/master/latex/graphs.tex",
     "12. Graphs"),
]

print("\n" + "=" * 60)
print("2. FIXING DATA_STRUCTURES (ODS Java chapters)")
print("=" * 60)
for filename, url, chapter in ODS_SECTIONS:
    print(f"\n→ {chapter}")
    content = fetch(scrape_ods, url, chapter)
    if content:
        save(os.path.join(DIR_DS, filename), content)
    time.sleep(DELAY)


# ════════════════════════════════════════════════════════════
# 3. FIX JAVANOTES (Eck's textbook — correct working URLs)
# ════════════════════════════════════════════════════════════
JAVANOTES_CHAPTERS = [
    ("c1-overview.txt",
     "https://math.hws.edu/javanotes/c1/index.html",
     "Chapter 1: Overview of Java"),

    ("c2-basics.txt",
     "https://math.hws.edu/javanotes/c2/index.html",
     "Chapter 2: Names and Things"),

    ("c3-control.txt",
     "https://math.hws.edu/javanotes/c3/index.html",
     "Chapter 3: Control"),

    ("c4-subroutines.txt",
     "https://math.hws.edu/javanotes/c4/index.html",
     "Chapter 4: Subroutines"),

    ("c5-OOP.txt",
     "https://math.hws.edu/javanotes/c5/index.html",
     "Chapter 5: Objects and Classes"),

    ("c6-arrays-arraylists.txt",
     "https://math.hws.edu/javanotes/c6/index.html",
     "Chapter 6: Introduction to GUI Programming"),

    ("c7-recursion.txt",
     "https://math.hws.edu/javanotes/c7/index.html",
     "Chapter 7: Arrays, ArrayLists, and Records"),

    ("c8-correctness-robustness.txt",
     "https://math.hws.edu/javanotes/c8/index.html",
     "Chapter 8: Correctness, Robustness, Efficiency"),

    ("c9-threads.txt",
     "https://math.hws.edu/javanotes/c9/index.html",
     "Chapter 9: Linked Data Structures and Recursion"),

    ("c10-generics-streams.txt",
     "https://math.hws.edu/javanotes/c10/index.html",
     "Chapter 10: Generic Programming and Collection Classes"),

    ("c11-io-files-networking.txt",
     "https://math.hws.edu/javanotes/c11/index.html",
     "Chapter 11: IO Streams, Files, Networking"),

    ("c12-gui.txt",
     "https://math.hws.edu/javanotes/c12/index.html",
     "Chapter 12: Threads and Multiprocessing"),
]

print("\n" + "=" * 60)
print("3. FIXING JAVANOTES CHAPTERS")
print("=" * 60)
for filename, url, chapter in JAVANOTES_CHAPTERS:
    print(f"\n→ {chapter}")
    content = fetch(scrape_javanotes, url, chapter)
    if content:
        save(os.path.join(DIR_JN, filename), content)
    time.sleep(DELAY)


# ════════════════════════════════════════════════════════════
# DONE
# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("✅ ALL DONE — now rebuild your vectorstore:")
print("   rag_chain, retriever = setup_rag_system(rebuild_vectorstore=True)")
print("=" * 60)