"""Prepare a Markdown source for ArgML conversion.

Reads a Markdown file (or fetches a URL body), parses it into sections and
paragraphs via `markdown_tree`, and emits:

- A paragraph-numbered "view" string where every paragraph carries a
  ``[¶S.P] `` prefix that the LLM can quote to locate spans.
- An optional JSON metadata sidecar (title, author, date, counts).

This script does no fancy HTML-to-Markdown extraction. URL fetching just
writes the raw body to a temp file; the source-prep subagent is responsible
for any platform-specific body extraction before invoking this script.

CLI:
    python3 prepare_source.py --file PATH [--output PATH] [--metadata PATH]
    python3 prepare_source.py --url URL [--output PATH] [--metadata PATH]
    python3 prepare_source.py --help

Exit codes:
    0 — success
    3 — IO / fetch error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Allow running this script either as a module or directly from its directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from markdown_tree import MarkdownTree, parse  # noqa: E402


_FOOTNOTE_DEF_RE = re.compile(r"^\[\^[^\]]+\]:")
_FENCE_OPEN_RE = re.compile(r"^(```+|~~~+)")
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_TITLE_RE = re.compile(r"^#\s+(.*)$", re.MULTILINE)


def _build_paragraph_view(tree: MarkdownTree) -> str:
    """Render the paragraph-numbered view as a single string.

    Format::

        [¶0.1] First preamble paragraph.

        [¶0.2] Second preamble paragraph.

        ## Section heading

        [¶1.1] First paragraph of section 1.

    Paragraphs are separated by blank lines, matching source structure.
    """
    out: list[str] = []
    for section in tree.sections:
        if section.heading is not None:
            if out:
                out.append("")
            out.append(f"## {section.heading}")
        for para in section.paragraphs:
            if out:
                out.append("")
            prefix = f"[¶{section.index}.{para.index}] "
            # Indent continuation lines to keep them aligned visually,
            # but DON'T mutate the text — the engine strips the prefix from
            # the first line only.
            out.append(f"{prefix}{para.text}")
    return "\n".join(out) + "\n"


def _count_footnotes(tree: MarkdownTree) -> int:
    """Count footnote definitions (``[^N]: ...``) in the tree."""
    count = 0
    for section in tree.sections:
        for para in section.paragraphs:
            if _FOOTNOTE_DEF_RE.match(para.text):
                count += 1
    return count


def _count_code_blocks(tree: MarkdownTree) -> int:
    """Count fenced code blocks across all paragraphs."""
    count = 0
    for section in tree.sections:
        for para in section.paragraphs:
            if _FENCE_OPEN_RE.match(para.text):
                count += 1
    return count


def _count_words(tree: MarkdownTree) -> int:
    """Crude whitespace-split word count of paragraph text."""
    total = 0
    for section in tree.sections:
        for para in section.paragraphs:
            total += len(para.text.split())
    return total


def _count_paragraphs(tree: MarkdownTree) -> int:
    """Total paragraphs across all sections."""
    return sum(len(s.paragraphs) for s in tree.sections)


def _extract_title(markdown: str) -> str | None:
    """Best-effort title extraction from a leading ``# Heading`` line."""
    # Strip frontmatter first if present.
    body = markdown
    fm = _FRONTMATTER_RE.match(body)
    if fm:
        body = body[fm.end():]
        # Try frontmatter title first.
        for line in fm.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                if key.strip().lower() == "title":
                    return value.strip().strip("\"'")
    m = _TITLE_RE.search(body)
    if m:
        return m.group(1).strip()
    return None


def _extract_frontmatter_field(markdown: str, field: str) -> str | None:
    """Pull a single field value from a leading YAML-ish frontmatter block."""
    fm = _FRONTMATTER_RE.match(markdown)
    if not fm:
        return None
    for line in fm.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            if key.strip().lower() == field.lower():
                return value.strip().strip("\"'") or None
    return None


def _fetch_url(url: str) -> str:
    """Fetch URL body using stdlib urllib. Returns decoded text."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "argml-converter/0.2 (+https://github.com/ianwsperber/arg-ml; "
                "stdlib urllib)"
            )
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


def _build_metadata(
    *,
    tree: MarkdownTree,
    markdown: str,
    file_path: str | None,
    url: str | None,
) -> dict[str, object]:
    """Construct the metadata sidecar dict."""
    title = _extract_title(markdown)
    author = _extract_frontmatter_field(markdown, "author")
    date = _extract_frontmatter_field(markdown, "date")
    # Section count excludes the preamble (section 0) if present.
    section_count = sum(1 for s in tree.sections if s.heading is not None)
    return {
        "file_path": file_path,
        "url": url,
        "title": title,
        "author": author,
        "date": date,
        "word_count": _count_words(tree),
        "section_count": section_count,
        "paragraph_count": _count_paragraphs(tree),
        "footnote_count": _count_footnotes(tree),
        "code_block_count": _count_code_blocks(tree),
    }


def _read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_output(text: str, output_path: str | None) -> None:
    if output_path is None:
        sys.stdout.write(text)
        return
    Path(output_path).write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="prepare_source.py",
        description=(
            "Parse a Markdown source into the paragraph-numbered view consumed "
            "by the ArgML converter LLM. With --url, fetches the raw body (no "
            "HTML extraction — the source-prep subagent does HTML-to-markdown "
            "before invoking this script)."
        ),
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--file", type=str, help="Path to a local Markdown file.")
    src.add_argument("--url", type=str, help="URL to fetch (raw body only).")
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to write the paragraph-numbered view. Default: stdout.",
    )
    parser.add_argument(
        "--metadata",
        type=str,
        default=None,
        help="Path to write a JSON metadata sidecar.",
    )

    args = parser.parse_args(argv)

    try:
        if args.file:
            md = _read_file(Path(args.file))
            file_path: str | None = str(Path(args.file).resolve())
            url: str | None = None
        else:
            md = _fetch_url(args.url)
            file_path = None
            url = args.url
    except (OSError, urllib.error.URLError, ValueError) as e:
        print(f"prepare_source: IO/fetch error: {e}", file=sys.stderr)
        return 3

    tree = parse(md)
    view = _build_paragraph_view(tree)

    try:
        _write_output(view, args.output)
        if args.metadata:
            metadata = _build_metadata(
                tree=tree, markdown=md, file_path=file_path, url=url
            )
            Path(args.metadata).write_text(
                json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
    except OSError as e:
        print(f"prepare_source: write error: {e}", file=sys.stderr)
        return 3

    return 0


if __name__ == "__main__":
    sys.exit(main())
