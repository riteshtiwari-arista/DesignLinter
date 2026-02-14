import type { Finding, Severity } from "../types";
import { getPageName } from "../scanner";

function rgbaEqual(a: RGBA, b: RGBA): boolean {
  return (
    Math.abs(a.r - b.r) < 0.001 &&
    Math.abs(a.g - b.g) < 0.001 &&
    Math.abs(a.b - b.b) < 0.001 &&
    Math.abs(a.a - b.a) < 0.001
  );
}

// Calculate color distance (Euclidean distance in RGB space)
function colorDistance(a: RGBA, b: RGBA): number {
  const dr = (a.r - b.r) * 255;
  const dg = (a.g - b.g) * 255;
  const db = (a.b - b.b) * 255;
  const da = (a.a - b.a) * 100;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

// Find closest matching color variable
function findClosestVariable(targetColor: RGBA, variables: Variable[]): { variable: Variable; distance: number } | null {
  let closest: Variable | null = null;
  let minDistance = Infinity;

  for (const v of variables) {
    if (v.resolvedType !== "COLOR") continue;
    const value = Object.values(v.valuesByMode)[0] as RGBA;
    const dist = colorDistance(targetColor, value);
    if (dist < minDistance) {
      minDistance = dist;
      closest = v;
    }
  }

  return closest ? { variable: closest, distance: minDistance } : null;
}

// Find closest matching paint style
function findClosestPaintStyle(targetColor: RGBA, styles: PaintStyle[]): { style: PaintStyle; distance: number } | null {
  let closest: PaintStyle | null = null;
  let minDistance = Infinity;

  for (const s of styles) {
    const stylePaint = s.paints[0];
    if (!stylePaint || stylePaint.type !== "SOLID") continue;
    const styleColor: RGBA = Object.assign({}, stylePaint.color, { a: stylePaint.opacity ?? 1 });
    const dist = colorDistance(targetColor, styleColor);
    if (dist < minDistance) {
      minDistance = dist;
      closest = s;
    }
  }

  return closest ? { style: closest, distance: minDistance } : null;
}

function hasFillOrStroke(node: SceneNode): node is SceneNode & MinimalFillsMixin {
  return "fills" in node || "strokes" in node;
}

export async function checkColorTokens(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict",
  dsLibraryKey?: string
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const severity: Severity = strictness === "strict" ? "warn" : "info";

  // Get available variables and paint styles
  let variables: Variable[] = [];
  let paintStyles: PaintStyle[] = [];

  try {
    // Collect all variable IDs from nodes (using boundVariables AND inferredVariables)
    console.log("Collecting variables from nodes...");
    const variableIds = new Set<string>();

    for (const node of nodes) {
      if (!hasFillOrStroke(node)) continue;

      const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
      const nodeInferredVars = "inferredVariables" in node ? (node as any).inferredVariables : null;

      // Collect from boundVariables (explicit bindings)
      if (nodeBoundVars) {
        // Fill bindings
        if (nodeBoundVars.fills && Array.isArray(nodeBoundVars.fills)) {
          for (const alias of nodeBoundVars.fills) {
            if (alias?.id) variableIds.add(alias.id);
          }
        }
        // Stroke bindings
        if (nodeBoundVars.strokes && Array.isArray(nodeBoundVars.strokes)) {
          for (const alias of nodeBoundVars.strokes) {
            if (alias?.id) variableIds.add(alias.id);
          }
        }
      }

      // Collect from inferredVariables (value matches)
      if (nodeInferredVars) {
        // Fill inferred variables
        if (nodeInferredVars.fills && Array.isArray(nodeInferredVars.fills)) {
          for (const candidates of nodeInferredVars.fills) {
            if (candidates && Array.isArray(candidates)) {
              for (const varId of candidates) {
                if (typeof varId === "string") {
                  variableIds.add(varId);
                } else if (varId?.id) {
                  variableIds.add(varId.id);
                }
              }
            }
          }
        }
        // Stroke inferred variables
        if (nodeInferredVars.strokes && Array.isArray(nodeInferredVars.strokes)) {
          for (const candidates of nodeInferredVars.strokes) {
            if (candidates && Array.isArray(candidates)) {
              for (const varId of candidates) {
                if (typeof varId === "string") {
                  variableIds.add(varId);
                } else if (varId?.id) {
                  variableIds.add(varId.id);
                }
              }
            }
          }
        }
      }
    }

    console.log(`Found ${variableIds.size} unique variable IDs from nodes`);

    // Load all collected variables
    for (const id of variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable && variable.resolvedType === "COLOR") {
          variables.push(variable);
        }
      } catch (err) {
        console.warn(`Could not load variable ${id}:`, err);
      }
    }

    // Get paint styles
    paintStyles = figma.getLocalPaintStyles();

    console.log(`Loaded ${variables.length} color variables, ${paintStyles.length} paint styles`);

    if (variables.length > 0) {
      console.log('Sample variables:', variables.slice(0, 5).map(v => ({
        name: v.name,
        type: v.resolvedType
      })));
    }
  } catch (error) {
    console.error("Failed to load variables/styles:", error);
  }

  for (const node of nodes) {
    if (!hasFillOrStroke(node)) continue;

    // Check fills
    if ("fills" in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      for (let i = 0; i < node.fills.length; i++) {
        const fill = node.fills[i];
        if (fill.type !== "SOLID") continue;

        // A) Check for node-level variable binding (fill color bound to variable)
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const fillColorAlias = nodeBoundVars?.fills?.[i];
        if (fillColorAlias) continue; // Explicitly bound to variable

        // B) Check inferredVariables (value matches a variable even if not bound)
        const nodeInferredVars = "inferredVariables" in node ? (node as any).inferredVariables : null;
        const fillInferredCandidates = nodeInferredVars?.fills?.[i];
        if (fillInferredCandidates && Array.isArray(fillInferredCandidates) && fillInferredCandidates.length > 0) {
          continue; // Value matches a variable (inferred)
        }

        // C) Check if using fill style (and if that style is variable-driven)
        const fillStyleId = "fillStyleId" in node ? node.fillStyleId : null;
        if (fillStyleId && typeof fillStyleId === "string") {
          const style = paintStyles.find(s => s.id === fillStyleId);
          if (style) {
            // Check if the style itself uses a variable
            const styleColorAliases = style.boundVariables?.paints;
            if (styleColorAliases && Array.isArray(styleColorAliases) && styleColorAliases.length > 0) {
              continue; // Style is variable-driven
            }
            continue; // Using DS fill style (even if not variable-driven)
          }
        }

        // Not bound and not using DS style - check for closest match
        const fillColor: RGBA = Object.assign({}, fill.color, { a: fill.opacity ?? 1 });

        // Try exact match first
        let matchingVar = variables.find(v => {
          if (v.resolvedType !== "COLOR") return false;
          const value = Object.values(v.valuesByMode)[0] as RGBA;
          return rgbaEqual(fillColor, value);
        });

        let matchingStyle = paintStyles.find(s => {
          const stylePaint = s.paints[0];
          if (!stylePaint || stylePaint.type !== "SOLID") return false;
          const styleColor: RGBA = Object.assign({}, stylePaint.color, { a: stylePaint.opacity ?? 1 });
          return rgbaEqual(fillColor, styleColor);
        });

        let isExactMatch = !!(matchingVar || matchingStyle);
        let distance = 0;

        // If no exact match, find closest match (within reasonable threshold)
        if (!matchingVar && !matchingStyle) {
          const closestVar = findClosestVariable(fillColor, variables);
          const closestStyle = findClosestPaintStyle(fillColor, paintStyles);

          // Use closest match if distance is reasonable (< 50 means pretty close)
          const THRESHOLD = 50;

          if (closestVar && closestVar.distance < THRESHOLD) {
            if (!closestStyle || closestVar.distance <= closestStyle.distance) {
              matchingVar = closestVar.variable;
              distance = closestVar.distance;
            }
          }

          if (closestStyle && closestStyle.distance < THRESHOLD) {
            if (!closestVar || closestStyle.distance < closestVar.distance) {
              matchingStyle = closestStyle.style;
              distance = closestStyle.distance;
            }
          }
        }

        const canAutoFix = !!(matchingVar || matchingStyle);
        const howToFix = matchingVar
          ? isExactMatch
            ? `Bind to variable: ${matchingVar.name}`
            : `Bind to closest variable: ${matchingVar.name} (${Math.round(distance)} difference)`
          : matchingStyle
          ? isExactMatch
            ? `Apply paint style: ${matchingStyle.name}`
            : `Apply closest paint style: ${matchingStyle.name} (${Math.round(distance)} difference)`
          : `No matching DS color found. Add this color (R:${Math.round(fillColor.r*255)} G:${Math.round(fillColor.g*255)} B:${Math.round(fillColor.b*255)}) to your design system.`;

        findings.push({
          id: `${node.id}-fill-color`,
          principle: "Clarity",
          severity,
          ruleId: "tokens.colors.fill",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: "Fill color not bound to design system token",
          howToFix,
          canAutoFix,
          fixPayload: matchingVar
            ? { type: "bind-variable", variableId: matchingVar.id, property: "fills" }
            : matchingStyle
            ? { type: "apply-paint-style", styleId: matchingStyle.id, property: "fills" }
            : undefined
        });
      }
    }

    // Check strokes
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (let i = 0; i < node.strokes.length; i++) {
        const stroke = node.strokes[i];
        if (stroke.type !== "SOLID") continue;

        // A) Check for node-level variable binding (stroke color bound to variable)
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const strokeColorAlias = nodeBoundVars?.strokes?.[i];
        if (strokeColorAlias) continue; // Explicitly bound to variable

        // B) Check inferredVariables (value matches a variable even if not bound)
        const nodeInferredVars = "inferredVariables" in node ? (node as any).inferredVariables : null;
        const strokeInferredCandidates = nodeInferredVars?.strokes?.[i];
        if (strokeInferredCandidates && Array.isArray(strokeInferredCandidates) && strokeInferredCandidates.length > 0) {
          continue; // Value matches a variable (inferred)
        }

        // C) Check if using stroke style (and if that style is variable-driven)
        const strokeStyleId = "strokeStyleId" in node ? node.strokeStyleId : null;
        if (strokeStyleId && typeof strokeStyleId === "string") {
          const style = paintStyles.find(s => s.id === strokeStyleId);
          if (style) {
            // Check if the style itself uses a variable
            const styleColorAliases = style.boundVariables?.paints;
            if (styleColorAliases && Array.isArray(styleColorAliases) && styleColorAliases.length > 0) {
              continue; // Style is variable-driven
            }
            continue; // Using DS stroke style (even if not variable-driven)
          }
        }

        const strokeColor: RGBA = Object.assign({}, stroke.color, { a: stroke.opacity ?? 1 });

        // Try exact match first
        let matchingVar = variables.find(v => {
          if (v.resolvedType !== "COLOR") return false;
          const value = Object.values(v.valuesByMode)[0] as RGBA;
          return rgbaEqual(strokeColor, value);
        });

        let matchingStyle = paintStyles.find(s => {
          const stylePaint = s.paints[0];
          if (!stylePaint || stylePaint.type !== "SOLID") return false;
          const styleColor: RGBA = Object.assign({}, stylePaint.color, { a: stylePaint.opacity ?? 1 });
          return rgbaEqual(strokeColor, styleColor);
        });

        let isExactMatch = !!(matchingVar || matchingStyle);
        let distance = 0;

        // If no exact match, find closest match
        if (!matchingVar && !matchingStyle) {
          const closestVar = findClosestVariable(strokeColor, variables);
          const closestStyle = findClosestPaintStyle(strokeColor, paintStyles);

          const THRESHOLD = 50;

          if (closestVar && closestVar.distance < THRESHOLD) {
            if (!closestStyle || closestVar.distance <= closestStyle.distance) {
              matchingVar = closestVar.variable;
              distance = closestVar.distance;
            }
          }

          if (closestStyle && closestStyle.distance < THRESHOLD) {
            if (!closestVar || closestStyle.distance < closestVar.distance) {
              matchingStyle = closestStyle.style;
              distance = closestStyle.distance;
            }
          }
        }

        const canAutoFix = !!(matchingVar || matchingStyle);
        const howToFix = matchingVar
          ? isExactMatch
            ? `Bind to variable: ${matchingVar.name}`
            : `Bind to closest variable: ${matchingVar.name} (${Math.round(distance)} difference)`
          : matchingStyle
          ? isExactMatch
            ? `Apply paint style: ${matchingStyle.name}`
            : `Apply closest paint style: ${matchingStyle.name} (${Math.round(distance)} difference)`
          : `No matching DS color found`;

        findings.push({
          id: `${node.id}-stroke-color`,
          principle: "Clarity",
          severity,
          ruleId: "tokens.colors.stroke",
          nodeId: node.id,
          nodeName: node.name,
          pageName: getPageName(node),
          message: "Stroke color not bound to design system token",
          howToFix,
          canAutoFix,
          fixPayload: matchingVar
            ? { type: "bind-variable", variableId: matchingVar.id, property: "strokes" }
            : matchingStyle
            ? { type: "apply-paint-style", styleId: matchingStyle.id, property: "strokes" }
            : undefined
        });
      }
    }
  }

  return findings;
}
