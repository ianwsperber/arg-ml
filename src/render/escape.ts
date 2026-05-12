const TEXT_PATTERN = /[&<>]/g;
const ATTR_PATTERN = /[&<>"']/g;

const TEXT_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const ATTR_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeText(s: string): string {
  return s.replace(TEXT_PATTERN, (ch) => TEXT_REPLACEMENTS[ch] ?? ch);
}

export function escapeAttr(s: string): string {
  return s.replace(ATTR_PATTERN, (ch) => ATTR_REPLACEMENTS[ch] ?? ch);
}
