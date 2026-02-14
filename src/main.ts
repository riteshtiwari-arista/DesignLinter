import { getSettings, setSettings } from "./core/storage";
import { listEnabledLibraries } from "./core/library";
import { getScanRoots, getAllNodesToScan } from "./core/scanner";
import { loadDSCatalog, ensureDSCatalogLoaded } from "./core/dsCatalog";
import { checkColorTokens } from "./core/rules/tokens.colors";
import { checkTypographyTokens } from "./core/rules/tokens.typography";
import { checkEffectTokens } from "./core/rules/tokens.effects";
import { checkRequiredStates } from "./core/rules/requiredStates";
import { checkTruthMetadata } from "./core/rules/truthMetadata";
import { checkSpacingConsistency } from "./core/rules/consistency.spacing";
import { checkBorderRadiusConsistency } from "./core/rules/consistency.borderRadius";
import type { Finding, FixPayload } from "./core/types";

figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
  title: "Design Linter"
});

// Initialize
(async () => {
  const settings = await getSettings();
  const libraries = await listEnabledLibraries();

  console.log("Initializing plugin...");
  console.log("Found libraries:", libraries);

  // Show init progress
  figma.ui.postMessage({
    type: "INIT_PROGRESS",
    message: "Initializing plugin..."
  });

  // Load DS catalog from team libraries with progress updates
  await loadDSCatalog(
    settings.dsLibraryKey,
    (message) => {
      figma.ui.postMessage({
        type: "INIT_PROGRESS",
        message
      });
    }
  );

  figma.ui.postMessage({
    type: "INIT",
    settings,
    libraries
  });
})();

figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      case "RESIZE_UI":
        figma.ui.resize(msg.width, msg.height);
        break;

      case "SETTINGS_SAVE":
        await setSettings(msg.settings);
        figma.ui.postMessage({ type: "SETTINGS_SAVED" });
        break;

      case "REFRESH_LIBRARIES":
        const libraries = await listEnabledLibraries(true);
        figma.ui.postMessage({ type: "LIBRARIES_REFRESHED", libraries });
        break;

      case "RUN_SCAN":
        await runScan();
        break;

      case "ZOOM_TO":
        await zoomToNode(msg.nodeId);
        break;

      case "APPLY_FIX":
        await applyFix(msg.findingId, msg.nodeId, msg.fixPayload);
        break;

      case "UNDO_FIX":
        await undoFix(msg.findingId, msg.nodeId);
        break;

      case "NOTIFY":
        figma.notify(msg.message);
        break;

      case "EXTRACT_PALETTE":
        await extractPalette();
        break;

      case "CLOSE":
        figma.closePlugin();
        break;
    }
  } catch (error) {
    figma.ui.postMessage({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

async function runScan() {
  try {
    figma.ui.postMessage({ type: "SCAN_STARTED" });

    const settings = await getSettings();
    const roots = getScanRoots(settings.scanScope);

    if (roots.length === 0) {
      figma.ui.postMessage({
        type: "SCAN_COMPLETE",
        findings: [],
        scannedNodes: 0
      });
      return;
    }

    const nodes = getAllNodesToScan(roots, true);

    // Ensure DS catalog is loaded with the selected library
    await ensureDSCatalogLoaded(settings.dsLibraryKey);

    const allFindings: Finding[] = [];

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: `Collected ${nodes.length} nodes`
    });

    // Run token checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking colors..."
    });
    const colorFindings = await checkColorTokens(
      nodes,
      settings
    );
    allFindings.push(...colorFindings);

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking typography..."
    });
    const typographyFindings = await checkTypographyTokens(
      nodes,
      settings.strictness
    );
    allFindings.push(...typographyFindings);

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking effects..."
    });
    const effectFindings = await checkEffectTokens(
      nodes,
      settings.strictness
    );
    allFindings.push(...effectFindings);

    // Run annotation checks
    if (settings.requiredStateTags && settings.requiredStateTags.length > 0) {
      figma.ui.postMessage({
        type: "SCAN_PROGRESS",
        message: "Checking required states..."
      });
      const stateFindings = await checkRequiredStates(nodes, settings.requiredStateTags);
      allFindings.push(...stateFindings);
    }

    if (settings.truthTags && settings.truthTags.length > 0) {
      figma.ui.postMessage({
        type: "SCAN_PROGRESS",
        message: "Checking metadata..."
      });
      const truthFindings = await checkTruthMetadata(nodes, settings.truthTags);
      allFindings.push(...truthFindings);
    }

    // Run consistency checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking spacing consistency..."
    });
    const spacingFindings = await checkSpacingConsistency(nodes);
    allFindings.push(...spacingFindings);

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking border radius..."
    });
    const borderRadiusFindings = await checkBorderRadiusConsistency(nodes);
    allFindings.push(...borderRadiusFindings);

    figma.ui.postMessage({
      type: "SCAN_COMPLETE",
      findings: allFindings,
      scannedNodes: nodes.length
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Scan failed"
    });
  }
}

