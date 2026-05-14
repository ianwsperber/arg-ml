---
title: ArgML Converter — Source Preparation Instructions
loaded-by: source-prep subagent dispatched from the argml-converter skill
purpose: Fetch / read the source document, normalize to clean Markdown + metadata, run prepare_source.py
---

## 1. Your job

Take the URL or local Markdown path the orchestrator hands you, fetch or read the source, extract the Markdown body and metadata (title, author, date), strip platform chrome, run `prepare_source.py` to produce a paragraph-numbered view plus a JSON metadata sidecar, and return only a structured summary (file paths, counts, notable items) to the orchestrator. Do not return raw HTML, raw Markdown body, or page chrome.

## 2. Input forms

The orchestrator will send one of:

- **URL** (LessWrong, Substack, Medium, generic blog) — fetch it.
- **Local Markdown file path** — read it directly with the Read tool.
- **Raw Markdown content pasted by the user** — write it to a temp file (`/tmp/argml-input-<slug>.md`) and treat it as a local Markdown path.

## 3. Fetching

- Prefer the **WebFetch** tool when available.
- Fall back to `curl -L --silent --max-time 30 <url>` via Bash if WebFetch is not present or returns no usable content.
- On HTTP 404 / 403 / login wall / any non-200, or on a body that's obviously a login redirect: return an error to the orchestrator with the URL and status code. Do not retry blindly. Do not silently substitute a different URL.

## 4. Body extraction

- **LessWrong**: the post body sits inside a container like `<div class="PostsPage-postContent ...">`. Use a lightweight regex-based extraction, or `html.parser` from the Python stdlib, via a short `python3 -c "..."` snippet (~30 lines). Do NOT add new dependencies — no `beautifulsoup4`, no `readability-lxml`.
- **Substack**: look for `<div class="entry-content ...">` or the `article` element.
- **Medium**: often JS-rendered; plain fetch may produce a skeleton. Best-effort.
- **Generic blogs**: prefer the page's `<article>` tag if present; otherwise fall back to the largest contiguous text block.
- **Strip**: navigation, sidebars, comments (unless the user explicitly asked for them), platform chrome, ads, footer, related-posts widgets.
- **Preserve**: post body, footnotes (both `[^N]` markers and `[^N]: text` definitions), images as Markdown `![alt](url)`, fenced code blocks, inline formatting (bold, italic, links).

If extraction yields a zero-length or obviously broken body, do not write outputs — return an error and suggest the user paste the Markdown directly.

## 5. Metadata extraction

Build a sidecar with these fields:

- `title` — from `<title>`, an `og:title` meta tag, or the page's primary `<h1>`.
- `author` — from `author` meta tags, `article:author`, byline text, or a platform marker.
- `date` — from `article:published_time`, a `datetime` attribute, or the first time-like string near the byline.
- `url` — the original URL, or `null` for local / pasted input.
- `source_kind` — one of `"lesswrong"`, `"substack"`, `"medium"`, `"generic"`, `"local"`.

If a field is missing, record `null`. Do not invent values.

## 6. Footnotes

Footnotes are part of the source. Strict source-fidelity means they survive into the prepared Markdown body unchanged:

- Inline markers (`[^N]`) stay in their original paragraph positions.
- Definitions (`[^N]: text`) stay where the source put them (usually a footnotes section at the bottom).

Do not move footnote definitions inline. The converter downstream may treat them with `<note>` annotations.

## 7. Running prepare_source.py

After body extraction is complete, derive a slug — a filesystem-safe identifier from the URL's last path segment or the local filename stem. Example: `https://lesswrong.com/posts/abc/morality-without-consciousness` → `morality-without-consciousness`.

Run:

```
python3 skills/argml-converter/scripts/prepare_source.py \
  --file <extracted-body.md> \
  --output /tmp/argml-prepared-<slug>.md \
  --metadata /tmp/argml-source-meta-<slug>.json
```

If `prepare_source.py` left any of `title` / `author` / `date` / `url` / `source_kind` as `null`, merge in your extracted values: read the JSON, fill in your fields, write back. Don't overwrite non-null values the script already set from front-matter.

## 8. Output protocol

You write exactly two files:

- `/tmp/argml-prepared-<slug>.md` — the paragraph-numbered view.
- `/tmp/argml-source-meta-<slug>.json` — the metadata sidecar.

You return to the orchestrator one structured summary message in this shape:

```
Source prepared.
- Prepared source: /tmp/argml-prepared-<slug>.md
- Metadata sidecar: /tmp/argml-source-meta-<slug>.json
- Title: ...
- Author: ...
- Date: ...
- Source kind: lesswrong | substack | medium | generic | local
- Word count: ~3200
- Section count: 7 top-level sections (4 with `##` headings + preamble + ...)
- Paragraph count: 121 paragraphs total
- Notable: 3 footnotes, 1 image, 2 code blocks (or "no special items")
```

Do NOT include the prepared Markdown body, the raw HTML, or excerpts of the prose in your reply. The orchestrator works from file paths plus this summary.

## 9. Failure handling

- **Fetch fails** (network error, 4xx, 5xx): return a brief error message with the URL and status. Do not write partial output files.
- **Body extraction fails** (zero-length result, obviously broken DOM): return an error naming the failure mode and suggest the user paste the Markdown directly. Do not write partial output files.
- **`prepare_source.py` exits non-zero**: include its stderr in your error message. Do not invent a summary.

## 10. Platform quirks

- **LessWrong**: post bodies often have nested `<div>`s; the body container is typically `PostsPage-postContent` or a near variant. Footnotes render at the bottom of the post body.
- **Substack**: entry-content container; image captions sometimes sit in sibling elements — keep them with the image.
- **Medium**: frequently requires JS to render the body; plain HTTP fetch may return only a skeleton. Note this and return what you got.
- **Generic blogs**: best-effort — `<article>` first, then the largest text block. Note in your summary if extraction was rough.
