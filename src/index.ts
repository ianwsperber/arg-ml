export { parseArgML } from "./parser/parse.js";
export type { ParseResult } from "./parser/parse.js";
export { serializeArgML } from "./parser/serialize.js";
export type { DiagnosticSeverity, ParseDiagnostic } from "./parser/diagnostics.js";
export { validate } from "./validator/validate.js";
export type { Diagnostic } from "./validator/diagnostics.js";
export { ARGML_CODES, type DiagnosticCode } from "./validator/codes.js";
export type * from "./ast/index.js";