async function zoomToNode(nodeId: string) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node && "absoluteBoundingBox" in node) {
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    figma.currentPage.selection = [node as SceneNode];
  }
}

// Store original values before applying fixes (for undo)
const originalValues = new Map<string, any>();

async function applyFix(findingId: string, nodeId: string, fixPayload: FixPayload) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found");
  }

  // Store original value for undo
  let originalValue: any = null;

  switch (fixPayload.type) {
    case "bind-variable":
      // Store original paint before binding variable
      if (fixPayload.property === "fills" && "fills" in node) {
        originalValue = { type: "fills", value: JSON.parse(JSON.stringify(node.fills)) };
      } else if (fixPayload.property === "strokes" && "strokes" in node) {
        originalValue = { type: "strokes", value: JSON.parse(JSON.stringify(node.strokes)) };
      }
      await applyVariableBinding(node as SceneNode, fixPayload);
      break;

    case "apply-paint-style":
      // Store original fillStyleId or strokeStyleId
      if (fixPayload.property === "fills" && "fillStyleId" in node) {
        originalValue = { type: "fillStyleId", value: node.fillStyleId };
      } else if (fixPayload.property === "strokes" && "strokeStyleId" in node) {
        originalValue = { type: "strokeStyleId", value: node.strokeStyleId };
      }
      await applyPaintStyle(node as SceneNode, fixPayload);
      break;

    case "apply-text-style":
      originalValue = { type: "textStyleId", value: (node as TextNode).textStyleId };
      await applyTextStyle(node as TextNode, fixPayload);
      break;

    case "update-spacing":
      originalValue = { type: "itemSpacing", value: (node as FrameNode).itemSpacing };
      await updateSpacing(node as FrameNode, fixPayload);
      break;

    case "update-padding":
      originalValue = { type: "padding", value: {
        left: (node as FrameNode).paddingLeft,
        right: (node as FrameNode).paddingRight,
        top: (node as FrameNode).paddingTop,
        bottom: (node as FrameNode).paddingBottom
      }};
      await updatePadding(node as FrameNode, fixPayload);
      break;

    case "update-border-radius":
      originalValue = { type: "cornerRadius", value: (node as any).cornerRadius };
      await updateBorderRadius(node as SceneNode, fixPayload);
      break;

    case "create-frame":
      await createAnnotationFrame(node as SceneNode, fixPayload);
      break;
  }

  // Store original value for undo
  if (originalValue) {
    originalValues.set(findingId, originalValue);
  }

  figma.ui.postMessage({ type: "FIX_APPLIED", findingId, nodeId });
  figma.notify("Fix applied successfully");
}

async function undoFix(findingId: string, nodeId: string) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found");
  }

  const originalValue = originalValues.get(findingId);
  if (!originalValue) {
    console.warn(`No original value stored for finding ${findingId}`);
    figma.notify("Cannot undo - original value not found");
    return;
  }

  // Restore original value
  switch (originalValue.type) {
    case "fills":
      if ("fills" in node) {
        node.fills = originalValue.value;
      }
      break;

    case "strokes":
      if ("strokes" in node) {
        node.strokes = originalValue.value;
      }
      break;

    case "fillStyleId":
      if ("fillStyleId" in node) {
        node.fillStyleId = originalValue.value;
      }
      break;

    case "strokeStyleId":
      if ("strokeStyleId" in node) {
        node.strokeStyleId = originalValue.value;
      }
      break;

    case "textStyleId":
      (node as TextNode).textStyleId = originalValue.value;
      break;

    case "itemSpacing":
      if ("itemSpacing" in node) {
        (node as FrameNode).itemSpacing = originalValue.value;
      }
      break;

    case "padding":
      if ("paddingLeft" in node) {
        const frame = node as FrameNode;
        frame.paddingLeft = originalValue.value.left;
        frame.paddingRight = originalValue.value.right;
        frame.paddingTop = originalValue.value.top;
        frame.paddingBottom = originalValue.value.bottom;
      }
      break;

    case "cornerRadius":
      if ("cornerRadius" in node) {
        (node as any).cornerRadius = originalValue.value;
      }
      break;
  }

  // Remove from storage
  originalValues.delete(findingId);

  figma.notify("Fix undone");
}

