import type { Finding, Severity } from "../types";
import { getPageName } from "../scanner";

function textPropertiesMatch(node: TextNode, style: TextStyle): boolean {
  const nodeFont = node.fontName !== figma.mixed ? node.fontName : null;
  const styleFont = style.fontName;

  if (!nodeFont) return false;

  const fontMatch = nodeFont.family === styleFont.family && nodeFont.style === styleFont.style;
  const sizeMatch = node.fontSize === style.fontSize;
  const lineHeightMatch = JSON.stringify(node.lineHeight) === JSON.stringify(style.lineHeight);
  const letterSpacingMatch = JSON.stringify(node.letterSpacing) === JSON.stringify(style.letterSpacing);

  return fontMatch && sizeMatch && lineHeightMatch && letterSpacingMatch;
}

export async function checkTypographyTokens(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict",
  dsLibraryKey?: string
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const severity: Severity = strictness === "strict" ? "warn" : "info";

  let textStyles: TextStyle[] = figma.getLocalTextStyles();

  if (dsLibraryKey) {
    textStyles = textStyles.filter(s => {
      if (!s.key) return false;
      return s.key.startsWith(dsLibraryKey) || s.name.includes(dsLibraryKey);
    });
  }

  for (const node of nodes) {
    if (node.type !== "TEXT") continue;

    // Check if using text style (explicit binding)
    if (node.textStyleId) continue;

    // Check if typography properties are bound to variables (explicit binding)
    const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
    const hasBoundTypography =
      nodeBoundVars?.fontSize ||
      nodeBoundVars?.lineHeight ||
      nodeBoundVars?.letterSpacing ||
      nodeBoundVars?.fontFamily ||
      nodeBoundVars?.fontStyle;

    if (hasBoundTypography) continue;

    // Check inferredVariables (value matches even if not bound)
    const nodeInferredVars = "inferredVariables" in node ? (node as any).inferredVariables : null;
    const hasInferredTypography =
      nodeInferredVars?.fontSize ||
      nodeInferredVars?.lineHeight ||
      nodeInferredVars?.letterSpacing ||
      nodeInferredVars?.fontFamily ||
      nodeInferredVars?.fontStyle;

    if (hasInferredTypography) continue;

    // Look for matching text style for autofix
    const matchingStyle = textStyles.find(style => textPropertiesMatch(node, style));

    findings.push({
      id: `${node.id}-typography`,
      principle: "Clarity",
      severity,
      ruleId: "tokens.typography",
      nodeId: node.id,
      nodeName: node.name,
      pageName: getPageName(node),
      message: "Text not using design system typography style",
      howToFix: matchingStyle
        ? `Apply text style: ${matchingStyle.name}`
        : "Apply a design system text style",
      canAutoFix: !!matchingStyle,
      fixPayload: matchingStyle
        ? { type: "apply-text-style", styleId: matchingStyle.id }
        : undefined
    });
  }

  return findings;
}
