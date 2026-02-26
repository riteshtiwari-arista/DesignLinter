import type { Finding } from "../types";
import { getPageName } from "../scanner";

const MAX_NESTING_DEPTH = 8;

function isFrame(node: SceneNode): node is FrameNode {
  return node.type === "FRAME";
}

function getNestingDepth(node: SceneNode): number {
  let depth = 0;
  let current: BaseNode | null = node.parent;

  while (current) {
    if (current.type === "FRAME") {
      depth++;
    }
    current = current.parent;
  }

  return depth;
}

function hasOnlyOneChild(node: FrameNode): boolean {
  return node.children.length === 1;
}

function couldUseAutoLayout(node: FrameNode): boolean {
  // Already using auto-layout
  if (node.layoutMode !== "NONE") return false;

  // No children - no benefit
  if (node.children.length === 0) return false;

  // Check if children are aligned in a way that suggests auto-layout would help
  const children = node.children;
  if (children.length < 2) return false;

  // Check for horizontal alignment
  const yPositions = children.map(child => 'y' in child ? child.y : 0);
  const allSameY = yPositions.every(y => Math.abs(y - yPositions[0]) < 5);

  // Check for vertical alignment
  const xPositions = children.map(child => 'x' in child ? child.x : 0);
  const allSameX = xPositions.every(x => Math.abs(x - xPositions[0]) < 5);

  // If children are aligned horizontally or vertically, suggest auto-layout
  return allSameY || allSameX;
}

function isRedundantWrapper(node: FrameNode): boolean {
  // Frame with only one child that is also a frame
  if (node.children.length !== 1) return false;

  const child = node.children[0];
  if (child.type !== "FRAME") return false;

  // Check if the wrapper frame has no meaningful properties
  const hasClipping = node.clipsContent;
  const hasEffects = 'effects' in node && Array.isArray(node.effects) && node.effects.length > 0;
  const hasFills = 'fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.length > 0;
  const hasStrokes = 'strokes' in node && node.strokes !== figma.mixed && Array.isArray(node.strokes) && node.strokes.length > 0;
  const hasLayoutMode = node.layoutMode !== "NONE";

  // If frame has no visual or layout properties, it might be redundant
  return !hasClipping && !hasEffects && !hasFills && !hasStrokes && !hasLayoutMode;
}

export async function checkFrameStructure(
  nodes: SceneNode[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    if (!isFrame(node)) continue;

    // Check nesting depth
    const depth = getNestingDepth(node);
    if (depth > MAX_NESTING_DEPTH) {
      findings.push({
        id: `${node.id}-nesting`,
        principle: "Function",
        severity: "warn",
        ruleId: "frame.nesting",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: `Frame is nested ${depth} levels deep - excessive nesting can hurt performance`,
        howToFix: "Consider flattening the structure or using components to reduce nesting depth",
        canAutoFix: false
      });
    }

    // Check for redundant wrappers
    if (isRedundantWrapper(node)) {
      findings.push({
        id: `${node.id}-redundant`,
        principle: "Function",
        severity: "info",
        ruleId: "frame.redundant",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Frame contains only one child frame and has no visual properties - may be redundant",
        howToFix: "Consider removing this wrapper frame if it serves no purpose",
        canAutoFix: false
      });
    }

    // Suggest auto-layout
    if (couldUseAutoLayout(node)) {
      findings.push({
        id: `${node.id}-auto-layout`,
        principle: "Evolution",
        severity: "info",
        ruleId: "frame.auto-layout",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Frame with aligned children could benefit from auto-layout",
        howToFix: "Enable auto-layout (Shift+A) to make spacing and alignment more maintainable",
        canAutoFix: false
      });
    }
  }

  return findings;
}
