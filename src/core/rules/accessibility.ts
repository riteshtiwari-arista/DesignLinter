import type { Finding } from "../types";
import { getPageName } from "../scanner";

const MIN_TEXT_SIZE = 12; // WCAG recommendation
const MIN_TOUCH_TARGET = 44; // iOS/WCAG recommendation

interface RGB {
  r: number;
  g: number;
  b: number;
}

// Calculate relative luminance
function getLuminance(color: RGB): number {
  const rsRGB = color.r;
  const gsRGB = color.g;
  const bsRGB = color.b;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
function getContrastRatio(fg: RGB, bg: RGB): number {
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// Get background color by traversing up the tree
function getBackgroundColor(node: SceneNode): RGB | null {
  let current: BaseNode | null = node.parent;

  while (current) {
    if ('fills' in current && current.fills !== figma.mixed && Array.isArray(current.fills)) {
      for (const fill of current.fills) {
        if (fill.type === "SOLID" && fill.visible !== false && 'color' in fill) {
          const opacity = fill.opacity ?? 1;
          // Only consider opaque or nearly opaque fills
          if (opacity > 0.8) {
            return fill.color;
          }
        }
      }
    }
    current = current.parent;
  }

  // Default to white background
  return { r: 1, g: 1, b: 1 };
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === "TEXT";
}

function isInteractive(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  return (
    name.includes("button") ||
    name.includes("btn") ||
    name.includes("link") ||
    name.includes("tab") ||
    name.includes("card") ||
    name.includes("item") ||
    name.includes("clickable") ||
    node.type === "INSTANCE" // Assume instances might be interactive components
  );
}

export async function checkAccessibility(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict"
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    // Check text size
    if (isTextNode(node)) {
      const fontSize = node.fontSize;

      // Handle mixed font sizes
      if (fontSize !== figma.mixed && fontSize < MIN_TEXT_SIZE) {
        findings.push({
          id: `${node.id}-text-size`,
          principle: "Clarity",
          severity: strictness === "strict" ? "warn" : "info",
          ruleId: "a11y.text-size",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: `Text size ${fontSize}px is below minimum recommended size (${MIN_TEXT_SIZE}px)`,
          howToFix: `Increase font size to at least ${MIN_TEXT_SIZE}px for better readability`,
          canAutoFix: false
        });
      }

      // Check color contrast for text
      if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
        for (const fill of node.fills) {
          if (fill.type === "SOLID" && fill.visible !== false && 'color' in fill) {
            const textColor = fill.color;
            const bgColor = getBackgroundColor(node);

            if (bgColor) {
              const contrast = getContrastRatio(textColor, bgColor);
              const isLargeText = fontSize !== figma.mixed && fontSize >= 18;

              // WCAG AA requirements: 4.5:1 for normal text, 3:1 for large text
              const requiredRatio = isLargeText ? 3 : 4.5;

              if (contrast < requiredRatio) {
                findings.push({
                  id: `${node.id}-contrast`,
                  principle: "Clarity",
                  severity: strictness === "strict" ? "warn" : "info",
                  ruleId: "a11y.contrast",
                  nodeId: node.id,
                  nodeName: node.name,
                  pageName: getPageName(node),
                  message: `Text contrast ratio ${contrast.toFixed(2)}:1 is below WCAG AA standard (${requiredRatio}:1)`,
                  howToFix: "Increase contrast between text and background colors",
                  canAutoFix: false
                });
              }
            }
          }
        }
      }
    }

    // Check touch target size for interactive elements
    if (isInteractive(node)) {
      const width = node.width;
      const height = node.height;

      if (width < MIN_TOUCH_TARGET || height < MIN_TOUCH_TARGET) {
        findings.push({
          id: `${node.id}-touch-target`,
          principle: "Function",
          severity: strictness === "strict" ? "warn" : "info",
          ruleId: "a11y.touch-target",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: `Interactive element size ${Math.round(width)}x${Math.round(height)}px is below minimum touch target (${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px)`,
          howToFix: `Increase size to at least ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px or add adequate padding`,
          canAutoFix: false
        });
      }
    }
  }

  return findings;
}
