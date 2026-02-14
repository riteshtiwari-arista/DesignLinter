import type { Finding } from "../types";
import { getPageName } from "../scanner";

// Common border radius values
const COMMON_RADII = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 9999]; // 9999 for "pill" shapes

function isCommonRadius(value: number): boolean {
  // Allow full circles/pills (very large values)
  if (value > 100) return true;
  return COMMON_RADII.includes(value);
}

function getNearestCommonRadius(value: number): number {
  if (value > 100) return 9999; // Pill shape
  return COMMON_RADII.filter(r => r < 100).reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

function hasCornerRadius(node: SceneNode): node is SceneNode & CornerMixin {
  return "cornerRadius" in node;
}

export async function checkBorderRadiusConsistency(
  nodes: SceneNode[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    if (!hasCornerRadius(node)) continue;

    const radius = node.cornerRadius;

    // Skip if cornerRadius is a symbol (mixed values)
    if (typeof radius !== "number") continue;

    if (radius > 0 && !isCommonRadius(radius)) {
      const nearest = getNearestCommonRadius(radius);

      findings.push({
        id: `${node.id}-border-radius`,
        principle: "Clarity",
        severity: "info",
        ruleId: "consistency.borderRadius",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: `Border radius (${radius}px) not using common value`,
        howToFix: `Change to ${nearest}px (common radius value)`,
        canAutoFix: true,
        fixPayload: { type: "update-border-radius", value: nearest }
      });
    }
  }

  return findings;
}
