"""Apply an ArgML manifest to a Markdown source and emit an ArgML document.

The manifest (``urn:argml-manifest:v1``) is produced by the converter LLM
and contains: the generated ``<head>``, plus a list of three kinds of edits
(``<inline>``, ``<wrap>``, ``<insert>``). The engine pairs the manifest with
the original Markdown source, verifies 8 preconditions, applies the edits
in three phases (inlines, then wraps, then inserts), assembles the final
``<post xmlns="urn:argml:v1">`` document, and verifies 4 postconditions.

Source fidelity becomes mechanical: any span not explicitly wrapped is
preserved bit-for-bit from the source by construction.

CLI:
    python3 apply_manifest.py --manifest PATH --source PATH
                              [--output PATH] [--debug]
    python3 apply_manifest.py --help

Exit codes:
    0 — success
    1 — precondition failure (structured JSON report on stderr)
    2 — postcondition failure (structured JSON report on stderr)
    3 — IO / parse error
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from markdown_tree import MarkdownTree, parse as parse_markdown  # noqa: E402


MANIFEST_NS = "urn:argml-manifest:v1"
ARGML_NS = "urn:argml:v1"

# Maximum allowed find-occurrence count: if a span appears more than this
# in a paragraph, the LLM almost certainly miscounted.
MAX_OCCURRENCE = 5


# ---------------------------------------------------------------------------
# Manifest data model
# ---------------------------------------------------------------------------


@dataclass
class InlineEdit:
    section: int
    paragraph: int
    find: str
    replace_xml: str  # serialized replacement (no namespace prefixes)
    occurrence: int | None  # None = unique-or-fail; 1-indexed otherwise
    # Resolved at precondition time:
    find_start: int = -1
    find_end: int = -1

    def locator(self) -> str:
        snippet = (self.find[:40] + "…") if len(self.find) > 40 else self.find
        return f"inline §{self.section}¶{self.paragraph} find={snippet!r}"


@dataclass
class WrapEdit:
    section: int
    from_para: int
    to_para: int
    wrapper_xml: str  # contains a literal `<wrapped-content/>` placeholder

    def locator(self) -> str:
        return (
            f"wrap §{self.section}¶{self.from_para}..{self.to_para}"
        )


@dataclass
class InsertEdit:
    section: int
    after: int
    block_xml: str

    def locator(self) -> str:
        return f"insert §{self.section} after ¶{self.after}"


@dataclass
class Manifest:
    head_xml: str  # the full ``<head>...</head>`` block, as a string
    inlines: list[InlineEdit] = field(default_factory=list)
    wraps: list[WrapEdit] = field(default_factory=list)
    inserts: list[InsertEdit] = field(default_factory=list)


# ---------------------------------------------------------------------------
# XML serialization helpers
# ---------------------------------------------------------------------------


def _strip_manifest_ns(elem: ET.Element) -> None:
    """Recursively rewrite Clark-notation tags to local names.

    Both the manifest namespace (``urn:argml-manifest:v1``) and any explicit
    ``urn:argml:v1`` references on payload children should serialize without
    namespace prefixes — the final document's ``<post xmlns="urn:argml:v1">``
    establishes the default, and ElementTree's serializer otherwise emits
    ``ns0:`` style prefixes that pollute the output.
    """
    for el in elem.iter():
        if el.tag.startswith("{"):
            el.tag = el.tag.split("}", 1)[1]
        # Wipe any inherited xmlns attributes.
        attribs_to_remove = [k for k in el.attrib if k.startswith("xmlns")]
        for k in attribs_to_remove:
            del el.attrib[k]
        # Some serializers also leak xmlns into element-level attrs in
        # Clark form. Drop those too.
        attribs_to_remove = [k for k in el.attrib if k.startswith("{")]
        for k in attribs_to_remove:
            # Keep the attr's local name, drop the namespace.
            local = k.split("}", 1)[1]
            el.attrib[local] = el.attrib[k]
            del el.attrib[k]


def _serialize_inner(elem: ET.Element) -> str:
    """Serialize the children + text of `elem`, NOT `elem` itself.

    Returns: the concatenated XML representation of `elem`'s body.
    """
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)
    for child in list(elem):
        parts.append(ET.tostring(child, encoding="unicode"))
    return "".join(parts)


def _serialize_children_only(elem: ET.Element) -> str:
    """Serialize each child as a full element (no leading text)."""
    return "".join(ET.tostring(child, encoding="unicode") for child in list(elem))


# ---------------------------------------------------------------------------
# Manifest parsing
# ---------------------------------------------------------------------------


def _q(tag: str) -> str:
    return f"{{{MANIFEST_NS}}}{tag}"


def parse_manifest(path: Path) -> Manifest:
    """Parse the manifest XML into a Manifest object.

    Raises:
        ValueError: if the root element is wrong or required children
            are missing.
    """
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        raise ValueError(f"malformed manifest XML: {e}") from e

    root = tree.getroot()
    if root.tag != _q("argml-manifest"):
        raise ValueError(
            f"manifest root must be <argml-manifest xmlns=\"{MANIFEST_NS}\">; "
            f"got {root.tag!r}"
        )

    head_el = root.find(_q("head"))
    if head_el is None:
        raise ValueError("manifest missing <head> element")

    # Serialize <head> contents, stripped of the manifest namespace.
    # Deep-copy so we don't mutate the parsed tree (still referenced elsewhere).
    head_copy = copy.deepcopy(head_el)
    _strip_manifest_ns(head_copy)
    head_xml = ET.tostring(head_copy, encoding="unicode")

    edits_el = root.find(_q("edits"))
    inlines: list[InlineEdit] = []
    wraps: list[WrapEdit] = []
    inserts: list[InsertEdit] = []

    if edits_el is not None:
        for edit_el in list(edits_el):
            local = edit_el.tag.split("}", 1)[1] if edit_el.tag.startswith("{") else edit_el.tag
            if local == "inline":
                inlines.append(_parse_inline(edit_el))
            elif local == "wrap":
                wraps.append(_parse_wrap(edit_el))
            elif local == "insert":
                inserts.append(_parse_insert(edit_el))
            else:
                raise ValueError(f"unknown edit element: <{local}>")

    return Manifest(head_xml=head_xml, inlines=inlines, wraps=wraps, inserts=inserts)


def _parse_inline(elem: ET.Element) -> InlineEdit:
    section = int(_require_attr(elem, "section"))
    paragraph = int(_require_attr(elem, "paragraph"))
    occurrence_str = elem.get("occurrence")
    occurrence = int(occurrence_str) if occurrence_str is not None else None

    find_el = elem.find(_q("find"))
    if find_el is None:
        raise ValueError(f"<inline> missing <find> child at §{section}¶{paragraph}")
    find_text = find_el.text or ""

    replace_el = elem.find(_q("replace"))
    if replace_el is None:
        raise ValueError(f"<inline> missing <replace> child at §{section}¶{paragraph}")

    replace_copy = copy.deepcopy(replace_el)
    _strip_manifest_ns(replace_copy)
    replace_xml = _serialize_inner(replace_copy)

    return InlineEdit(
        section=section,
        paragraph=paragraph,
        find=find_text,
        replace_xml=replace_xml,
        occurrence=occurrence,
    )


def _parse_wrap(elem: ET.Element) -> WrapEdit:
    section = int(_require_attr(elem, "section"))
    from_para = int(_require_attr(elem, "from"))
    to_para = int(_require_attr(elem, "to"))

    # The body of <wrap> contains a single block element (e.g. <argument>)
    # which itself contains a <wrapped-content/> placeholder.
    children = list(elem)
    if len(children) != 1:
        raise ValueError(
            f"<wrap> at §{section}¶{from_para}..{to_para} must have exactly one "
            f"child block element; got {len(children)}"
        )
    wrapper_copy = copy.deepcopy(children[0])
    _strip_manifest_ns(wrapper_copy)
    wrapper_xml = ET.tostring(wrapper_copy, encoding="unicode")

    return WrapEdit(
        section=section,
        from_para=from_para,
        to_para=to_para,
        wrapper_xml=wrapper_xml,
    )


def _parse_insert(elem: ET.Element) -> InsertEdit:
    section = int(_require_attr(elem, "section"))
    after = int(_require_attr(elem, "after"))

    children = list(elem)
    if len(children) != 1:
        raise ValueError(
            f"<insert> at §{section} after ¶{after} must have exactly one "
            f"child block element; got {len(children)}"
        )
    block_copy = copy.deepcopy(children[0])
    _strip_manifest_ns(block_copy)
    block_xml = ET.tostring(block_copy, encoding="unicode")

    return InsertEdit(section=section, after=after, block_xml=block_xml)


def _require_attr(elem: ET.Element, name: str) -> str:
    val = elem.get(name)
    if val is None:
        local = elem.tag.split("}", 1)[1] if elem.tag.startswith("{") else elem.tag
        raise ValueError(f"<{local}> missing required attribute {name!r}")
    return val


# ---------------------------------------------------------------------------
# Source parsing: strip [¶S.P] prefixes if present
# ---------------------------------------------------------------------------


_PARA_PREFIX_RE = re.compile(r"^\[¶(\d+)\.(\d+)\]\s")


def _strip_paragraph_prefixes(text: str) -> str:
    """Strip ``[¶S.P] `` markers from the first line of each paragraph.

    The engine accepts both raw markdown and the paragraph-numbered view.
    """
    out_lines: list[str] = []
    for line in text.splitlines(keepends=True):
        stripped = _PARA_PREFIX_RE.sub("", line, count=1)
        out_lines.append(stripped)
    return "".join(out_lines)


# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------


@dataclass
class PreconditionError:
    edit: str
    kind: str  # "P1".."P8"
    section: int | None
    paragraph: int | None
    reason: str
    suggestion: str = ""


def _find_paragraph(tree: MarkdownTree, section: int, paragraph: int):
    for s in tree.sections:
        if s.index == section:
            for p in s.paragraphs:
                if p.index == paragraph:
                    return p
            return None
    return None


def _find_section(tree: MarkdownTree, section: int):
    for s in tree.sections:
        if s.index == section:
            return s
    return None


def _all_occurrences(haystack: str, needle: str) -> list[int]:
    """Return all start positions of `needle` in `haystack`."""
    if not needle:
        return []
    positions: list[int] = []
    start = 0
    while True:
        idx = haystack.find(needle, start)
        if idx < 0:
            break
        positions.append(idx)
        start = idx + 1  # overlapping search is OK (we cap at MAX_OCCURRENCE)
    return positions


def check_preconditions(
    manifest: Manifest, tree: MarkdownTree
) -> list[PreconditionError]:
    """Validate the 8 preconditions against the source tree.

    Returns an empty list if all pass; otherwise an accumulated list of
    structured errors.
    """
    errors: list[PreconditionError] = []

    # First pass: validate every inline edit can locate its find, set its
    # find_start/find_end, and that occurrence is in range.
    for edit in manifest.inlines:
        para = _find_paragraph(tree, edit.section, edit.paragraph)
        if para is None:
            errors.append(
                PreconditionError(
                    edit=edit.locator(),
                    kind="P5",
                    section=edit.section,
                    paragraph=edit.paragraph,
                    reason=f"section {edit.section} paragraph {edit.paragraph} does not exist in source",
                    suggestion="verify the [¶S.P] marker in the prepared source view",
                )
            )
            continue
        occurrences = _all_occurrences(para.text, edit.find)
        # P1: find must occur at least once.
        if not occurrences:
            errors.append(
                PreconditionError(
                    edit=edit.locator(),
                    kind="P1",
                    section=edit.section,
                    paragraph=edit.paragraph,
                    reason="find text not present in target paragraph",
                    suggestion=(
                        "copy the find span verbatim from the [¶S.P] view, "
                        "including punctuation and case"
                    ),
                )
            )
            continue
        if edit.occurrence is None:
            # P2: must be unique.
            if len(occurrences) > 1:
                errors.append(
                    PreconditionError(
                        edit=edit.locator(),
                        kind="P2",
                        section=edit.section,
                        paragraph=edit.paragraph,
                        reason=(
                            f"ambiguous find ({len(occurrences)} matches); "
                            f"extend the find span to make it unique, or add "
                            f"occurrence=N (1-indexed)"
                        ),
                        suggestion="prefer extending the find span over occurrence=N",
                    )
                )
                continue
            start = occurrences[0]
        else:
            # P3: occurrence in range AND total occurrences <= MAX_OCCURRENCE.
            if len(occurrences) > MAX_OCCURRENCE:
                errors.append(
                    PreconditionError(
                        edit=edit.locator(),
                        kind="P3",
                        section=edit.section,
                        paragraph=edit.paragraph,
                        reason=(
                            f"find span appears {len(occurrences)} times in "
                            f"paragraph (> {MAX_OCCURRENCE}); LLM likely "
                            f"miscounted — extend the find span instead"
                        ),
                        suggestion="extend the find span; do not use occurrence on highly repeated tokens",
                    )
                )
                continue
            if edit.occurrence < 1 or edit.occurrence > len(occurrences):
                errors.append(
                    PreconditionError(
                        edit=edit.locator(),
                        kind="P3",
                        section=edit.section,
                        paragraph=edit.paragraph,
                        reason=(
                            f"occurrence={edit.occurrence} out of range "
                            f"(1..{len(occurrences)})"
                        ),
                        suggestion="recount occurrences from the prepared source view",
                    )
                )
                continue
            start = occurrences[edit.occurrence - 1]
        edit.find_start = start
        edit.find_end = start + len(edit.find)

    # P4: no two inlines in the same paragraph have overlapping find ranges.
    by_para: dict[tuple[int, int], list[InlineEdit]] = {}
    for edit in manifest.inlines:
        if edit.find_start < 0:
            continue  # already errored
        by_para.setdefault((edit.section, edit.paragraph), []).append(edit)
    for (section, paragraph), edits in by_para.items():
        edits_sorted = sorted(edits, key=lambda e: e.find_start)
        for prev, cur in zip(edits_sorted, edits_sorted[1:]):
            if cur.find_start < prev.find_end:
                errors.append(
                    PreconditionError(
                        edit=cur.locator(),
                        kind="P4",
                        section=section,
                        paragraph=paragraph,
                        reason=(
                            f"overlaps with previous inline at offset "
                            f"[{prev.find_start},{prev.find_end}); this "
                            f"inline starts at {cur.find_start}"
                        ),
                        suggestion="restructure so spans are disjoint or properly nested via <replace>",
                    )
                )

    # P5: wrap and insert section/paragraph indices reference existing locations.
    for wrap in manifest.wraps:
        section_obj = _find_section(tree, wrap.section)
        if section_obj is None:
            errors.append(
                PreconditionError(
                    edit=wrap.locator(),
                    kind="P5",
                    section=wrap.section,
                    paragraph=None,
                    reason=f"section {wrap.section} does not exist",
                    suggestion="check section indices in the prepared source view",
                )
            )
            continue
        max_p = len(section_obj.paragraphs)
        if wrap.from_para < 1 or wrap.from_para > max_p:
            errors.append(
                PreconditionError(
                    edit=wrap.locator(),
                    kind="P5",
                    section=wrap.section,
                    paragraph=wrap.from_para,
                    reason=f"wrap from={wrap.from_para} out of range (1..{max_p})",
                    suggestion="check paragraph indices",
                )
            )
            continue
        if wrap.to_para < wrap.from_para or wrap.to_para > max_p:
            errors.append(
                PreconditionError(
                    edit=wrap.locator(),
                    kind="P5",
                    section=wrap.section,
                    paragraph=wrap.to_para,
                    reason=f"wrap to={wrap.to_para} out of range ({wrap.from_para}..{max_p})",
                    suggestion="check paragraph indices",
                )
            )
            continue

    for insert in manifest.inserts:
        section_obj = _find_section(tree, insert.section)
        if section_obj is None:
            errors.append(
                PreconditionError(
                    edit=insert.locator(),
                    kind="P5",
                    section=insert.section,
                    paragraph=None,
                    reason=f"section {insert.section} does not exist",
                    suggestion="check section indices",
                )
            )
            continue
        max_p = len(section_obj.paragraphs)
        # `after=0` means "insert at the top of the section".
        if insert.after < 0 or insert.after > max_p:
            errors.append(
                PreconditionError(
                    edit=insert.locator(),
                    kind="P5",
                    section=insert.section,
                    paragraph=insert.after,
                    reason=f"insert after={insert.after} out of range (0..{max_p})",
                    suggestion="check paragraph indices",
                )
            )

    # P6: wraps in the same section are nested or disjoint.
    wraps_by_section: dict[int, list[WrapEdit]] = {}
    for wrap in manifest.wraps:
        wraps_by_section.setdefault(wrap.section, []).append(wrap)
    for section, wraps in wraps_by_section.items():
        for i, a in enumerate(wraps):
            for b in wraps[i + 1:]:
                a_lo, a_hi = a.from_para, a.to_para
                b_lo, b_hi = b.from_para, b.to_para
                # Nested: one fully contains the other.
                # Disjoint: ranges do not overlap at all.
                nested = (a_lo <= b_lo and b_hi <= a_hi) or (
                    b_lo <= a_lo and a_hi <= b_hi
                )
                disjoint = a_hi < b_lo or b_hi < a_lo
                if not (nested or disjoint):
                    errors.append(
                        PreconditionError(
                            edit=b.locator(),
                            kind="P6",
                            section=section,
                            paragraph=None,
                            reason=(
                                f"partially overlaps wrap §{section}"
                                f"¶{a.from_para}..{a.to_para}"
                            ),
                            suggestion="wraps must be nested or disjoint",
                        )
                    )

    # P7: no claim's <replace> content contains literal <p> or </p>.
    _claim_open_re = re.compile(r"<claim(\s|>)")
    for edit in manifest.inlines:
        if _claim_open_re.search(edit.replace_xml):
            if "<p>" in edit.replace_xml or "</p>" in edit.replace_xml:
                errors.append(
                    PreconditionError(
                        edit=edit.locator(),
                        kind="P7",
                        section=edit.section,
                        paragraph=edit.paragraph,
                        reason="<claim> replacement contains a literal <p> or </p> (claims cannot span paragraphs)",
                        suggestion="split the claim into per-paragraph claims",
                    )
                )

    # P8: no <argument> in any <replace> or <wrap> body carries an attacks="...".
    _arg_attacks_re = re.compile(r"<argument\b[^>]*\battacks\s*=")
    for edit in manifest.inlines:
        if _arg_attacks_re.search(edit.replace_xml):
            errors.append(
                PreconditionError(
                    edit=edit.locator(),
                    kind="P8",
                    section=edit.section,
                    paragraph=edit.paragraph,
                    reason="<argument> in <replace> carries an attacks attribute (spec §6.8.3)",
                    suggestion="express the attack via a <claim attacks=...>",
                )
            )
    for wrap in manifest.wraps:
        if _arg_attacks_re.search(wrap.wrapper_xml):
            errors.append(
                PreconditionError(
                    edit=wrap.locator(),
                    kind="P8",
                    section=wrap.section,
                    paragraph=None,
                    reason="<argument> in <wrap> carries an attacks attribute (spec §6.8.3)",
                    suggestion="express the attack via a <claim attacks=...>",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# Apply phase
# ---------------------------------------------------------------------------


@dataclass
class RenderedParagraph:
    """A paragraph that has been edited (or not) and may be wrapped/inserted.

    `body` is either the bare inline-edited string (no <p>...</p>) or a
    full block-level XML element (e.g. <argument>...</argument> from a
    wrap, or a free-standing <inference/> from an insert).
    """

    body: str
    is_block: bool  # True = emit as-is; False = wrap with <p>...</p>


@dataclass
class RenderedSection:
    index: int
    heading: str | None
    items: list[RenderedParagraph] = field(default_factory=list)


def _xml_escape_text(text: str) -> str:
    """Escape ``&``, ``<``, ``>`` in a literal source-text segment.

    The source markdown is treated as XML text content in the final document.
    Inline-edit XML replacements bypass this escaping; only the literal
    source bytes between (and around) edits are escaped.
    """
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _apply_inlines(
    tree: MarkdownTree, manifest: Manifest
) -> dict[tuple[int, int], str]:
    """Apply phase 1: produce the edited text for each paragraph.

    Returns: a dict mapping (section, paragraph) -> edited string.
    Paragraphs with no inline edits are NOT in the dict (use original text,
    which still needs to be XML-escaped at render time).
    """
    by_para: dict[tuple[int, int], list[InlineEdit]] = {}
    for edit in manifest.inlines:
        by_para.setdefault((edit.section, edit.paragraph), []).append(edit)

    edited: dict[tuple[int, int], str] = {}
    for key, edits in by_para.items():
        # Sort by find position (preconditions guarantee disjointness).
        edits_sorted = sorted(edits, key=lambda e: e.find_start)
        para = _find_paragraph(tree, key[0], key[1])
        assert para is not None  # checked in preconditions
        text = para.text
        out: list[str] = []
        cursor = 0
        for edit in edits_sorted:
            # Literal source between cursor and find_start: XML-escape.
            out.append(_xml_escape_text(text[cursor:edit.find_start]))
            # The replace_xml string is already valid XML; do not re-escape.
            out.append(edit.replace_xml)
            cursor = edit.find_end
        out.append(_xml_escape_text(text[cursor:]))
        edited[key] = "".join(out)

    return edited


def _render_paragraph_body(text: str) -> str:
    """Convert a (possibly inline-edited) paragraph string to ArgML inline body.

    For v1 we treat the text as-is — markdown inline syntax survives literally
    because the spec body permits ``<em>``/``<strong>``/``<code>``/``<a>``
    as presentational only, and we have no mandate to convert markdown
    italics to ``<em>`` in this layer. The converter LLM is expected to
    emit HTML-like inline tags in <replace> bodies when desired.
    """
    return text


class _IndexTracker:
    """Call-scoped bookkeeping for wrap/insert resolution.

    For each rendered section, holds a parallel list mapping item position →
    the set of ORIGINAL source paragraph indices that item covers. Built
    lazily on first access for a section, then mutated as wraps collapse
    paragraph ranges into blocks and inserts add new items.

    Scoped to a single ``_build_rendered_sections`` call. Keyed by
    ``id(section)`` is safe because sections live for the lifetime of the
    call frame — no cross-invocation aliasing.
    """

    def __init__(self) -> None:
        self._sets: dict[int, list[set[int]]] = {}

    def ensure(self, sec: RenderedSection) -> list[set[int]]:
        sets = self._sets.get(id(sec))
        if sets is None or len(sets) != len(sec.items):
            # On first build, each item covers exactly one paragraph index
            # corresponding to its 1-indexed position.
            sets = [{i + 1} for i, _ in enumerate(sec.items)]
            self._sets[id(sec)] = sets
        return sets

    def item_indices(self, sec: RenderedSection) -> list[set[int]]:
        return self.ensure(sec)

    def replace_collapsed(
        self, sec: RenderedSection, pos: int, idx_set: set[int]
    ) -> None:
        """Resync after items [lo..hi] were collapsed to a single block at ``pos``
        covering ``idx_set``."""
        sets = self.ensure(sec)
        if len(sets) == len(sec.items):
            return
        new_sets: list[set[int]] = []
        old_i = 0
        for new_i in range(len(sec.items)):
            if new_i == pos:
                new_sets.append(idx_set)
                while old_i < len(sets) and sets[old_i].issubset(idx_set):
                    old_i += 1
            elif old_i < len(sets):
                new_sets.append(sets[old_i])
                old_i += 1
            else:
                new_sets.append(set())
        self._sets[id(sec)] = new_sets

    def insert(self, sec: RenderedSection, pos: int, idx_set: set[int]) -> None:
        """Resync after a new item was inserted at ``pos`` covering ``idx_set``."""
        sets = self.ensure(sec)
        if len(sets) == len(sec.items):
            return
        new_sets = sets[:pos] + [idx_set] + sets[pos:]
        if len(new_sets) > len(sec.items):
            new_sets = new_sets[: len(sec.items)]
        while len(new_sets) < len(sec.items):
            new_sets.append(set())
        self._sets[id(sec)] = new_sets

    def paragraph_map(self, sec: RenderedSection) -> list[int]:
        """Linearized list mapping item position → min original paragraph index.

        Used to locate a wrap's from_para / to_para in ``sec.items``.
        """
        return [min(s) if s else -1 for s in self.ensure(sec)]


def _build_rendered_sections(
    tree: MarkdownTree, manifest: Manifest, inline_edits: dict[tuple[int, int], str]
) -> list[RenderedSection]:
    """Apply phases 2 and 3 and assemble rendered sections."""
    # Start with one RenderedParagraph per source paragraph.
    rendered: list[RenderedSection] = []
    for section in tree.sections:
        items: list[RenderedParagraph] = []
        for para in section.paragraphs:
            if (section.index, para.index) in inline_edits:
                body = inline_edits[(section.index, para.index)]
            else:
                # No edits — escape the raw source for XML body text.
                body = _xml_escape_text(para.text)
            items.append(RenderedParagraph(body=_render_paragraph_body(body), is_block=False))
        rendered.append(
            RenderedSection(
                index=section.index, heading=section.heading, items=items
            )
        )

    # Per-call bookkeeping for wrap/insert resolution. Scoped to this frame —
    # no module state, no cross-invocation aliasing, no manual cleanup.
    tracker = _IndexTracker()

    # Phase 2 (wraps): apply inner-first (smallest range first) so inner wraps
    # don't get swallowed by their enclosing wrap.
    wraps_sorted = sorted(
        manifest.wraps, key=lambda w: (w.to_para - w.from_para, w.section, w.from_para)
    )
    for wrap in wraps_sorted:
        sec = next((s for s in rendered if s.index == wrap.section), None)
        if sec is None:
            continue  # already errored in preconditions
        # Locate the paragraph items at positions from_para..to_para (1-indexed
        # over the ORIGINAL source paragraphs). A prior inner wrap may already
        # have collapsed some paragraphs in this section, so we resolve through
        # the tracker's parallel index sets rather than raw item indices.
        idx_map = tracker.paragraph_map(sec)
        try:
            lo = idx_map.index(wrap.from_para)
            hi = idx_map.index(wrap.to_para)
        except ValueError:
            # An inner wrap may have already collapsed this range — the
            # original indices may not be in idx_map. Find by inclusive scan.
            lo = None
            hi = None
            for i, indices in enumerate(tracker.item_indices(sec)):
                if wrap.from_para in indices and lo is None:
                    lo = i
                if wrap.to_para in indices:
                    hi = i
            if lo is None or hi is None:
                continue  # leave as-is (precondition should have caught)
        # Build the concatenated body of items [lo..hi]: each item is
        # either a bare paragraph (needs to be wrapped with <p>) or a block.
        inner_parts: list[str] = []
        for item in sec.items[lo : hi + 1]:
            if item.is_block:
                inner_parts.append(item.body)
            else:
                inner_parts.append(f"<p>{item.body}</p>")
        # Join with a blank line so that after _strip_tags + normalize,
        # the wrapped paragraphs remain separated by blank lines (matching
        # the source's paragraph spacing). Single-newline joining would
        # collapse paragraphs into adjacent lines and break round-trip.
        inner_xml = "\n\n".join(inner_parts)
        # Substitute the <wrapped-content/> placeholder in the wrapper.
        wrapped = _substitute_wrapped_content(wrap.wrapper_xml, inner_xml)
        # Replace items lo..hi with a single block entry.
        block_item = RenderedParagraph(body=wrapped, is_block=True)
        sec.items = sec.items[:lo] + [block_item] + sec.items[hi + 1:]
        # Track the collapsed range so future wraps can resolve.
        tracker.replace_collapsed(sec, lo, set(range(wrap.from_para, wrap.to_para + 1)))

    # Phase 3 (inserts): append block after the given paragraph.
    # We re-resolve paragraph -> item index through the same tracker.
    # Insertions don't combine, so order within a section follows source order
    # of the `after` value, and ties keep manifest order.
    inserts_by_section: dict[int, list[InsertEdit]] = {}
    for ins in manifest.inserts:
        inserts_by_section.setdefault(ins.section, []).append(ins)
    for section, inserts in inserts_by_section.items():
        sec = next((s for s in rendered if s.index == section), None)
        if sec is None:
            continue
        # Process in reverse order so later inserts don't shift earlier indices.
        ordered = sorted(inserts, key=lambda i: i.after, reverse=True)
        for ins in ordered:
            if ins.after == 0:
                insert_at = 0
            else:
                # Find the item whose index_set contains `after`.
                pos = None
                for i, indices in enumerate(tracker.item_indices(sec)):
                    if ins.after in indices:
                        pos = i + 1
                        break
                if pos is None:
                    continue
                insert_at = pos
            block_item = RenderedParagraph(body=ins.block_xml, is_block=True)
            sec.items.insert(insert_at, block_item)
            tracker.insert(sec, insert_at, set())

    return rendered


_WRAPPED_CONTENT_RE = re.compile(r"<wrapped-content\s*/>|<wrapped-content\s*></wrapped-content\s*>")


def _substitute_wrapped_content(wrapper_xml: str, inner_xml: str) -> str:
    """Replace the <wrapped-content/> placeholder in `wrapper_xml`."""
    if not _WRAPPED_CONTENT_RE.search(wrapper_xml):
        # No placeholder — the wrap is a no-op wrapper that ignores its
        # inner content? Plan says the placeholder is required. Fall back
        # to appending inner_xml before the wrapper's closing tag.
        # But fail loudly:
        raise ValueError(
            "<wrap> body does not contain a <wrapped-content/> placeholder"
        )
    return _WRAPPED_CONTENT_RE.sub(lambda _m: inner_xml, wrapper_xml, count=1)


# ---------------------------------------------------------------------------
# Document assembly
# ---------------------------------------------------------------------------


def assemble_body(rendered: list[RenderedSection]) -> str:
    """Build the ``<body>...</body>`` content (without the wrapper tags)."""
    parts: list[str] = []
    for sec in rendered:
        section_parts: list[str] = []
        if sec.heading is not None:
            section_parts.append(f"  <heading>{_escape_text(sec.heading)}</heading>")
        for item in sec.items:
            if item.is_block:
                section_parts.append(_indent(item.body, "  "))
            else:
                section_parts.append(f"  <p>{item.body}</p>")
        if sec.heading is not None:
            parts.append(
                "<section>\n" + "\n\n".join(section_parts) + "\n</section>"
            )
        else:
            parts.append("\n\n".join(section_parts))
    return "\n\n".join(p for p in parts if p)


def _indent(text: str, prefix: str) -> str:
    return "\n".join(prefix + line if line else line for line in text.splitlines())


def _escape_text(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def assemble_document(manifest: Manifest, body_xml: str) -> str:
    """Wrap the head + body into the final ``<post>`` document."""
    today = dt.date.today().isoformat()
    # Indent <head> and <body> by 2 spaces for pretty-print.
    head_indented = _indent(manifest.head_xml, "  ")
    body_block = "  <body>\n" + _indent(body_xml, "    ") + "\n  </body>"
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<!-- Generated by argml-converter skill on {today} '
        f'against ArgML spec v0.2. Draft — review before use. -->\n'
        f'<post xmlns="{ARGML_NS}">\n'
        f"{head_indented}\n"
        f"{body_block}\n"
        f"</post>\n"
    )


# ---------------------------------------------------------------------------
# Postconditions
# ---------------------------------------------------------------------------


@dataclass
class PostconditionError:
    kind: str  # "Q1".."Q4"
    reason: str
    detail: str = ""


_TAG_RE = re.compile(r"<[^>]+>")


def _strip_tags(xml: str) -> str:
    """Strip every XML tag from a string, leaving text content + entities."""
    out = _TAG_RE.sub("", xml)
    # Unescape entities.
    out = (
        out.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
    )
    return out


_ID_ATTR_RE = re.compile(r'\bid="([^"]*)"')
_REF_ATTR_RE = re.compile(
    r'(?:^|\s)(ref|supports|attacks|from|to|rests-on|via|same-as)="([^"]*)"'
)
_RESTATED_CLAIM_RE = re.compile(
    r'<claim\b[^>]*\bmode="restated"[^>]*>', re.DOTALL
)
_SAME_AS_RE = re.compile(r'\bsame-as=')
_IMPORT_PREFIX_RE = re.compile(r'<import\b[^>]*\bprefix="([^"]*)"')


def check_postconditions(
    final_doc: str, source_body_text: str
) -> list[PostconditionError]:
    """Verify the 4 postconditions on the assembled document.

    Args:
        final_doc: the full assembled XML document.
        source_body_text: the source markdown body, used for the round-trip
            comparison.
    """
    errors: list[PostconditionError] = []

    # Q1: strip-tags round-trip on <body>.
    body_match = re.search(r"<body>(.*?)</body>", final_doc, re.DOTALL)
    if not body_match:
        errors.append(
            PostconditionError(
                kind="Q1",
                reason="assembled document has no <body> element",
            )
        )
    else:
        body_inner = body_match.group(1)
        stripped = _strip_tags(body_inner)
        # Normalize both sides: collapse runs of blank lines, strip trailing
        # whitespace on each line.
        norm_stripped = _normalize_for_roundtrip(stripped)
        norm_source = _normalize_for_roundtrip(source_body_text)
        if norm_stripped != norm_source:
            import difflib

            diff = "".join(
                difflib.unified_diff(
                    norm_source.splitlines(keepends=True),
                    norm_stripped.splitlines(keepends=True),
                    fromfile="source",
                    tofile="stripped-body",
                    n=2,
                )
            )
            errors.append(
                PostconditionError(
                    kind="Q1",
                    reason="strip-tags round-trip mismatch",
                    detail=diff[:4000],
                )
            )

    # Q2: id uniqueness.
    ids = _ID_ATTR_RE.findall(final_doc)
    seen: dict[str, int] = {}
    for id_ in ids:
        seen[id_] = seen.get(id_, 0) + 1
    dupes = [k for k, v in seen.items() if v > 1]
    if dupes:
        errors.append(
            PostconditionError(
                kind="Q2",
                reason=f"duplicate id values: {sorted(dupes)}",
            )
        )

    # Q3: ref resolution.
    declared_ids = set(ids)
    prefixes = set(_IMPORT_PREFIX_RE.findall(final_doc))
    unresolved: list[tuple[str, str]] = []
    for attr_name, value in _REF_ATTR_RE.findall(final_doc):
        for token in value.split():
            if ":" in token:
                prefix = token.split(":", 1)[0]
                if prefix in prefixes:
                    continue
                # Allow URL-style schemes that are not declared imports
                # (e.g., absolute URLs in `source` aren't covered by the
                # refs we scan, but be lenient here for `http(s):`).
                if prefix in ("http", "https", "urn"):
                    continue
                unresolved.append((attr_name, token))
            else:
                if token not in declared_ids:
                    unresolved.append((attr_name, token))
    if unresolved:
        errors.append(
            PostconditionError(
                kind="Q3",
                reason=f"unresolved references: {unresolved[:20]}"
                + ("…" if len(unresolved) > 20 else ""),
            )
        )

    # Q4: every <claim mode="restated"> carries same-as.
    for m in _RESTATED_CLAIM_RE.finditer(final_doc):
        tag = m.group(0)
        if not _SAME_AS_RE.search(tag):
            errors.append(
                PostconditionError(
                    kind="Q4",
                    reason=f"claim mode=\"restated\" missing same-as: {tag[:120]}",
                )
            )

    return errors


def _normalize_for_roundtrip(text: str) -> str:
    """Normalize ONLY paragraph/section line endings.

    Pretty-printing adds indentation around block elements; when we strip
    the tags, those indents leak in as leading whitespace on otherwise-
    identical paragraph text. We strip leading/trailing whitespace per line
    and collapse runs of 2+ blank lines to a single blank line. This is
    safe because Markdown paragraphs don't carry meaningful leading
    whitespace (code blocks are not in our body output; code fences are
    rendered as paragraph text and survive).
    """
    # Strip per-line whitespace.
    lines = [line.strip() for line in text.splitlines()]
    # Collapse runs of blank lines to a single blank.
    collapsed: list[str] = []
    prev_blank = False
    for line in lines:
        if line == "":
            if prev_blank:
                continue
            prev_blank = True
        else:
            prev_blank = False
        collapsed.append(line)
    # Strip leading/trailing blanks.
    while collapsed and collapsed[0] == "":
        collapsed.pop(0)
    while collapsed and collapsed[-1] == "":
        collapsed.pop()
    return "\n".join(collapsed) + "\n"


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def _report_preconditions(errors: list[PreconditionError]) -> None:
    payload = {
        "errors": [
            {
                "edit": e.edit,
                "kind": e.kind,
                "section": e.section,
                "paragraph": e.paragraph,
                "reason": e.reason,
                "suggestion": e.suggestion,
            }
            for e in errors
        ]
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False), file=sys.stderr)


def _report_postconditions(errors: list[PostconditionError]) -> None:
    payload = {
        "errors": [
            {"kind": e.kind, "reason": e.reason, "detail": e.detail}
            for e in errors
        ]
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False), file=sys.stderr)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="apply_manifest.py",
        description=(
            "Apply an ArgML manifest to a Markdown source. Produces a "
            "<post xmlns=\"urn:argml:v1\"> document by substituting the "
            "manifest's edits into the source. Source fidelity is enforced "
            "constructively (the engine never asks the LLM to reproduce "
            "unannotated prose) and validated via a strip-tags round-trip."
        ),
    )
    parser.add_argument("--manifest", required=True, help="Path to the manifest XML.")
    parser.add_argument("--source", required=True, help="Path to the Markdown source (raw or paragraph-numbered view).")
    parser.add_argument("--output", default=None, help="Path to write the output XML. Default: stdout.")
    parser.add_argument("--debug", action="store_true", help="Emit intermediate state to stderr.")

    args = parser.parse_args(argv)

    try:
        manifest = parse_manifest(Path(args.manifest))
    except (OSError, ValueError) as e:
        print(f"apply_manifest: manifest error: {e}", file=sys.stderr)
        return 3

    try:
        raw = Path(args.source).read_text(encoding="utf-8")
    except OSError as e:
        print(f"apply_manifest: source error: {e}", file=sys.stderr)
        return 3

    source_markdown = _strip_paragraph_prefixes(raw)
    tree = parse_markdown(source_markdown)

    if args.debug:
        print(
            f"[debug] parsed {len(tree.sections)} sections, "
            f"{sum(len(s.paragraphs) for s in tree.sections)} paragraphs",
            file=sys.stderr,
        )
        print(
            f"[debug] manifest: {len(manifest.inlines)} inlines, "
            f"{len(manifest.wraps)} wraps, {len(manifest.inserts)} inserts",
            file=sys.stderr,
        )

    pre_errors = check_preconditions(manifest, tree)
    if pre_errors:
        _report_preconditions(pre_errors)
        return 1

    inline_edits = _apply_inlines(tree, manifest)
    if args.debug:
        for key, val in inline_edits.items():
            print(f"[debug] inline-edited §{key[0]}¶{key[1]}: {val[:80]!r}…", file=sys.stderr)

    rendered = _build_rendered_sections(tree, manifest, inline_edits)

    body_xml = assemble_body(rendered)
    if args.debug:
        print(f"[debug] body assembled, {len(body_xml)} chars", file=sys.stderr)

    final_doc = assemble_document(manifest, body_xml)

    post_errors = check_postconditions(final_doc, tree.to_source_text())
    if post_errors:
        _report_postconditions(post_errors)
        return 2

    if args.output:
        try:
            Path(args.output).write_text(final_doc, encoding="utf-8")
        except OSError as e:
            print(f"apply_manifest: write error: {e}", file=sys.stderr)
            return 3
    else:
        sys.stdout.write(final_doc)

    return 0


if __name__ == "__main__":
    sys.exit(main())
