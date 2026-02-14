import type { Finding } from "../types";
import { getPageName } from "../scanner";

function hasEffects(node: SceneNode): node is SceneNode & BlendMixin {
  return "effects" in node;
}

export async function checkEffectTokens(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict",
  dsLibraryKey?: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  let effectStyles: EffectStyle[] = figma.getLocalEffectStyles();

  if (dsLibraryKey) {
    effectStyles = effectStyles.filter(s => {
      if (!s.key) return false;
      return s.key.startsWith(dsLibraryKey) || s.name.includes(dsLibraryKey);
    });
  }

  for (const node of nodes) {
    if (!hasEffects(node)) continue;

    const effects = node.effects;
    if (!Array.isArray(effects) || effects.length === 0) continue;

    // Check if using effect style
    if (node.effectStyleId) continue;

    // Check if effects are bound to variables
    const hasBoundEffects = effects.some(effect => {
      return effect.boundVariables?.color ||
             effect.boundVariables?.radius ||
             effect.boundVariables?.spread ||
             effect.boundVariables?.offsetX ||
             effect.boundVariables?.offsetY;
    });

    if (hasBoundEffects) continue;

    findings.push({
      id: `${node.id}-effects`,
      principle: "Clarity",
      severity: "info",
      ruleId: "tokens.effects",
      nodeId: node.id,
      nodeName: node.name,
      pageName: getPageName(node),
      message: "Effects not using design system tokens",
      howToFix: "Apply a design system effect style or bind to effect variables",
      canAutoFix: false
    });
  }

  return findings;
}