async function applyVariableBinding(node: SceneNode, payload: FixPayload) {
  if (!payload.variableId || !payload.property) return;

  const variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  if (!variable) throw new Error("Variable not found");

  if (payload.property === "fills" && "fills" in node) {
    const fills = Array.isArray(node.fills) ? node.fills.slice() : [];
    if (fills.length > 0 && fills[0].type === "SOLID") {
      fills[0] = figma.variables.setBoundVariableForPaint(fills[0], "color", variable);
      node.fills = fills;
    }
  } else if (payload.property === "strokes" && "strokes" in node) {
    const strokes = Array.isArray(node.strokes) ? node.strokes.slice() : [];
    if (strokes.length > 0 && strokes[0].type === "SOLID") {
      strokes[0] = figma.variables.setBoundVariableForPaint(strokes[0], "color", variable);
      node.strokes = strokes;
    }
  }
}

async function applyPaintStyle(node: SceneNode, payload: FixPayload) {
  if (!payload.styleKey || !payload.property) {
    throw new Error(`Missing styleKey or property. You may need to re-extract your palette with the latest version.`);
  }

  console.log(`Importing paint style by key: ${payload.styleKey}`);

  // Import the style from the library
  const style = await figma.importStyleByKeyAsync(payload.styleKey);
  if (!style) {
    throw new Error(`Failed to import paint style: ${payload.styleName}`);
  }

  console.log(`Successfully imported style: ${style.name} (ID: ${style.id})`);

  if (payload.property === "fills" && "fillStyleId" in node) {
    console.log(`Applying to fillStyleId`);
    node.fillStyleId = style.id;
  } else if (payload.property === "strokes" && "strokeStyleId" in node) {
    console.log(`Applying to strokeStyleId`);
    node.strokeStyleId = style.id;
  }
}

async function applyTextStyle(node: TextNode, payload: FixPayload) {
  if (!payload.styleId) return;
  node.textStyleId = payload.styleId;
}

async function createAnnotationFrame(referenceNode: SceneNode, payload: FixPayload) {
  if (!payload.frameData) return;

  // Find the page
  let page = referenceNode.parent;
  while (page && page.type !== "PAGE") {
    page = page.parent;
  }

  if (!page || page.type !== "PAGE") {
    throw new Error("Could not find page");
  }

  // Create frame
  const frame = figma.createFrame();
  frame.name = payload.frameData.name;
  frame.resize(200, 100 + payload.frameData.text.length * 24);
  frame.x = 100;
  frame.y = 100;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 0.9 } }];

  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" }).catch(() =>
    figma.loadFontAsync({ family: "Arial", style: "Bold" })
  );
  title.characters = payload.frameData.name;
  title.fontSize = 14;
  title.x = 12;
  title.y = 12;
  frame.appendChild(title);

  // Add tags
  let yOffset = 40;
  for (const tag of payload.frameData.text) {
    const text = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() =>
      figma.loadFontAsync({ family: "Arial", style: "Regular" })
    );
    text.characters = `• ${tag}`;
    text.fontSize = 12;
    text.x = 12;
    text.y = yOffset;
    frame.appendChild(text);
    yOffset += 24;
  }

  page.appendChild(frame);
}

async function updateSpacing(node: FrameNode, payload: FixPayload) {
  if (!("itemSpacing" in node)) {
    throw new Error("Node does not support spacing");
  }

  if (payload.property === "itemSpacing") {
    node.itemSpacing = payload.value;
  }
}

async function updatePadding(node: FrameNode, payload: FixPayload) {
  if (!("paddingLeft" in node)) {
    throw new Error("Node does not support padding");
  }

  const value = payload.value;
  node.paddingLeft = value;
  node.paddingRight = value;
  node.paddingTop = value;
  node.paddingBottom = value;
}

async function updateBorderRadius(node: SceneNode, payload: FixPayload) {
  if (!("cornerRadius" in node)) {
    throw new Error("Node does not support border radius");
  }

  node.cornerRadius = payload.value;
}

