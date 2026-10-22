import argparse
import os
import pickle
from collections import defaultdict
from pathlib import Path


KNOWN_SOURCE_DIRS = {
    "w3schools",
    "oracle",
    "geeksforgeeks",
    "books",
    "javanotes",
    "data_structures",
    "exceptions",
    "platform_guide",
}


def load_docstore_dict(vectorstore_path: str):
    index_pkl = os.path.join(vectorstore_path, "index.pkl")
    with open(index_pkl, "rb") as handle:
        store_data = pickle.load(handle)

    if hasattr(store_data, "docstore") and hasattr(store_data.docstore, "_dict"):
        return store_data.docstore._dict

    if isinstance(store_data, tuple):
        for item in store_data:
            if hasattr(item, "_dict"):
                return item._dict
            if isinstance(item, dict) and item:
                sample = next(iter(item.values()))
                if hasattr(sample, "page_content") or isinstance(sample, dict):
                    return item

    if isinstance(store_data, dict):
        return store_data

    raise RuntimeError(f"Unsupported FAISS docstore format in {index_pkl}")


def classify_bucket(source_path: str) -> str:
    lowered = source_path.replace("\\", "/").lower()
    if "platform_guide" in lowered:
        return "platform_guide"
    return "java_knowledge"


def relative_output_path(source_path: str, bucket: str) -> Path:
    normalized = source_path.replace("\\", "/")
    parts = [part for part in normalized.split("/") if part]

    relative_parts = None
    for index, part in enumerate(parts):
        if part in KNOWN_SOURCE_DIRS:
            relative_parts = parts[index:]
            break

    if relative_parts is None:
        filename = Path(normalized).name or "recovered_document.txt"
        relative_parts = [filename]

    if relative_parts and relative_parts[0] == bucket:
        relative_parts = relative_parts[1:] or [Path(normalized).name or "recovered_document.txt"]

    relative_path = Path(*relative_parts)
    if relative_path.suffix.lower() != ".txt":
        relative_path = relative_path.with_suffix(".txt")
    return relative_path


def chunk_sort_key(metadata: dict, fallback_index: int):
    for key in (
        "chunk_index",
        "chunk_id",
        "chunk_number",
        "sequence",
        "seq_num",
        "page",
        "page_number",
        "start_index",
    ):
        value = metadata.get(key)
        if isinstance(value, int):
            return (0, value, fallback_index)
        if isinstance(value, str) and value.isdigit():
            return (0, int(value), fallback_index)
    return (1, fallback_index)


def merge_overlapping_chunks(chunks):
    merged = ""
    for chunk in chunks:
        if not merged:
            merged = chunk
            continue

        max_overlap = min(len(merged), len(chunk), 400)
        overlap = 0
        for size in range(max_overlap, 40, -1):
            if merged.endswith(chunk[:size]):
                overlap = size
                break
        merged += chunk[overlap:]
    return merged


def extract_documents(doc_dict):
    grouped = defaultdict(list)
    for index, (_, doc) in enumerate(doc_dict.items()):
        if hasattr(doc, "page_content") and hasattr(doc, "metadata"):
            content = doc.page_content
            metadata = doc.metadata or {}
        elif isinstance(doc, dict):
            content = doc.get("page_content", "")
            metadata = doc.get("metadata", {}) or {}
        else:
            content = str(doc)
            metadata = {}

        source_path = metadata.get("source") or f"unknown/recovered_{index}.txt"
        bucket = classify_bucket(source_path)
        relative_path = relative_output_path(source_path, bucket)
        grouped[(bucket, relative_path)].append(
            {
                "content": content,
                "metadata": metadata,
                "sort_key": chunk_sort_key(metadata, index),
            }
        )
    return grouped


def write_recovered_files(grouped, output_root: str):
    counts = defaultdict(int)
    for (bucket, relative_path), chunks in grouped.items():
        chunks.sort(key=lambda item: item["sort_key"])
        merged_text = merge_overlapping_chunks([item["content"] for item in chunks])

        output_path = Path(output_root) / bucket / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(merged_text.strip() + "\n", encoding="utf-8")
        counts[bucket] += 1
        print(f"Recovered {output_path} from {len(chunks)} chunks")
    return counts


def main():
    parser = argparse.ArgumentParser(
        description="Recover source .txt files from an existing FAISS vectorstore and split them by knowledge base."
    )
    parser.add_argument(
        "--vectorstore-path",
        default="vectorstore",
        help="Path to the existing FAISS vectorstore that still contains the unified docstore.",
    )
    parser.add_argument(
        "--output-root",
        default="java_docs",
        help="Directory where recovered java_knowledge and platform_guide sources will be written.",
    )
    args = parser.parse_args()

    doc_dict = load_docstore_dict(args.vectorstore_path)
    grouped = extract_documents(doc_dict)
    counts = write_recovered_files(grouped, args.output_root)

    print()
    print("Recovery complete")
    print(f"  Java knowledge files: {counts['java_knowledge']}")
    print(f"  Platform guide files: {counts['platform_guide']}")


if __name__ == "__main__":
    main()