import type { Finding } from "../types";
import { getPageName } from "../scanner";

function hasTablesOrCharts(nodes: SceneNode[]): boolean {
  // Heuristic 1: check if node names contain Table/Chart keywords
  const hasTableOrChartNames = nodes.some(node =>
    /table|chart|graph|data.?grid|list.?view|tree.?view|grid.?view/i.test(node.name)
  );

  // Heuristic 2: check for groups with many rows/rects (likely grids)
  const hasLargeGrids = nodes.some(node => {
    if (node.type !== "FRAME" && node.type !== "GROUP") return false;
    if (!("children" in node)) return false;

    const rectCount = node.children.filter(child =>
      child.type === "RECTANGLE" || child.type === "FRAME" || child.type === "INSTANCE"
    ).length;

    return rectCount > 15; // Lowered threshold for better detection
  });

  // Heuristic 3: check for auto-layout grids with many children
  const hasAutoLayoutGrids = nodes.some(node => {
    if (node.type !== "FRAME") return false;
    if (!("layoutMode" in node)) return false;
    if (!("children" in node)) return false;

    // Check if it has auto-layout and many children
    return node.layoutMode !== "NONE" && node.children.length > 10;
  });

  return hasTableOrChartNames || hasLargeGrids || hasAutoLayoutGrids;
}

function findStateTags(nodes: SceneNode[], requiredTags: string[]): Set<string> {
  const foundTags = new Set<string>();

  for (const node of nodes) {
    // Check for States frame
    if ((node.type === "FRAME" || node.type === "STICKY") && node.name === "States") {
      // Assume this frame documents states
      requiredTags.forEach(tag => foundTags.add(tag));
      continue;
    }

    // Check text nodes for tags
    if (node.type === "TEXT") {
      const text = "characters" in node ? node.characters : "";
      for (const tag of requiredTags) {
        if (text.includes(tag)) {
          foundTags.add(tag);
        }
      }
    }
  }

  return foundTags;
}

export async function checkRequiredStates(
  nodes: SceneNode[],
  requiredStateTags: string[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Group nodes by page
  const pageGroups = new Map<string, SceneNode[]>();
  for (const node of nodes) {
    const pageName = getPageName(node);
    const existing = pageGroups.get(pageName) || [];
    existing.push(node);
    pageGroups.set(pageName, existing);
  }

  for (const [pageName, pageNodes] of pageGroups) {
    if (!hasTablesOrCharts(pageNodes)) continue;

    const foundTags = findStateTags(pageNodes, requiredStateTags);
    const missingCount = requiredStateTags.length - foundTags.size;

    if (foundTags.size < 3) {
      const missingTags = requiredStateTags.filter(tag => !foundTags.has(tag));

      findings.push({
        id: `${pageName}-required-states`,
        principle: "Predictability",
        severity: "info",
        ruleId: "requiredStates",
        nodeId: pageNodes[0].id,
        nodeName: pageName,
        pageName,
        message: `Page requires state documentation (found ${foundTags.size}/5 states)`,
        howToFix: `Add missing state tags: ${missingTags.join(", ")}`,
        canAutoFix: true,
        fixPayload: {
          type: "create-frame",
          frameData: {
            name: "States",
            text: missingTags
          }
        }
      });
    }
  }

  return findings;
}
