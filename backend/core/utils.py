import re


def compress_text(text: str, max_lines: int = 50) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    lines = [line for line in lines if not re.match(r"^\d+$", line)]
    return "\n".join(lines[:max_lines])