async function extractPalette() {
  try {
    figma.ui.postMessage({ type: "EXTRACTION_STARTED" });

    const palette: any = {
      metadata: {
        extractedAt: new Date().toISOString(),
        version: "1.0.0",
        fileName: figma.root.name
      },
      paintStyles: [],
      textStyles: [],
      effectStyles: [],
      variables: {
        collections: []
      }
    };

    // Extract Paint Styles
    const paintStyles = await figma.getLocalPaintStylesAsync();
    for (const style of paintStyles) {
      const resolvedColors: Array<{ r: number; g: number; b: number; a: number }> = [];

      for (const paint of style.paints) {
        if (paint.type === "SOLID" && "color" in paint) {
          resolvedColors.push({
            r: paint.color.r,
            g: paint.color.g,
            b: paint.color.b,
            a: paint.opacity ?? 1
          });
        }
      }

      palette.paintStyles.push({
        id: style.id,
        key: style.key,
        name: style.name,
        paints: JSON.parse(JSON.stringify(style.paints)),
        resolvedColors
      });
    }

    // Extract Text Styles
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const style of textStyles) {
      palette.textStyles.push({
        id: style.id,
        name: style.name,
        fontFamily: style.fontName.family,
        fontSize: style.fontSize as number,
        fontWeight: 400,
        lineHeight: style.lineHeight as any,
        letterSpacing: style.letterSpacing as any
      });
    }

    // Extract Effect Styles
    const effectStyles = await figma.getLocalEffectStylesAsync();
    for (const style of effectStyles) {
      palette.effectStyles.push({
        id: style.id,
        name: style.name,
        effects: JSON.parse(JSON.stringify(style.effects))
      });
    }

    // Extract Variables
    const collections = figma.variables.getLocalVariableCollections();
    for (const collection of collections) {
      const variables = figma.variables.getLocalVariables().filter(
        v => v.variableCollectionId === collection.id
      );

      const collectionData: any = {
        id: collection.id,
        name: collection.name,
        modes: collection.modes.map(m => ({ modeId: m.modeId, name: m.name })),
        variables: []
      };

      for (const variable of variables) {
        const varData: any = {
          id: variable.id,
          name: variable.name,
          resolvedType: variable.resolvedType,
          valuesByMode: JSON.parse(JSON.stringify(variable.valuesByMode)),
          resolvedValues: {}
        };

        // For color variables, resolve aliases
        if (variable.resolvedType === "COLOR") {
          for (const modeId in variable.valuesByMode) {
            const value = variable.valuesByMode[modeId];

            if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
              varData.resolvedValues[modeId] = {
                r: value.r,
                g: value.g,
                b: value.b,
                a: value.a
              };
            } else if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
              const resolved = resolveAliasSync(value, modeId);
              if (resolved) {
                varData.resolvedValues[modeId] = resolved;
              }
            }
          }
        }

        collectionData.variables.push(varData);
      }

      palette.variables.collections.push(collectionData);
    }

    const json = JSON.stringify(palette, null, 2);

    figma.ui.postMessage({
      type: "EXTRACTION_COMPLETE",
      data: json,
      summary: {
        paintStyles: palette.paintStyles.length,
        textStyles: palette.textStyles.length,
        effectStyles: palette.effectStyles.length,
        variables: palette.variables.collections.reduce((sum: number, c: any) => sum + c.variables.length, 0)
      }
    });

    figma.notify(`Extracted ${palette.paintStyles.length} paint styles, ${palette.textStyles.length} text styles, ${palette.effectStyles.length} effect styles, and ${palette.variables.collections.length} variable collections.`);
  } catch (error) {
    figma.ui.postMessage({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Extraction failed"
    });
  }
}

function resolveAliasSync(value: any, modeId: string, visited = new Set<string>()): any {
  if (!value || typeof value !== 'object' || value.type !== 'VARIABLE_ALIAS') {
    return null;
  }

  const aliasId = value.id;
  if (visited.has(aliasId)) return null;
  visited.add(aliasId);

  const aliasVar = figma.variables.getVariableById(aliasId);
  if (!aliasVar) return null;

  const aliasValue = aliasVar.valuesByMode[modeId];
  if (!aliasValue) return null;

  if (typeof aliasValue === 'object' && 'r' in aliasValue && 'g' in aliasValue && 'b' in aliasValue) {
    return {
      r: aliasValue.r,
      g: aliasValue.g,
      b: aliasValue.b,
      a: aliasValue.a
    };
  }

  if (typeof aliasValue === 'object' && aliasValue.type === 'VARIABLE_ALIAS') {
    return resolveAliasSync(aliasValue, modeId, visited);
  }

  return null;
}
