export { computeEquivalenceClasses, type EquivalenceClasses } from "./equivalence.js";
export {
  buildPropagationGraph,
  type PropagationGraph,
  type PropagationNode,
  type PropagationNodeKind,
} from "./graph.js";
export {
  propagate,
  type NodeStatus,
  type PropagationDiagnostic,
  type PropagationDiagnosticCode,
  type PropagationOptions,
  type PropagationResult,
  type PropagationStatus,
  type TakeawayStatus,
} from "./propagate.js";
