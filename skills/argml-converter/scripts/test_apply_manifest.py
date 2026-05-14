"""Unit tests for the ArgML manifest substitution engine.

Run from repo root:

    python3 -m unittest skills.argml-converter.scripts.test_apply_manifest
    python3 -m unittest discover -s skills/argml-converter/scripts -p "test_*.py"

Tests group by behavior:
    - TestInlineEdits       — happy paths for <inline>
    - TestWrapEdits         — happy paths for <wrap>
    - TestInsertEdits       — happy paths for <insert>
    - TestPreconditions     — one test per P1..P8 failure
    - TestPostconditions    — one test per Q1..Q4 failure (plus lenient Q3s)
    - TestIntegration       — round-trip on the real MWC fixture
    - TestPrefixStripping   — [¶S.P] prefix stripping

Tests prefer the in-process Python API (parse_manifest / check_preconditions /
_apply_inlines / _build_rendered_sections / assemble_body / assemble_document /
check_postconditions). A subprocess helper (`_run_engine`) exists for the
integration test and a couple of CLI-shape checks.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

# Make sibling modules importable regardless of how unittest is invoked.
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from apply_manifest import (  # noqa: E402
    _apply_inlines,
    _build_rendered_sections,
    _strip_paragraph_prefixes,
    assemble_body,
    assemble_document,
    check_postconditions,
    check_preconditions,
    parse_manifest,
)
from markdown_tree import parse as parse_markdown  # noqa: E402


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ENGINE_SCRIPT = _HERE / "apply_manifest.py"


def _wrap_manifest(edits_xml: str, head_xml: str | None = None) -> str:
    """Wrap a snippet of <edits> into a full manifest document."""
    if head_xml is None:
        head_xml = (
            "<head>\n"
            "  <metadata><title>T</title></metadata>\n"
            "</head>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<argml-manifest xmlns="urn:argml-manifest:v1" spec-version="0.2">\n'
        f"  {head_xml}\n"
        f"  <edits>\n{edits_xml}\n  </edits>\n"
        "</argml-manifest>\n"
    )


def _build(manifest_xml: str, source_md: str):
    """Write manifest + source to a temp dir; return (manifest, tree, tmpdir).

    Caller owns the TemporaryDirectory and must keep it alive until done.
    """
    tmpdir = tempfile.TemporaryDirectory()
    manifest_path = Path(tmpdir.name) / "manifest.xml"
    source_path = Path(tmpdir.name) / "source.md"
    manifest_path.write_text(manifest_xml, encoding="utf-8")
    source_path.write_text(source_md, encoding="utf-8")
    manifest = parse_manifest(manifest_path)
    tree = parse_markdown(_strip_paragraph_prefixes(source_md))
    return manifest, tree, tmpdir, manifest_path, source_path


def _apply_full(manifest, tree):
    """End-to-end in-process application returning the assembled document."""
    inline_edits = _apply_inlines(tree, manifest)
    rendered = _build_rendered_sections(tree, manifest, inline_edits)
    body_xml = assemble_body(rendered)
    return assemble_document(manifest, body_xml)


def _run_engine(
    manifest_xml: str, source_md: str
) -> tuple[str, str, int]:
    """Invoke apply_manifest.py as a subprocess. Returns (stdout, stderr, code)."""
    with tempfile.TemporaryDirectory() as tmp:
        m = Path(tmp) / "m.xml"
        s = Path(tmp) / "s.md"
        m.write_text(manifest_xml, encoding="utf-8")
        s.write_text(source_md, encoding="utf-8")
        result = subprocess.run(
            [
                sys.executable,
                str(_ENGINE_SCRIPT),
                "--manifest",
                str(m),
                "--source",
                str(s),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.stdout, result.stderr, result.returncode


def _kinds(errors) -> list[str]:
    return [e.kind for e in errors]


# ---------------------------------------------------------------------------
# Inline-edit happy paths
# ---------------------------------------------------------------------------


class TestInlineEdits(unittest.TestCase):
    def test_inline_unique_find_applies(self):
        source = "The cat sat on the mat.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>cat</find>\n"
            '      <replace><term ref="cat">cat</term></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        self.assertIn('<term ref="cat">cat</term>', doc)
        self.assertIn("The ", doc)
        self.assertIn(" sat on the mat.", doc)

    def test_inline_with_occurrence(self):
        source = "consciousness, then consciousness again, also consciousness.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1" occurrence="2">\n'
            "      <find>consciousness</find>\n"
            '      <replace><term ref="c">consciousness</term></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        # Only the 2nd occurrence is wrapped — the 1st and 3rd stay literal.
        self.assertEqual(doc.count('<term ref="c">consciousness</term>'), 1)
        # The wrapped one must come after "consciousness, then ".
        wrapped_at = doc.find('<term ref="c">consciousness</term>')
        first_lit = doc.find("consciousness")
        self.assertLess(first_lit, wrapped_at)

    def test_multiple_inlines_same_paragraph_apply_in_find_order(self):
        # Three edits at different positions in the same paragraph.
        source = "alpha beta gamma delta epsilon.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>gamma</find>\n"
            '      <replace><term ref="g">gamma</term></replace>\n'
            "    </inline>\n"
            '    <inline section="0" paragraph="1">\n'
            "      <find>alpha</find>\n"
            '      <replace><term ref="a">alpha</term></replace>\n'
            "    </inline>\n"
            '    <inline section="0" paragraph="1">\n'
            "      <find>epsilon</find>\n"
            '      <replace><term ref="e">epsilon</term></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        # All three wrappings exist, and the literal interstitial text survives.
        self.assertIn('<term ref="a">alpha</term>', doc)
        self.assertIn('<term ref="g">gamma</term>', doc)
        self.assertIn('<term ref="e">epsilon</term>', doc)
        a = doc.find('<term ref="a">')
        g = doc.find('<term ref="g">')
        e = doc.find('<term ref="e">')
        self.assertTrue(a < g < e)
        self.assertIn(" beta ", doc)
        self.assertIn(" delta ", doc)

    def test_nested_annotation_inline(self):
        # A claim containing a nested term.
        source = "Consciousness matters morally.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>Consciousness matters morally.</find>\n"
            '      <replace><claim id="C1">'
            '<term ref="consciousness">Consciousness</term>'
            " matters morally.</claim></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        self.assertIn(
            '<claim id="C1"><term ref="consciousness">Consciousness</term>'
            " matters morally.</claim>",
            doc,
        )


# ---------------------------------------------------------------------------
# Wrap-edit happy paths
# ---------------------------------------------------------------------------


class TestWrapEdits(unittest.TestCase):
    def test_single_paragraph_wrap(self):
        source = (
            "First paragraph.\n\n"
            "Second paragraph.\n\n"
            "Third paragraph.\n"
        )
        manifest_xml = _wrap_manifest(
            '    <wrap section="0" from="2" to="2">\n'
            '      <argument mode="thought-experiment">'
            "<wrapped-content/></argument>\n"
            "    </wrap>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        self.assertIn(
            '<argument mode="thought-experiment">'
            "<p>Second paragraph.</p></argument>",
            doc,
        )
        # The other paragraphs sit outside the argument.
        self.assertIn("<p>First paragraph.</p>", doc)
        self.assertIn("<p>Third paragraph.</p>", doc)

    def test_multi_paragraph_wrap(self):
        source = (
            "Outside one.\n\n"
            "Inside two.\n\n"
            "Inside three.\n\n"
            "Inside four.\n\n"
            "Outside five.\n"
        )
        manifest_xml = _wrap_manifest(
            '    <wrap section="0" from="2" to="4">\n'
            "      <argument><wrapped-content/></argument>\n"
            "    </wrap>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        # All three paragraphs are inside the argument.
        self.assertIn("<argument>", doc)
        for needle in ("Inside two.", "Inside three.", "Inside four."):
            self.assertIn(needle, doc)
        # Adjacent paragraphs survive blank-line separated so the strip-tags
        # round-trip stays clean.
        self.assertEqual(_kinds(post_errors), [])

    def test_wrap_around_inline_edited_paragraphs(self):  # noqa: D102
        # NOTE: avoid using `## Heading` in the source for this test — the
        # engine drops `## ` markers when rendering and re-emits the section
        # via `<section><heading>...</heading></section>`. Strip-tags then
        # yields the heading text without `## `, breaking the Q1 round-trip.
        # This is a known engine quirk for sources containing markdown
        # headings; it is the reason the MWC fixture uses bolded paragraphs
        # rather than `##` for its visible section breaks. See the manifest
        # fixture's "KNOWN STRUCTURAL DIVERGENCES" comment.

        source = (
            "Lead-in paragraph.\n\n"
            "Premise about consciousness.\n\n"
            "Therefore conclusion.\n"
        )
        # Declare a <term id="consciousness"> in <head> so the inline <term
        # ref="consciousness"> resolves under Q3.
        head = (
            "<head>\n"
            "  <metadata><title>T</title></metadata>\n"
            "  <terms>\n"
            '    <term id="consciousness"><gloss>c</gloss></term>\n'
            "  </terms>\n"
            "</head>"
        )
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="2">\n'
            "      <find>consciousness</find>\n"
            '      <replace><term ref="consciousness">consciousness</term></replace>\n'
            "    </inline>\n"
            '    <inline section="0" paragraph="3">\n'
            "      <find>conclusion</find>\n"
            '      <replace><claim id="C1">conclusion</claim></replace>\n'
            "    </inline>\n"
            '    <wrap section="0" from="2" to="3">\n'
            "      <argument><wrapped-content/></argument>\n"
            "    </wrap>",
            head_xml=head,
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(post_errors), [])
        # The argument now contains already-annotated <p>s.
        self.assertIn(
            '<term ref="consciousness">consciousness</term>',
            doc,
        )
        self.assertIn('<claim id="C1">conclusion</claim>', doc)
        # The <argument> body must contain the inline-annotated <p>s. Use
        # rfind so the matcher pairs the body's <argument> with its </argument>
        # rather than the wrapper inside the manifest head (which doesn't
        # appear in the output document, but better safe).
        arg_open = doc.find("<argument>")
        arg_close = doc.find("</argument>", arg_open)
        self.assertGreaterEqual(arg_open, 0)
        self.assertGreater(arg_close, arg_open)
        inner = doc[arg_open:arg_close]
        self.assertIn('<term ref="consciousness">consciousness</term>', inner)
        self.assertIn('<claim id="C1">conclusion</claim>', inner)
        self.assertNotIn("Lead-in paragraph.", inner)


# ---------------------------------------------------------------------------
# Insert-edit happy paths
# ---------------------------------------------------------------------------


class TestInsertEdits(unittest.TestCase):
    def test_insert_after_paragraph(self):
        source = (
            "Para one with C1.\n\n"
            "Para two with C2.\n\n"
            "Para three with C3.\n\n"
            "Para four with C4.\n"
        )
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="3">\n'
            "      <find>C3</find>\n"
            '      <replace><claim id="C3">C3</claim></replace>\n'
            "    </inline>\n"
            '    <insert section="0" after="3">\n'
            '      <inference id="I1" from="C3" to="C4" />\n'
            "    </insert>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("<inference", doc)
        # The inference sits between para 3 and para 4.
        para3 = doc.find('<claim id="C3">C3</claim>')
        infer = doc.find("<inference")
        para4 = doc.find("Para four with C4.")
        self.assertTrue(para3 < infer < para4, (para3, infer, para4))

    def test_insert_after_zero(self):
        source = (
            "First.\n\n"
            "Second.\n"
        )
        manifest_xml = _wrap_manifest(
            '    <insert section="0" after="0">\n'
            '      <inference id="I0" from="X" to="Y" />\n'
            "    </insert>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            # P5 allows after=0; Q3 will fail because X/Y aren't declared, but
            # that's a postcondition concern. We only check ordering here.
            self.assertEqual(_kinds(check_preconditions(m, t)), [])
            doc = _apply_full(m, t)
        finally:
            tmp.cleanup()
        infer = doc.find("<inference")
        first = doc.find("<p>First.</p>")
        self.assertGreater(infer, 0)
        self.assertGreater(first, 0)
        self.assertLess(infer, first)


# ---------------------------------------------------------------------------
# Precondition failures (P1..P8)
# ---------------------------------------------------------------------------


class TestPreconditions(unittest.TestCase):
    def test_P1_find_text_not_in_paragraph(self):
        source = "The cat sat on the mat.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>dog</find>\n"
            "      <replace><term>dog</term></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P1"])
        self.assertIn("dog", errors[0].edit)
        self.assertEqual(errors[0].section, 0)
        self.assertEqual(errors[0].paragraph, 1)

    def test_P2_ambiguous_find_no_occurrence(self):
        source = "consciousness then consciousness later.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>consciousness</find>\n"
            '      <replace><term ref="c">consciousness</term></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P2"])

    def test_P3a_occurrence_out_of_range(self):
        # 2 occurrences; user asks for #3.
        source = "consciousness then consciousness later.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1" occurrence="3">\n'
            "      <find>consciousness</find>\n"
            "      <replace><term>c</term></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P3"])

    def test_P3b_too_many_matches_with_occurrence(self):
        # 6 occurrences of "a" with occurrence set — LLM miscount guard.
        source = "a a a a a a here.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1" occurrence="2">\n'
            "      <find>a</find>\n"
            "      <replace><term>x</term></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P3"])
        self.assertIn("miscount", errors[0].reason)

    def test_P4_overlapping_inlines(self):
        # "abcdef" — edit 1 spans "abcd", edit 2 spans "cdef" — overlap.
        source = "abcdef ghi.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>abcd</find>\n"
            "      <replace><term>1</term></replace>\n"
            "    </inline>\n"
            '    <inline section="0" paragraph="1">\n'
            "      <find>cdef</find>\n"
            "      <replace><term>2</term></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("P4", _kinds(errors))

    def test_P5_section_out_of_range(self):
        source = "One paragraph.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="9" paragraph="1">\n'
            "      <find>x</find>\n"
            "      <replace><term>x</term></replace>\n"
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P5"])

    def test_P5_paragraph_out_of_range_for_wrap(self):
        source = "Para one.\n\nPara two.\n"
        manifest_xml = _wrap_manifest(
            '    <wrap section="0" from="1" to="9">\n'
            "      <argument><wrapped-content/></argument>\n"
            "    </wrap>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertEqual(_kinds(errors), ["P5"])

    def test_P6_partially_overlapping_wraps(self):
        # wrap A: 1..3; wrap B: 2..4. Neither nested nor disjoint.
        source = (
            "Para 1.\n\n"
            "Para 2.\n\n"
            "Para 3.\n\n"
            "Para 4.\n"
        )
        manifest_xml = _wrap_manifest(
            '    <wrap section="0" from="1" to="3">\n'
            "      <argument><wrapped-content/></argument>\n"
            "    </wrap>\n"
            '    <wrap section="0" from="2" to="4">\n'
            "      <argument><wrapped-content/></argument>\n"
            "    </wrap>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("P6", _kinds(errors))

    def test_P7_claim_replace_contains_literal_p_tag(self):
        # A <claim> whose replacement embeds <p> or </p>.
        source = "Short paragraph here.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>Short paragraph here.</find>\n"
            '      <replace><claim id="C1">Short <p>nope</p> here.</claim></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("P7", _kinds(errors))

    def test_P8_argument_attacks_in_wrap(self):
        source = "First.\n\nSecond.\n"
        manifest_xml = _wrap_manifest(
            '    <wrap section="0" from="1" to="2">\n'
            '      <argument attacks="C9"><wrapped-content/></argument>\n'
            "    </wrap>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("P8", _kinds(errors))

    def test_P8_argument_attacks_in_inline_replace(self):
        source = "A short line.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>A short line.</find>\n"
            '      <replace><argument attacks="C9">A short line.</argument></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            errors = check_preconditions(m, t)
        finally:
            tmp.cleanup()
        self.assertIn("P8", _kinds(errors))


# ---------------------------------------------------------------------------
# Postcondition failures (Q1..Q4) and lenient cases
# ---------------------------------------------------------------------------


class TestPostconditions(unittest.TestCase):
    def test_Q1_strip_tags_roundtrip_failure_yields_diff(self):
        # A <replace> whose plain-text body diverges from <find>.
        # Find says "cat sat", replace says "dog sat" — strip-tags will leak
        # "dog sat" into the body where source had "cat sat".
        source = "The cat sat on the mat.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>cat sat</find>\n"
            '      <replace><term ref="bad">dog sat</term></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        kinds = _kinds(post_errors)
        self.assertIn("Q1", kinds)
        q1 = next(e for e in post_errors if e.kind == "Q1")
        self.assertTrue(q1.detail)  # diff was emitted

    def test_Q2_duplicate_ids(self):
        # Two inline edits each create a claim with id="C1".
        source = "First sentence. Second sentence.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>First sentence.</find>\n"
            '      <replace><claim id="C1">First sentence.</claim></replace>\n'
            "    </inline>\n"
            '    <inline section="0" paragraph="1">\n'
            "      <find>Second sentence.</find>\n"
            '      <replace><claim id="C1">Second sentence.</claim></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertIn("Q2", _kinds(post_errors))

    def test_Q3_undefined_reference(self):
        # supports="C99" but C99 is never declared.
        source = "A claim sentence here.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>A claim sentence here.</find>\n"
            '      <replace><claim id="C1" supports="C99">A claim sentence here.</claim></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertIn("Q3", _kinds(post_errors))

    def test_Q3_lenient_with_declared_import_prefix(self):
        # `linch:foo` resolves because <import prefix="linch" .../> is declared.
        source = "A claim sentence here.\n"
        head = (
            "<head>\n"
            "  <metadata><title>T</title></metadata>\n"
            "  <imports>\n"
            '    <import prefix="linch" doc="http://example.com/x" />\n'
            "  </imports>\n"
            "</head>"
        )
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>A claim sentence here.</find>\n"
            '      <replace><claim id="C1" same-as="linch:thesis">A claim sentence here.</claim></replace>\n'
            "    </inline>",
            head_xml=head,
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertNotIn("Q3", _kinds(post_errors))

    def test_Q3_lenient_with_url_scheme(self):
        # http:/https:/urn: prefixes are accepted without an <import>.
        source = "A claim sentence here.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>A claim sentence here.</find>\n"
            '      <replace><claim id="C1" same-as="http://example.com/page#frag">A claim sentence here.</claim></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertNotIn("Q3", _kinds(post_errors))

    def test_Q4_restated_claim_missing_same_as(self):
        source = "Some restated paragraph.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>Some restated paragraph.</find>\n"
            '      <replace><claim id="C1" mode="restated">Some restated paragraph.</claim></replace>\n'
            "    </inline>"
        )
        m, t, tmp, *_ = _build(manifest_xml, source)
        try:
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            post_errors = check_postconditions(doc, t.to_source_text())
        finally:
            tmp.cleanup()
        self.assertIn("Q4", _kinds(post_errors))


# ---------------------------------------------------------------------------
# Integration: round-trip the real MWC manifest
# ---------------------------------------------------------------------------


class TestIntegration(unittest.TestCase):
    def test_mwc_manifest_round_trips(self):
        manifest_path = (
            _REPO_ROOT
            / "examples"
            / "manifests"
            / "morality-without-consciousness.manifest.xml"
        )
        source_path = (
            _REPO_ROOT / "examples" / "consciousness-without-morality.md"
        )
        self.assertTrue(manifest_path.exists(), manifest_path)
        self.assertTrue(source_path.exists(), source_path)

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "out.argml.xml"
            result = subprocess.run(
                [
                    sys.executable,
                    str(_ENGINE_SCRIPT),
                    "--manifest",
                    str(manifest_path),
                    "--source",
                    str(source_path),
                    "--output",
                    str(out_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                f"engine exited {result.returncode}; stderr:\n{result.stderr}",
            )
            self.assertTrue(out_path.exists())
            text = out_path.read_text(encoding="utf-8")

        self.assertIn('<post xmlns="urn:argml:v1">', text)
        # Well-formed XML.
        root = ET.fromstring(text)
        # ElementTree exposes the namespaced local name on root.tag.
        self.assertEqual(root.tag, "{urn:argml:v1}post")


# ---------------------------------------------------------------------------
# Prefix stripping
# ---------------------------------------------------------------------------


class TestPrefixStripping(unittest.TestCase):
    def test_prepared_source_input(self):
        # Same logical content as a raw markdown source, but with the
        # `[¶S.P] ` prefixes the prepare_source.py tool emits. We avoid
        # `## Heading` here because the engine renders headings as
        # `<section><heading>...</heading></section>` and the resulting
        # strip-tags round-trip loses the `## ` markers (see the
        # TestWrapEdits.test_wrap_around_inline_edited_paragraphs note).
        raw = (
            "First paragraph here.\n\n"
            "Second paragraph here.\n\n"
            "Third paragraph here.\n"
        )
        prepared = (
            "[¶0.1] First paragraph here.\n\n"
            "[¶0.2] Second paragraph here.\n\n"
            "[¶0.3] Third paragraph here.\n"
        )
        # The engine treats the prepared view identically to raw.
        self.assertEqual(_strip_paragraph_prefixes(prepared), raw)

        head = (
            "<head>\n"
            "  <metadata><title>T</title></metadata>\n"
            "  <terms>\n"
            '    <term id="s"><gloss>second</gloss></term>\n'
            "  </terms>\n"
            "</head>"
        )
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="2">\n'
            "      <find>Second</find>\n"
            '      <replace><term ref="s">Second</term></replace>\n'
            "    </inline>",
            head_xml=head,
        )
        m, t, tmp, manifest_path, source_path = _build(manifest_xml, prepared)
        try:
            # In-process: same tree as the raw form.
            self.assertEqual(check_preconditions(m, t), [])
            doc = _apply_full(m, t)
            # And via subprocess: prepared view is accepted on disk too.
            stdout, stderr, code = _run_engine(manifest_xml, prepared)
        finally:
            tmp.cleanup()
        self.assertIn('<term ref="s">Second</term>', doc)
        self.assertEqual(code, 0, stderr)
        self.assertIn('<term ref="s">Second</term>', stdout)
        # No [¶S.P] markers leak into output.
        self.assertNotIn("[¶", stdout)


# ---------------------------------------------------------------------------
# CLI-shape sanity check
# ---------------------------------------------------------------------------


class TestCLIShape(unittest.TestCase):
    """A couple of subprocess-based checks confirming the exit-code contract."""

    def test_cli_success_returns_zero(self):
        source = "The cat sat on the mat.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>cat</find>\n"
            "      <replace><term>cat</term></replace>\n"
            "    </inline>"
        )
        stdout, stderr, code = _run_engine(manifest_xml, source)
        self.assertEqual(code, 0, stderr)
        self.assertIn("<term>cat</term>", stdout)

    def test_cli_precondition_failure_returns_one(self):
        source = "The cat sat on the mat.\n"
        manifest_xml = _wrap_manifest(
            '    <inline section="0" paragraph="1">\n'
            "      <find>dog</find>\n"
            "      <replace><term>dog</term></replace>\n"
            "    </inline>"
        )
        stdout, stderr, code = _run_engine(manifest_xml, source)
        self.assertEqual(code, 1)
        self.assertIn("P1", stderr)


if __name__ == "__main__":
    unittest.main()
