# Gold fixture: morality-without-consciousness

This directory pairs the hand-marked ArgML produced for spec Appendix B.1 with
the source Markdown that the conversion pipeline takes as input.

## Files

| File | Origin |
|---|---|
| `expected.argml.xml` | Copy of `examples/morality-without-consciousness.argml.xml`. The hand-marked gold against which `argml eval` measures the LLM's output. |
| `source.md` | The original Markdown of [Morality without Consciousness](https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness). Not checked in; fetch it via `argml convert --allow-network https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness --output /tmp/source.md` then move it here, or paste the markdown manually. |

The eval runner skips entries that are missing either file. Add more gold
fixtures by creating `eval/gold/<slug>/{source.md, expected.argml.xml}`.

## What the eval measures

- **`validator.pass`** — does the converted document validate clean?
- **`verbatim.pass`** — does the body, with tags stripped, match the source's readable text?
- **`head.edit_distance`** — token-level Levenshtein on head metadata (term ids, aliases, assumptions, imports, takeaways) — normalized to [0, 1].
- **`body.span_f1`** — precision/recall/F1 over (element-kind, span-text) tuples in the body.
- **Conservatism counts** — terms-per-1k-words, claims-per-1k-words; lower is more conservative.
- **Coverage** — fraction of claims/inferences with credence/strength markers; coverage of hedge-language matches.
- **Cost** — USD plus input/output tokens.

Phase 5 acceptance thresholds on this fixture:

- `verbatim.pass = true`
- `validator.pass = true`
- `body.span_f1 ≥ 0.6`
- `head.edit_distance ≤ 0.3`
