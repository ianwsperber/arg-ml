# ADR 0003: Out-of-process inference via pgmpy

- **Status**: Accepted
- **Date**: 2026-09-08
- **Phase**: 6 (Spec ratification, ArgML Working Draft 0.3)

## Context

ADR 0002 makes every credence in an ArgML 0.3 document a computed posterior. Something has to compute it. SBBN's reference inference is pgmpy exact variable elimination, and the format's numbers should match SBBN's tool rather than approximate it.

Two repository rules constrain the answer. `CLAUDE.md` requires code in `src/` to run in both Node and the browser unless a module is explicitly marked Node-only. It also forbids new npm dependencies without justification in the PR description.

The repository already spawns Python. The manifest engine behind `argml assemble` lives in `src/cli/assemble.ts`. Its `findPython` probes `python3` and then `python`, requires version 3.9 or newer, mirrors the child's exit code, and writes into a `mkdtemp` temp directory that is cleaned up in a `finally` block. That pattern is proven and can be reused as is.

## Decision

- `argml infer` and `argml diff --posteriors` spawn a freshly written `python/infer_bn.py`. The script parses the network with the standard library XML parser and builds pgmpy `DiscreteBayesianNetwork` and `TabularCPD` objects directly. It does not use pgmpy's `XMLBIFReader`, which splits PROPERTY text on every `=` and fails on the JSON payloads SBBN stores there, since those contain `=` inside string values.
- Python discovery order is the `ARGML_PYTHON` environment variable, then `.venv/bin/python` in the repository, then `python3`, then `python`. `findPython` moves out of `assemble.ts` into a shared `src/cli/python.ts`, and `assemble` keeps its behaviour.
- `python/requirements.txt` pins `pgmpy==1.1.2`. Class names changed across pgmpy 1.x, so the pin is load-bearing.
- The TypeScript validator reimplements SBBN's five manual checks and adds DAG, table length, and relation sign checks. `argml validate` therefore never needs Python. Only inference does.
- The snapshot is exported to a standalone `bn.xml` by byte-slicing the source text from the recorded start offset of `<BIF>` to the matching `</BIF>`, then stripping ` xmlns=""` and prepending an XML declaration. fast-xml-parser 5.7.3 records only start offsets, and its builder re-escapes text, so re-serialising the parsed tree is not byte-faithful. The exported text is re-read and structurally compared against the embedded reading; a mismatch is an internal bug and throws.
- Tests that need pgmpy skip with a printed reason when it is absent. Setting `ARGML_REQUIRE_PGMPY=1` turns the skip into a failure. CI gains a job that installs pgmpy and runs the suite with that variable set.

## Consequences

**Positive**

- There is no inference code to maintain in this repository.
- The numbers match SBBN's tool exactly, because they come from the same library and the same algorithm.
- No npm dependency is added. `src/` stays browser-safe apart from the CLI modules that were already Node-only.

**Negative (accepted, with mitigations)**

- **Python, pgmpy, and pgmpy's transitive torch dependency are required for `infer`.** The install is large and slow. Mitigation: `python/README.md` documents venv setup and the torch install; `argml infer` exits with distinct codes for no Python and no pgmpy so the failure is legible; validation and diff without posteriors need none of it.
- **Each spawn costs seconds**, most of it pgmpy import time. Mitigation: all queries for one run are batched into a single spawn, and `argml diff --posteriors` spawns once per network. pgmpy's FutureWarning output is captured and shown only when the engine fails.
- **There is no browser-side recompute.** Mitigation: a future renderer must embed precomputed posteriors in its output. This is deferred work and is listed as such.
- **SBBN's repository has no license file**, so its Python cannot be vendored. Mitigation: `infer_bn.py` is original work. Its docstring credits SBBN as the reference design, and the XSD under `schema/` is freshly authored from the constraints SBBN documents.

## Alternatives considered

1. **A hand-written TypeScript variable elimination.** Rejected for 0.3. The code would be small, but it would make the format's numbers depend on a second implementation that has to agree with pgmpy to every printed decimal. It may return if a browser renderer needs live recompute.
2. **Calling SBBN's `tools/cli.py infer` from a sibling checkout.** Rejected. It couples the CLI to an unlicensed external path on the user's machine and to a text-only output format that would need scraping.

## Revisit triggers

- A browser-only deployment where shelling out is impossible.
- pgmpy dropping XMLBIF support or changing class names again, which would break the pinned script on upgrade.
- A need for soft evidence that pgmpy does not offer directly. That would require either a wrapper around Jeffrey's rule in the glue script or a different engine.
