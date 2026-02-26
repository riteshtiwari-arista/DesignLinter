import type { Finding, Severity, Settings } from "../types";
import { getPageName } from "../scanner";
import { matchColor, matchPaintStyle, importVariableByKey, getCatalog, type DSVarRef, type DSStyleRef } from "../dsCatalog";

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

function isEffectiveVisiblePaint(paint: Paint, settings: Settings): boolean {
  if (paint.type !== "SOLID") return false;

  // Hidden via eye icon
  if (settings.ignoreHiddenFills && paint.visible === false) return false;

  // Opacity slider
  if (settings.ignoreZeroOpacity && paint.opacity !== undefined && paint.opacity === 0) return false;

  // Transparent color
  if (settings.ignoreTransparentColors && "color" in paint && paint.color.a === 0) return false;

  return true;
}

export async function checkColorTokens(
  nodes: SceneNode[],
  settings: Settings
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const severity: Severity = settings.strictness === "strict" ? "warn" : "info";

  // Reset lookup counter for debugging
  (globalThis as any).__colorLookupCount = 0;

  // Get catalog to check against library paint styles
  const catalog = getCatalog();

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

        // Skip if not effective/visible
        if (!isEffectiveVisiblePaint(fill, settings)) {
          continue;
        }

        if (fill.type !== "SOLID") continue;

        // A) Check for explicit variable binding
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const fillColorAlias = nodeBoundVars?.fills?.[i];
        if (fillColorAlias) continue; // Explicitly bound - skip

        // B) Check if using paint style (any style = compliant)
        const fillStyleId = "fillStyleId" in node ? node.fillStyleId : null;

        if (checkedFills <= 5) {
          console.log(`[PAINT STYLE CHECK] Node "${node.name}"`);
          console.log(`  fillStyleId:`, fillStyleId);
          console.log(`  isMixed:`, fillStyleId === figma.mixed);
          console.log(`  isEmpty:`, fillStyleId === "");
          console.log(`  Will skip:`, !!(fillStyleId && fillStyleId !== figma.mixed && fillStyleId !== ""));
        }

        if (fillStyleId && fillStyleId !== figma.mixed && fillStyleId !== "") {
          if (checkedFills <= 5) {
            console.log(`  -> SKIPPED (has paint style)`);
          }
          continue; // Using paint style - skip
        }

        // C) Check catalog for value match (variables or paint styles)
        const fillColor: RGBA = Object.assign({}, fill.color, { a: fill.opacity ?? 1 });
        checkedFills++;

        // First try variables
        const varMatches = matchColor(fillColor);

        // Then try paint styles
        const styleMatches = matchPaintStyle(fillColor);

        if (varMatches && varMatches.length > 0) {
          // Value matches a DS variable - import it lazily
          foundMatches++;
          const varRef = varMatches[0];

          if (checkedFills <= 3) {
            console.log(`Fill ${checkedFills}: Found variable match for ${node.name} -> ${varRef.variableName}`);
          }

          const variable = await importVariableByKey(varRef.variableKey);

          if (variable) {
            successfulImports++;
            if (checkedFills <= 3) {
              console.log(`  Successfully imported variable: ${variable.name} (ID: ${variable.id})`);
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
              console.log(`  Failed to import variable: ${varRef.variableName}`);
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
        } else if (styleMatches && styleMatches.length > 0) {
          // Value matches a DS paint style - suggest using the style
          const styleRef = styleMatches[0];

          if (checkedFills <= 3) {
            console.log(`Fill ${checkedFills}: Found paint style match for ${node.name} -> ${styleRef.styleName}`);
          }

          findings.push({
            id: `${node.id}-fill-color`,
            principle: "Clarity",
            severity,
            ruleId: "tokens.colors.fill",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Fill color matches DS paint style but style not applied",
            howToFix: `Apply paint style: ${styleRef.styleName}`,
            canAutoFix: true,
            fixPayload: {
              type: "apply-paint-style",
              styleKey: styleRef.styleKey,
              property: "fills",
              styleName: styleRef.styleName,
              libraryName: styleRef.libraryName
            }
          });
        } else {
          // NOT_DS - no match found - FLAG AS ERROR (block)
          findings.push({
            id: `${node.id}-fill-color`,
            principle: "Clarity",
            severity: "block",
            ruleId: "tokens.colors.fill",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Color not in design system",
            howToFix: `This color (R:${Math.round(fillColor.r*255)} G:${Math.round(fillColor.g*255)} B:${Math.round(fillColor.b*255)}) is not defined in the design system. Use an existing DS variable or add it to the design system.`,
            canAutoFix: false
          });
        }
      }
    }

    // Check strokes
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (let i = 0; i < node.strokes.length; i++) {
        const stroke = node.strokes[i];

        // Skip if not effective/visible
        if (!isEffectiveVisiblePaint(stroke, settings)) {
          continue;
        }

        if (stroke.type !== "SOLID") continue;

        // A) Check for explicit variable binding
        const nodeBoundVars = "boundVariables" in node ? (node as any).boundVariables : null;
        const strokeColorAlias = nodeBoundVars?.strokes?.[i];
        if (strokeColorAlias) continue; // Explicitly bound - skip

        // B) Check if using paint style (any style = compliant)
        const strokeStyleId = "strokeStyleId" in node ? node.strokeStyleId : null;
        if (strokeStyleId && strokeStyleId !== figma.mixed && strokeStyleId !== "") {
          continue; // Using paint style - skip
        }

        // C) Check catalog for value match (variables or paint styles)
        const strokeColor: RGBA = Object.assign({}, stroke.color, { a: stroke.opacity ?? 1 });

        // First try variables
        const varMatches = matchColor(strokeColor);

        // Then try paint styles
        const styleMatches = matchPaintStyle(strokeColor);

        if (varMatches && varMatches.length > 0) {
          // Value matches a DS variable - import it lazily
          foundMatches++;
          const varRef = varMatches[0];
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
        } else if (styleMatches && styleMatches.length > 0) {
          // Value matches a DS paint style - suggest using the style
          const styleRef = styleMatches[0];

          findings.push({
            id: `${node.id}-stroke-color`,
            principle: "Clarity",
            severity,
            ruleId: "tokens.colors.stroke",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Stroke color matches DS paint style but style not applied",
            howToFix: `Apply paint style: ${styleRef.styleName}`,
            canAutoFix: true,
            fixPayload: {
              type: "apply-paint-style",
              styleKey: styleRef.styleKey,
              property: "strokes",
              styleName: styleRef.styleName,
              libraryName: styleRef.libraryName
            }
          });
        } else {
          // NOT_DS - no match found - FLAG AS ERROR (block)
          findings.push({
            id: `${node.id}-stroke-color`,
            principle: "Clarity",
            severity: "block",
            ruleId: "tokens.colors.stroke",
            nodeId: node.id,
            nodeName: node.name,
            pageName: getPageName(node),
            message: "Color not in design system",
            howToFix: `This stroke color (R:${Math.round(strokeColor.r*255)} G:${Math.round(strokeColor.g*255)} B:${Math.round(strokeColor.b*255)}) is not defined in the design system. Use an existing DS variable or add it to the design system.`,
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
