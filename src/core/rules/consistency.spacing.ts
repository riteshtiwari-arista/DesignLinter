import type { Finding } from "../types";
import { getPageName } from "../scanner";

// Common spacing scales
const COMMON_SCALES = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

function isCommonSpacing(value: number): boolean {
  return COMMON_SCALES.includes(value);
}

function getNearestCommonValue(value: number): number {
  return COMMON_SCALES.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

export async function checkSpacingConsistency(
  nodes: SceneNode[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    if (node.type !== "FRAME") continue;
    if (!("layoutMode" in node)) continue;
    if (node.layoutMode === "NONE") continue;

    // Check item spacing (gap) in auto-layout
    if ("itemSpacing" in node) {
      const spacing = node.itemSpacing;
      if (spacing > 0 && !isCommonSpacing(spacing)) {
        const nearest = getNearestCommonValue(spacing);

        findings.push({
          id: `${node.id}-spacing`,
          principle: "Clarity",
          severity: "info",
          ruleId: "consistency.spacing",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: `Auto-layout gap (${spacing}px) not using common spacing scale`,
          howToFix: `Change to ${nearest}px (common spacing value)`,
          canAutoFix: true,
          fixPayload: { type: "update-spacing", property: "itemSpacing", value: nearest }
        });
      }
    }

    // Check padding
    if ("paddingLeft" in node && "paddingTop" in node) {
      const paddings = [
        node.paddingLeft,
        node.paddingRight,
        node.paddingTop,
        node.paddingBottom
      ];

      const unusualPaddings = paddings.filter(p => p > 0 && !isCommonSpacing(p));

      if (unusualPaddings.length > 0) {
        const examplePadding = unusualPaddings[0];
        const nearest = getNearestCommonValue(examplePadding);

        findings.push({
          id: `${node.id}-padding`,
          principle: "Clarity",
          severity: "info",
          ruleId: "consistency.padding",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: `Padding (${examplePadding}px) not using common spacing scale`,
          howToFix: `Change to ${nearest}px (common spacing value)`,
          canAutoFix: true,
          fixPayload: { type: "update-padding", value: nearest }
        });
      }
    }
  }

  return findings;
}
