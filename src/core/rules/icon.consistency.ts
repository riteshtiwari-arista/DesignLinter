import type { Finding } from "../types";
import { getPageName } from "../scanner";

// Standard icon sizes
const STANDARD_ICON_SIZES = [12, 16, 20, 24, 32, 40, 48, 64];

function isLikelyIcon(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  return (
    name.includes("icon") ||
    name.includes("ico") ||
    name.startsWith("ic_") ||
    name.startsWith("icon/") ||
    name.startsWith("icons/")
  );
}

function isStandardIconSize(width: number, height: number): boolean {
  // Icon should be square or nearly square
  if (Math.abs(width - height) > 2) return false;

  // Should match a standard size
  const size = Math.round(width);
  return STANDARD_ICON_SIZES.includes(size);
}

function getNearestStandardSize(width: number, height: number): number {
  const avgSize = (width + height) / 2;
  return STANDARD_ICON_SIZES.reduce((prev, curr) =>
    Math.abs(curr - avgSize) < Math.abs(prev - avgSize) ? curr : prev
  );
}

function isSquare(width: number, height: number): boolean {
  return Math.abs(width - height) <= 2; // Allow 2px tolerance
}

export async function checkIconConsistency(
  nodes: SceneNode[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    // Only check frames and components that look like icons
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "INSTANCE") continue;
    if (!isLikelyIcon(node)) continue;

    const width = node.width;
    const height = node.height;

    // Check if icon is square
    if (!isSquare(width, height)) {
      findings.push({
        id: `${node.id}-icon-not-square`,
        principle: "Clarity",
        severity: "warn",
        ruleId: "icon.aspect-ratio",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: `Icon is not square: ${Math.round(width)}x${Math.round(height)}px`,
        howToFix: "Icons should be square. Check if the icon is stretched or distorted.",
        canAutoFix: false
      });
      continue;
    }

    // Check if using standard icon size
    if (!isStandardIconSize(width, height)) {
      const nearest = getNearestStandardSize(width, height);
      findings.push({
        id: `${node.id}-icon-size`,
        principle: "Clarity",
        severity: "info",
        ruleId: "icon.size",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: `Icon size ${Math.round(width)}px not using standard icon size`,
        howToFix: `Change to ${nearest}x${nearest}px (standard icon size)`,
        canAutoFix: false
      });
    }
  }

  return findings;
}
