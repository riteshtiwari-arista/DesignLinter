export type Severity = "info" | "warn" | "block";

export type Principle =
  | "Clarity"
  | "Predictability"
  | "Pressure"
  | "Function"
  | "Truth"
  | "Evolution";

export interface Finding {
  id: string;
  principle: Principle;
  severity: Severity;
  ruleId: string;
  nodeId: string;
  nodeName: string;
  pageName: string;
  message: string;
  howToFix: string;
  canAutoFix: boolean;
  fixPayload?: FixPayload;
}

export interface FixPayload {
  type: "bind-variable" | "apply-paint-style" | "apply-text-style" | "create-frame";
  variableId?: string;
  styleId?: string;
  property?: string;
  frameData?: {
    name: string;
    text: string[];
  };
}

export interface Evidence {
  type: string;
  links: string[];
  summary: string;
  validationPlan?: string;
}

export interface Settings {
  theme: "light" | "dark";
  scanScope: "selection" | "page" | "all-pages";
  strictness: "relaxed" | "strict";
  dsLibraryKey?: string;
  requiredStateTags?: string[];
  truthTags?: string[];
  ignoreHiddenFills?: boolean;
  ignoreZeroOpacity?: boolean;
  ignoreTransparentColors?: boolean;
}

export interface LibraryInfo {
  key: string;
  name: string;
  collectionKeys?: string[]; // Variable collection keys from this library
}

export interface ScanResults {
  findings: Finding[];
  scannedNodes: number;
  timestamp: number;
}
