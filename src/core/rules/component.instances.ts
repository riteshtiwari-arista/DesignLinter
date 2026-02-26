import type { Finding } from "../types";
import { getPageName } from "../scanner";

function isInstance(node: SceneNode): node is InstanceNode {
  return node.type === "INSTANCE";
}

export async function checkComponentInstances(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict"
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    if (!isInstance(node)) continue;

    // Check if instance is detached from main component
    const mainComponent = node.mainComponent;
    if (!mainComponent) {
      findings.push({
        id: `${node.id}-detached`,
        principle: "Evolution",
        severity: strictness === "strict" ? "warn" : "info",
        ruleId: "component.detached",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Component instance is detached from main component",
        howToFix: "Re-link this instance to the design system component or use a fresh instance",
        canAutoFix: false
      });
      continue;
    }

    // Check if main component is from a library (remote)
    const isRemote = mainComponent.remote;

    // For remote components, we can't directly check version updates via API
    // but we can flag instances that have overrides which might indicate outdated usage
    if (isRemote && node.overrides && node.overrides.length > 0) {
      const hasSignificantOverrides = node.overrides.some(override => {
        // Filter out minor overrides (just text content changes are usually fine)
        return override.overriddenFields && override.overriddenFields.length > 0;
      });

      if (hasSignificantOverrides) {
        findings.push({
          id: `${node.id}-overrides`,
          principle: "Evolution",
          severity: "info",
          ruleId: "component.overrides",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: `Component instance has ${node.overrides.length} override(s) - may indicate customization or outdated usage`,
          howToFix: "Review overrides - consider using a different variant or updating to latest component version",
          canAutoFix: false
        });
      }
    }
  }

  return findings;
}
