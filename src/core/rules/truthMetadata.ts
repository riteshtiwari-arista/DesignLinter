import type { Finding } from "../types";
import { getPageName } from "../scanner";

function hasInsightsOrCharts(nodes: SceneNode[]): boolean {
  // Check node names for insight/AI keywords
  const hasInsightNames = nodes.some(node =>
    /insight|anomaly|recommendation|ai|ml|prediction|forecast|alert|metric|kpi|analytics|dashboard/i.test(node.name)
  );

  // Check text content for insight/AI keywords
  const hasInsightText = nodes.some(node => {
    if (node.type !== "TEXT") return false;
    const text = "characters" in node ? node.characters.toLowerCase() : "";
    return /insight|anomaly|detected|recommendation|ai suggests|predicted|forecast/i.test(text);
  });

  // Check for charts/visualizations
  const hasVisualizations = nodes.some(node =>
    /chart|graph|plot|visualization|viz|dashboard/i.test(node.name)
  );

  return hasInsightNames || hasInsightText || hasVisualizations;
}

function findTruthTags(nodes: SceneNode[], truthTags: string[]): Set<string> {
  const foundTags = new Set<string>();

  for (const node of nodes) {
    // Check for Data Context frame
    if ((node.type === "FRAME" || node.type === "STICKY") && node.name === "Data Context") {
      // Assume this frame documents data context
      truthTags.forEach(tag => foundTags.add(tag));
      continue;
    }

    // Check text nodes for tags
    if (node.type === "TEXT") {
      const text = "characters" in node ? node.characters : "";
      for (const tag of truthTags) {
        if (text.includes(tag)) {
          foundTags.add(tag);
        }
      }
    }
  }

  return foundTags;
}

export async function checkTruthMetadata(
  nodes: SceneNode[],
  truthTags: string[]
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
    if (!hasInsightsOrCharts(pageNodes)) continue;

    const foundTags = findTruthTags(pageNodes, truthTags);
    const missingTags = truthTags.filter(tag => !foundTags.has(tag));

    if (missingTags.length > 0) {
      findings.push({
        id: `${pageName}-truth-metadata`,
        principle: "Truth",
        severity: "info",
        ruleId: "truthMetadata",
        nodeId: pageNodes[0].id,
        nodeName: pageName,
        pageName,
        message: `Page requires data context documentation (found ${foundTags.size}/${truthTags.length} tags)`,
        howToFix: `Add missing truth tags: ${missingTags.join(", ")}`,
        canAutoFix: true,
        fixPayload: {
          type: "create-frame",
          frameData: {
            name: "Data Context",
            text: missingTags
          }
        }
      });
    }
  }

  return findings;
}
