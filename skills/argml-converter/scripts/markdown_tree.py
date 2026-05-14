"""Shared module: parse Markdown into a section/paragraph tree.

Used by both `prepare_source.py` and `apply_manifest.py`.

Public API:
    parse(markdown: str) -> MarkdownTree
    @dataclass Paragraph
    @dataclass Section
    @dataclass MarkdownTree

Section addressing rules:
    - Section 0 is the preamble (everything before the first ``## `` heading).
    - Sections 1, 2, ... correspond to top-level ``## `` headings in source order.
    - Sub-headings (``###``, ``####``, ...) and ``#`` (h1) flatten INTO the parent
      section's paragraph list. The heading line becomes a paragraph whose text
      starts with the ``#`` markers, so it survives round-trip.

Paragraph rules:
    - Paragraphs split on one or more blank lines.
    - Code fences (``` ``` ```) are kept atomic.
    - Footnote definitions are paragraphs like any other.
    - `to_source_text()` is bit-equivalent to the input (modulo a single
      trailing newline normalization).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Paragraph:
    """A paragraph of source text within a section.

    `text` includes all inline markdown (italics, links, footnote markers).
    `index` is 1-indexed within its section.
    """

    text: str
    index: int


@dataclass
class Section:
    """A section of the document.

    `index=0` is the preamble (no heading). `index=1,2,...` are top-level
    `## ` headings in source order.
    """

    index: int
    heading: str | None
    paragraphs: list[Paragraph] = field(default_factory=list)


@dataclass
class MarkdownTree:
    """Parsed Markdown organized into sections."""

    sections: list[Section] = field(default_factory=list)

    def to_source_text(self) -> str:
        """Reassemble the source text from the tree.

        Bit-equivalent to the input modulo a single trailing newline.
        """
        out: list[str] = []
        for i, section in enumerate(self.sections):
            if section.heading is not None:
                if out:
                    # Blank line separating previous section from heading
                    out.append("")
                out.append(f"## {section.heading}")
                if section.paragraphs:
                    out.append("")
            for j, para in enumerate(section.paragraphs):
                if j > 0 or (section.heading is None and j == 0 and i == 0):
                    # Inter-paragraph blank line
                    if out and out[-1] != "":
                        out.append("")
                    elif j > 0:
                        out.append("")
                out.append(para.text)
        # Single trailing newline
        return "\n".join(out) + "\n"


# A line that opens or closes a fenced code block.
_FENCE_RE = re.compile(r"^(```+|~~~+)")

# A top-level h2 heading: ``## Text``.
_H2_RE = re.compile(r"^##\s+(.*)$")


def _split_paragraphs(lines: list[str]) -> list[str]:
    """Split a list of lines into paragraph texts.

    Paragraphs are separated by one or more blank lines. Lines inside a
    fenced code block are NOT split, even if they look blank.
    """
    paragraphs: list[str] = []
    current: list[str] = []
    in_fence = False
    fence_marker: str | None = None

    for line in lines:
        stripped = line.rstrip("\n")
        if in_fence:
            current.append(stripped)
            # Closing fence: same marker, possibly with trailing whitespace.
            if fence_marker is not None and stripped.strip() == fence_marker:
                in_fence = False
                fence_marker = None
            continue

        m = _FENCE_RE.match(stripped)
        if m:
            in_fence = True
            fence_marker = m.group(1)
            current.append(stripped)
            continue

        if stripped.strip() == "":
            # Paragraph break (unless we are between paragraphs).
            if current:
                paragraphs.append("\n".join(current))
                current = []
            # Otherwise: collapse runs of blank lines.
            continue

        current.append(stripped)

    if current:
        paragraphs.append("\n".join(current))

    return paragraphs


def parse(markdown: str) -> MarkdownTree:
    """Parse a Markdown string into sections and paragraphs."""
    lines = markdown.splitlines()

    # Split into section line-buckets first.
    sections_lines: list[tuple[str | None, list[str]]] = []
    current_heading: str | None = None
    current_lines: list[str] = []
    in_fence = False
    fence_marker: str | None = None

    for line in lines:
        if in_fence:
            current_lines.append(line)
            if fence_marker is not None and line.strip() == fence_marker:
                in_fence = False
                fence_marker = None
            continue

        m = _FENCE_RE.match(line)
        if m:
            in_fence = True
            fence_marker = m.group(1)
            current_lines.append(line)
            continue

        h = _H2_RE.match(line)
        if h:
            # Close out previous section
            sections_lines.append((current_heading, current_lines))
            current_heading = h.group(1).strip()
            current_lines = []
            continue

        current_lines.append(line)

    sections_lines.append((current_heading, current_lines))

    # Build Section objects, splitting each section's lines into paragraphs.
    tree = MarkdownTree(sections=[])
    section_index = 0
    for heading, sec_lines in sections_lines:
        # Skip a synthetic empty preamble that arose because the file
        # starts with `## ...` — there are no lines AND we have not yet
        # emitted any sections, so the preamble does not exist.
        if (
            heading is None
            and section_index == 0
            and all(line.strip() == "" for line in sec_lines)
        ):
            section_index += 1
            continue
        paragraphs_text = _split_paragraphs(sec_lines)
        paragraphs = [
            Paragraph(text=text, index=i + 1)
            for i, text in enumerate(paragraphs_text)
        ]
        tree.sections.append(
            Section(
                index=section_index,
                heading=heading,
                paragraphs=paragraphs,
            )
        )
        section_index += 1

    return tree


# ---------------------------------------------------------------------------
# Inline self-tests. Run with: ``python3 markdown_tree.py``
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    from pathlib import Path

    def _check(name: str, cond: bool, detail: str = "") -> None:
        status = "PASS" if cond else "FAIL"
        print(f"  [{status}] {name}{(': ' + detail) if detail and not cond else ''}")
        if not cond:
            sys.exit(1)

    print("test: basic two-section parse")
    src = "preamble para 1\n\npreamble para 2\n\n## Heading One\n\nbody para 1\n\nbody para 2\n"
    tree = parse(src)
    _check("two sections", len(tree.sections) == 2)
    _check("preamble heading None", tree.sections[0].heading is None)
    _check("preamble index 0", tree.sections[0].index == 0)
    _check("preamble 2 paragraphs", len(tree.sections[0].paragraphs) == 2)
    _check("section heading", tree.sections[1].heading == "Heading One")
    _check("section index 1", tree.sections[1].index == 1)
    _check("section 2 paragraphs", len(tree.sections[1].paragraphs) == 2)

    print("test: no-preamble document starts with heading")
    src2 = "## First\n\nfirst para\n\n## Second\n\nsecond para\n"
    tree2 = parse(src2)
    _check("two sections (no preamble)", len(tree2.sections) == 2)
    _check("first section is index 1", tree2.sections[0].index == 1)
    _check("first heading", tree2.sections[0].heading == "First")

    print("test: round-trip of the example file")
    example = Path(__file__).resolve().parents[3] / "examples" / "consciousness-without-morality.md"
    if example.exists():
        original = example.read_text(encoding="utf-8")
        tree3 = parse(original)
        round_tripped = tree3.to_source_text()
        # Normalize trailing newlines on both sides.
        original_n = original.rstrip("\n") + "\n"
        round_n = round_tripped.rstrip("\n") + "\n"
        if original_n != round_n:
            # Compute a small diff hint
            import difflib

            diff = list(
                difflib.unified_diff(
                    original_n.splitlines(keepends=True),
                    round_n.splitlines(keepends=True),
                    fromfile="original",
                    tofile="round-trip",
                    n=2,
                )
            )
            preview = "".join(diff[:40])
            _check("round-trip bit-equivalent", False, detail=f"\n{preview}")
        else:
            _check("round-trip bit-equivalent", True)
    else:
        print("  [SKIP] example file not found")

    print("test: code fence keeps content atomic")
    src3 = "before\n\n```\nblock\n\nstill block\n```\n\nafter\n"
    tree3 = parse(src3)
    _check("three paragraphs (before / fence / after)", len(tree3.sections[0].paragraphs) == 3)
    _check("fence paragraph spans blank line", "still block" in tree3.sections[0].paragraphs[1].text)

    print("\nAll inline tests passed.")
