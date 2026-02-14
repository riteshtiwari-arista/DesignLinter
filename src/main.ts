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

      case "NOTIFY":
        figma.notify(msg.message);
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

async function applyFix(findingId: string, nodeId: string, fixPayload: FixPayload) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found");
  }

  switch (fixPayload.type) {
    case "bind-variable":
      await applyVariableBinding(node as SceneNode, fixPayload);
      break;

    case "apply-paint-style":
      await applyPaintStyle(node as SceneNode, fixPayload);
      break;

    case "apply-text-style":
      await applyTextStyle(node as TextNode, fixPayload);
      break;

    case "update-spacing":
      await updateSpacing(node as FrameNode, fixPayload);
      break;

    case "update-padding":
      await updatePadding(node as FrameNode, fixPayload);
      break;

    case "update-border-radius":
      await updateBorderRadius(node as SceneNode, fixPayload);
      break;

    case "create-frame":
      await createAnnotationFrame(node as SceneNode, fixPayload);
      break;
  }

  figma.ui.postMessage({ type: "FIX_APPLIED", findingId, nodeId });
  figma.notify("Fix applied successfully");
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
  if (!payload.styleId || !payload.property) return;

  if (payload.property === "fills" && "fillStyleId" in node) {
    node.fillStyleId = payload.styleId;
  } else if (payload.property === "strokes" && "strokeStyleId" in node) {
    node.strokeStyleId = payload.styleId;
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
