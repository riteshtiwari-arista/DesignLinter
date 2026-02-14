import type { Finding, Severity } from "../types";
import { getPageName } from "../scanner";
import { matchColor, importVariableByKey, type DSVarRef } from "../dsCatalog";

function rgbaEqual(a: RGBA, b: RGBA): boolean {
  return (
    Math.abs(a.r - b.r) < 0.001 &&
    Math.abs(a.g - b.g) < 0.001 &&
    Math.abs(a.b - b.b) < 0.001 &&
    Math.abs(a.a - b.a) < 0.001
  );
}

function hasFillOrStroke(node: SceneNode): node is SceneNode & MinimalFillsMixin {
  return "fills" in node || "strokes" in node;
}

export async function checkColorTokens(
  nodes: SceneNode[],
  strictness: "relaxed" | "strict"
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const severity: Severity = strictness === "strict" ? "warn" : "info";

  // Reset lookup counter for debugging
  (globalThis as any).__colorLookupCount = 0;

  // Get local paint styles
  const paintStyles: PaintStyle[] = figma.getLocalPaintStyles();

  console.log(`=== Starting Color Check (${nodes.length} nodes) ===`);
  let checkedFills = 0;
  let foundMatches = 0;
  let successfulImports = 0;

  for (const node of nodes) {
    if (!hasFillOrStroke(node)) continue;

    // Check fills
    if ("fills" in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      for (let i = 0; i < node.fills.length; i++) {
        const fill = node.fills[i];
        if (fill.type !== "SOLID") continue;

        // A) Check for explicit variable binding (CONFIRMED)
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const fillColorAlias = nodeBoundVars?.fills?.[i];
        if (fillColorAlias) continue; // Explicitly bound - skip

        // B) Check if using fill style
        const fillStyleId = "fillStyleId" in node ? node.fillStyleId : null;
        if (fillStyleId && typeof fillStyleId === "string") {
          const style = paintStyles.find(s => s.id === fillStyleId);
          if (style) {
            // Check if the style itself uses a variable
            const styleColorAliases = style.boundVariables?.paints;
            if (styleColorAliases && Array.isArray(styleColorAliases) && styleColorAliases.length > 0) {
              continue; // Style is variable-driven - skip
            }
            continue; // Using DS fill style - skip
          }
        }

        // C) Check catalog for value match (MATCHES_DS)
        const fillColor: RGBA = Object.assign({}, fill.color, { a: fill.opacity ?? 1 });
        checkedFills++;
        const matches = matchColor(fillColor);

        if (matches && matches.length > 0) {
          // Value matches a DS variable - import it lazily
          foundMatches++;
          const varRef = matches[0];

          if (checkedFills <= 3) {
            console.log(`Fill ${checkedFills}: Found match for ${node.name} -> ${varRef.variableName}`);
          }

          const variable = await importVariableByKey(varRef.variableKey);

          if (variable) {
            successfulImports++;
            if (checkedFills <= 3) {
              console.log(`  ✓ Successfully imported variable: ${variable.name} (ID: ${variable.id})`);
            }

            findings.push({
              id: `${node.id}-fill-color`,
              principle: "Clarity",
              severity,
              ruleId: "tokens.colors.fill",
              nodeId: node.id,
              nodeName: node.name,
              pageName: getPageName(node),
              message: "Fill color not bound to design system token",
              howToFix: `Bind to variable: ${varRef.variableName}`,
              canAutoFix: true,
              fixPayload: { type: "bind-variable", variableId: variable.id, property: "fills", libraryName: varRef.libraryName }
            });
          } else {
            if (checkedFills <= 3) {
              console.log(`  ✗ Failed to import variable: ${varRef.variableName}`);
            }

            findings.push({
              id: `${node.id}-fill-color`,
              principle: "Clarity",
              severity,
              ruleId: "tokens.colors.fill",
              nodeId: node.id,
              nodeName: node.name,
              pageName: getPageName(node),
              message: "Fill color matches DS variable but not bound",
              howToFix: `Bind to variable: ${varRef.variableName}`,
              canAutoFix: false,
              fixPayload: { libraryName: varRef.libraryName }
            });
          }
        } else {
          // NOT_DS - no match found
          findings.push({
            id: `${node.id}-fill-color`,
            principle: "Clarity",
            severity,
            ruleId: "tokens.colors.fill",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Fill color not bound to design system token",
            howToFix: `Add this color (R:${Math.round(fillColor.r*255)} G:${Math.round(fillColor.g*255)} B:${Math.round(fillColor.b*255)}) to your design system or use an existing variable.`,
            canAutoFix: false
          });
        }
      }
    }

    // Check strokes
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (let i = 0; i < node.strokes.length; i++) {
        const stroke = node.strokes[i];
        if (stroke.type !== "SOLID") continue;

        // A) Check for explicit variable binding (CONFIRMED)
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const strokeColorAlias = nodeBoundVars?.strokes?.[i];
        if (strokeColorAlias) continue; // Explicitly bound - skip

        // B) Check if using stroke style
        const strokeStyleId = "strokeStyleId" in node ? node.strokeStyleId : null;
        if (strokeStyleId && typeof strokeStyleId === "string") {
          const style = paintStyles.find(s => s.id === strokeStyleId);
          if (style) {
            // Check if the style itself uses a variable
            const styleColorAliases = style.boundVariables?.paints;
            if (styleColorAliases && Array.isArray(styleColorAliases) && styleColorAliases.length > 0) {
              continue; // Style is variable-driven - skip
            }
            continue; // Using DS stroke style - skip
          }
        }

        // C) Check catalog for value match (MATCHES_DS)
        const strokeColor: RGBA = Object.assign({}, stroke.color, { a: stroke.opacity ?? 1 });
        const matches = matchColor(strokeColor);

        if (matches && matches.length > 0) {
          // Value matches a DS variable - import it lazily
          foundMatches++;
          const varRef = matches[0];
          const variable = await importVariableByKey(varRef.variableKey);

          if (variable) {
            successfulImports++;

            findings.push({
              id: `${node.id}-stroke-color`,
              principle: "Clarity",
              severity,
              ruleId: "tokens.colors.stroke",
              nodeId: node.id,
              nodeName: node.name,
              pageName: getPageName(node),
              message: "Stroke color not bound to design system token",
              howToFix: `Bind to variable: ${varRef.variableName}`,
              canAutoFix: true,
              fixPayload: { type: "bind-variable", variableId: variable.id, property: "strokes", libraryName: varRef.libraryName }
            });
          } else {
            findings.push({
              id: `${node.id}-stroke-color`,
              principle: "Clarity",
              severity,
              ruleId: "tokens.colors.stroke",
              nodeId: node.id,
              nodeName: node.name,
              pageName: getPageName(node),
              message: "Stroke color matches DS variable but not bound",
              howToFix: `Bind to variable: ${varRef.variableName}`,
              canAutoFix: false,
              fixPayload: { libraryName: varRef.libraryName }
            });
          }
        } else {
          // NOT_DS - no match found
          findings.push({
            id: `${node.id}-stroke-color`,
            principle: "Clarity",
            severity,
            ruleId: "tokens.colors.stroke",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Stroke color not bound to design system token",
            howToFix: `Add this color (R:${Math.round(strokeColor.r*255)} G:${Math.round(strokeColor.g*255)} B:${Math.round(strokeColor.b*255)}) to your design system or use an existing variable.`,
            canAutoFix: false
          });
        }
      }
    }
  }

  console.log(`=== Color Check Summary ===`);
  console.log(`  Checked fills/strokes: ${checkedFills}`);
  console.log(`  Found catalog matches: ${foundMatches}`);
  console.log(`  Successful imports: ${successfulImports}`);
  console.log(`  Total findings: ${findings.length}`);
  console.log(`  Auto-fixable: ${findings.filter(f => f.canAutoFix).length}`);

  return findings;
}
