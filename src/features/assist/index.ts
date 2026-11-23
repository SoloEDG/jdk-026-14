export { AssistPanel } from "./ui/AssistPanel";
export {
  nextHint,
  resolveHint,
  hintTargets,
  hintMessage,
  hintScopeNote,
  HINT_LIMIT,
} from "./model/hints";
export type { HintResult, HintFailure } from "./model/hints";
export {
  inspect,
  inspectRegion,
  checkMessage,
  checkStatus,
  freshCheck,
  checkScopeLabel,
} from "./lib/inspect";
export type { CheckReport, CheckStatus } from "./lib/inspect";
