export const ARGML_STYLES = `
:root {
  --argml-bg: #fdfdfb;
  --argml-fg: #1a1a1a;
  --argml-muted: #5a5a5a;
  --argml-rule: #d8d8d2;
  --argml-term-color: #1f5d8b;
  --argml-term-underline: rgba(31, 93, 139, 0.55);
  --argml-claim-color: #6a4a7e;
  --argml-claim-bg: rgba(106, 74, 126, 0.06);
  --argml-inference-color: #2c6f4d;
  --argml-inference-bg: rgba(44, 111, 77, 0.06);
  --argml-conflict-color: #a83232;
  --argml-conflict-bg: rgba(168, 50, 50, 0.06);
  --argml-banner-bg: #f4efe2;
  --argml-banner-fg: #4a3f1d;
  --argml-tooltip-bg: #222;
  --argml-tooltip-fg: #f8f8f8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --argml-bg: #161616;
    --argml-fg: #e9e9e9;
    --argml-muted: #a0a0a0;
    --argml-rule: #333;
    --argml-term-color: #8ec5ee;
    --argml-term-underline: rgba(142, 197, 238, 0.55);
    --argml-claim-color: #c8a8d8;
    --argml-claim-bg: rgba(200, 168, 216, 0.07);
    --argml-inference-color: #8acca8;
    --argml-inference-bg: rgba(138, 204, 168, 0.07);
    --argml-conflict-color: #e08585;
    --argml-conflict-bg: rgba(224, 133, 133, 0.07);
    --argml-banner-bg: #2a2515;
    --argml-banner-fg: #e8dca9;
    --argml-tooltip-bg: #f8f8f8;
    --argml-tooltip-fg: #161616;
  }
}

* { box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 17px;
  line-height: 1.6;
  color: var(--argml-fg);
  background: var(--argml-bg);
  margin: 0;
  padding: 0 1rem 4rem;
}

.argml-page {
  max-width: 42rem;
  margin: 0 auto;
}

.argml-epistemic-status {
  margin: 1.5rem 0 2rem;
  padding: 0.85rem 1rem;
  background: var(--argml-banner-bg);
  color: var(--argml-banner-fg);
  border-left: 4px solid currentColor;
  font-style: italic;
  font-size: 0.95em;
  white-space: pre-line;
}

.argml-doc-header {
  margin: 1.5rem 0 2rem;
}
.argml-title {
  margin: 0 0 0.4rem;
  font-size: 2em;
  line-height: 1.2;
}
.argml-byline {
  color: var(--argml-muted);
  font-size: 0.9em;
}
.argml-byline a { color: inherit; }

.argml-section { margin-top: 2rem; }
.argml-section h2 { font-size: 1.5em; }
.argml-section h3 { font-size: 1.25em; }
.argml-section h4 { font-size: 1.1em; }

p { margin: 0 0 1rem; }

/* Terms */
.argml-term {
  color: var(--argml-term-color);
  text-decoration: underline dotted var(--argml-term-underline);
  text-underline-offset: 0.18em;
  cursor: help;
  position: relative;
}
.argml-term.argml-external::before {
  content: "↗";
  font-size: 0.7em;
  vertical-align: super;
  margin-right: 0.1em;
  color: var(--argml-muted);
}

/* Claims */
.argml-claim {
  background: var(--argml-claim-bg);
  border-radius: 3px;
  padding: 0 0.15em;
  position: relative;
  cursor: help;
}
.argml-claim-marker {
  display: inline-block;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.78em;
  font-weight: 600;
  color: var(--argml-claim-color);
  background: var(--argml-bg);
  border: 1px solid var(--argml-claim-color);
  border-radius: 3px;
  padding: 0 0.35em;
  margin-right: 0.3em;
  vertical-align: 0.08em;
  text-decoration: none;
}
.argml-claim-marker:hover { background: var(--argml-claim-bg); }
.argml-claim.argml-defeasible-false {
  border-bottom: 1px solid var(--argml-claim-color);
}

/* Credence and strength badges */
.argml-credence,
.argml-strength {
  display: inline-block;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.72em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.05em 0.4em;
  border-radius: 2px;
  margin: 0 0.25em;
  vertical-align: 0.1em;
  color: var(--argml-fg);
  background: var(--argml-rule);
}
.argml-credence-speculative   { background: #e9d4d4; color: #6e2a2a; }
.argml-credence-tentative     { background: #ecddc6; color: #6a4920; }
.argml-credence-considered    { background: #e3e3c8; color: #555525; }
.argml-credence-confident     { background: #cfe1c8; color: #2b5224; }
.argml-credence-near-certain  { background: #bcd7c8; color: #1f4a35; }
.argml-strength-weak          { background: #ecd9d9; color: #6e3535; }
.argml-strength-moderate      { background: #ecddc6; color: #6a4920; }
.argml-strength-strong        { background: #cfe1c8; color: #2b5224; }
.argml-strength-deductive     { background: #bcd0e1; color: #1f365a; }

@media (prefers-color-scheme: dark) {
  .argml-credence-speculative   { background: #4a2424; color: #f0c6c6; }
  .argml-credence-tentative     { background: #4a3a1c; color: #f0d7a8; }
  .argml-credence-considered    { background: #44441a; color: #e0e0a8; }
  .argml-credence-confident     { background: #2a4022; color: #c0e0b0; }
  .argml-credence-near-certain  { background: #1f4030; color: #b8d8c8; }
  .argml-strength-weak          { background: #4a2828; color: #f0c6c6; }
  .argml-strength-moderate      { background: #4a3a1c; color: #f0d7a8; }
  .argml-strength-strong        { background: #2a4022; color: #c0e0b0; }
  .argml-strength-deductive     { background: #1f2e4a; color: #b8c8e0; }
}

/* Rests-on margin badges */
.argml-rests-on {
  display: inline-block;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.72em;
  color: var(--argml-muted);
  margin-left: 0.25em;
}
.argml-rests-on a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dotted var(--argml-muted);
}

/* Inferences (block-level warrants) */
.argml-inference {
  display: block;
  margin: 1rem 0;
  padding: 0.6rem 0.85rem;
  background: var(--argml-inference-bg);
  border-left: 3px solid var(--argml-inference-color);
  border-radius: 0 3px 3px 0;
  font-size: 0.95em;
  cursor: help;
  position: relative;
}
.argml-inference.argml-defeasible-false {
  border-left-style: double;
  border-left-width: 7px;
}
.argml-inference-label {
  display: block;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.78em;
  color: var(--argml-inference-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}

/* Conflicts */
.argml-conflict {
  display: block;
  margin: 1rem 0;
  padding: 0.6rem 0.85rem;
  background: var(--argml-conflict-bg);
  border-left: 3px solid var(--argml-conflict-color);
  border-radius: 0 3px 3px 0;
  font-size: 0.95em;
}
.argml-conflict-label {
  display: block;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.78em;
  color: var(--argml-conflict-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}
.argml-conflict-attack {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.9em;
}
.argml-conflict-response { margin-top: 0.5rem; }

/* Evidence */
.argml-evidence {
  font-size: 0.8em;
  cursor: help;
}
.argml-evidence a {
  color: var(--argml-muted);
  text-decoration: none;
}
.argml-evidence a:hover { color: var(--argml-fg); }

/* Notes */
.argml-note {
  font-size: 0.9em;
  color: var(--argml-muted);
  border-bottom: 1px dotted var(--argml-muted);
  cursor: help;
}

/* Assumptions panel */
.argml-assumptions {
  margin: 2rem 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--argml-rule);
  border-radius: 3px;
  background: var(--argml-bg);
}
.argml-assumptions h2 {
  margin: 0 0 0.5rem;
  font-size: 1em;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--argml-muted);
}
.argml-assumptions ol {
  margin: 0;
  padding-left: 1.5rem;
}
.argml-assumption-id {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.85em;
  color: var(--argml-muted);
  margin-right: 0.4em;
}

/* Tooltip — pure CSS, driven by data-tooltip-summary */
[data-tooltip-summary] {
  position: relative;
}
[data-tooltip-summary]:hover::after,
[data-tooltip-summary]:focus::after {
  content: attr(data-tooltip-summary);
  position: absolute;
  left: 0;
  top: calc(100% + 0.4em);
  z-index: 10;
  min-width: 12rem;
  max-width: 24rem;
  padding: 0.55rem 0.75rem;
  background: var(--argml-tooltip-bg);
  color: var(--argml-tooltip-fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.82rem;
  font-style: normal;
  font-weight: normal;
  line-height: 1.45;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  white-space: pre-line;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

/* Print styles */
@media print {
  [data-tooltip-summary]:hover::after { display: none; }
  body { background: white; color: black; }
  .argml-claim, .argml-inference, .argml-conflict { background: transparent; }
  a { color: inherit; text-decoration: underline; }
}
`.trim();
