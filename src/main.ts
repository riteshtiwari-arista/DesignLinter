import { getSettings, setSettings } from "./core/storage";
import { listEnabledLibraries } from "./core/library";
import { getScanRoots, getAllNodesToScan } from "./core/scanner";
import { loadDSCatalog, ensureDSCatalogLoaded } from "./core/dsCatalog";
import { detectLibraryUsage } from "./core/usageDetector";
import { checkColorTokens } from "./core/rules/tokens.colors";
import { checkTypographyTokens } from "./core/rules/tokens.typography";
import { checkEffectTokens } from "./core/rules/tokens.effects";
import { checkRequiredStates } from "./core/rules/requiredStates";
import { checkTruthMetadata } from "./core/rules/truthMetadata";
import { checkSpacingConsistency } from "./core/rules/consistency.spacing";
import { checkBorderRadiusConsistency } from "./core/rules/consistency.borderRadius";
import { checkComponentInstances } from "./core/rules/component.instances";
import { checkIconConsistency } from "./core/rules/icon.consistency";
import { checkTextContent } from "./core/rules/text.content";
import { checkFrameStructure } from "./core/rules/frame.structure";
import { checkAccessibility } from "./core/rules/accessibility";
import type { Finding, FixPayload } from "./core/types";
import { PALETTES } from "./palettes";

figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
  title: "Design Linter"
});

// Initialize
(async () => {
  const settings = await getSettings();

  // Get libraries with variable collections
  const libraries = await listEnabledLibraries();

  console.log("Initializing plugin...");
  console.log("Found libraries with variables:", libraries);

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

      case "RUN_COMPARISON":
        await runComparison(msg.baselineKey);
        break;

      case "EXTRACT_PALETTE":
        await extractPalette(msg.libraryKey);
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

    const nodes = getAllNodesToScan(roots, settings.ignoreInvisibleLayers ?? true);

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: `Collected ${nodes.length} nodes`
    });

    // Detect which libraries are actually being used in this document
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Detecting library usage..."
    });

    const usageReport = await detectLibraryUsage(nodes);

    // Send usage info to UI
    figma.ui.postMessage({
      type: "LIBRARY_USAGE_DETECTED",
      usage: {
        librariesInUse: Array.from(usageReport.librariesInUse),
        remoteStylesCount: usageReport.remoteStyles.size,
        remoteComponentsCount: usageReport.remoteComponents.size,
      }
    });

    // Ensure DS catalog is loaded with the selected library
    await ensureDSCatalogLoaded(settings.dsLibraryKey);

    const allFindings: Finding[] = [];

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

    // Component checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking component instances..."
    });
    const componentFindings = await checkComponentInstances(nodes, settings.strictness);
    allFindings.push(...componentFindings);

    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking icon consistency..."
    });
    const iconFindings = await checkIconConsistency(nodes);
    allFindings.push(...iconFindings);

    // Content checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking text content..."
    });
    const textContentFindings = await checkTextContent(nodes);
    allFindings.push(...textContentFindings);

    // Structure checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking frame structure..."
    });
    const frameStructureFindings = await checkFrameStructure(nodes);
    allFindings.push(...frameStructureFindings);

    // Accessibility checks
    figma.ui.postMessage({
      type: "SCAN_PROGRESS",
      message: "Checking accessibility..."
    });
    const accessibilityFindings = await checkAccessibility(nodes, settings.strictness);
    allFindings.push(...accessibilityFindings);

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
  try {
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
  } catch (error) {
    // Better error message for library not enabled
    const libraryName = payload.libraryName || "the design system library";
    throw new Error(`Cannot import paint style "${payload.styleName}" from ${libraryName}. Make sure the library is enabled in this file (Assets → Libraries → Enable "${libraryName}").`);
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

async function extractPalette(libraryKey?: string) {
  try {
    figma.ui.postMessage({ type: "EXTRACTION_STARTED" });

    // Get library info for filtering if library key is provided
    let libraryCollectionKeys: string[] | null = null;
    if (libraryKey) {
      const libraries = await listEnabledLibraries();
      console.log(`All available libraries:`, libraries);
      console.log(`Looking for library key: "${libraryKey}"`);

      const selectedLibrary = libraries.find(lib => lib.key === libraryKey);
      console.log(`Found library:`, selectedLibrary);

      if (selectedLibrary && selectedLibrary.collectionKeys) {
        libraryCollectionKeys = selectedLibrary.collectionKeys;
        console.log(`Extracting palette for library: ${libraryKey}`);
        console.log(`Collection keys:`, libraryCollectionKeys);
      } else {
        console.warn(`Library "${libraryKey}" not found or has no variable collections`);
        console.warn(`Available libraries:`, libraries.map(l => l.key));
        figma.notify(`Warning: Library "${libraryKey}" not found or has no variable collections. Extracting all available resources.`);
      }
    }

    const palette: any = {
      metadata: {
        extractedAt: new Date().toISOString(),
        version: "1.0.0",
        fileName: figma.root.name,
        libraryName: libraryKey || "All Libraries"
      },
      paintStyles: [],
      textStyles: [],
      effectStyles: [],
      variables: {
        collections: []
      }
    };

    // Extract Paint Styles
    let paintStyles: PaintStyle[] = [];

    if (libraryKey) {
      // Import paint styles from the library
      console.log(`Importing paint styles from library "${libraryKey}"...`);
      try {
        const availableStyles = await figma.teamLibrary.getAvailableLibraryPaintStylesAsync();
        console.log(`Found ${availableStyles.length} available library paint styles`);

        // Filter to only this library
        const libraryStyles = availableStyles.filter(s => s.libraryName === libraryKey);
        console.log(`  ${libraryStyles.length} styles belong to "${libraryKey}"`);

        // Import each style to read its values
        for (const libStyle of libraryStyles) {
          try {
            const importedStyle = await figma.importStyleByKeyAsync(libStyle.key);
            if (importedStyle.type === 'PAINT') {
              paintStyles.push(importedStyle);
            }
          } catch (err) {
            console.warn(`    Failed to import paint style "${libStyle.name}":`, err);
          }
        }
        console.log(`  Successfully imported ${paintStyles.length} paint styles`);
      } catch (error) {
        console.error(`Failed to import library paint styles:`, error);
      }
    } else {
      // Extract local paint styles
      paintStyles = await figma.getLocalPaintStylesAsync();
      console.log(`Found ${paintStyles.length} local paint styles total`);
    }

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
    let textStyles: TextStyle[] = [];

    if (libraryKey) {
      console.log(`Importing text styles from library "${libraryKey}"...`);
      try {
        const availableStyles = await figma.teamLibrary.getAvailableLibraryTextStylesAsync();
        const libraryStyles = availableStyles.filter(s => s.libraryName === libraryKey);
        console.log(`  ${libraryStyles.length} text styles belong to "${libraryKey}"`);

        for (const libStyle of libraryStyles) {
          try {
            const importedStyle = await figma.importStyleByKeyAsync(libStyle.key);
            if (importedStyle.type === 'TEXT') {
              textStyles.push(importedStyle);
            }
          } catch (err) {
            console.warn(`    Failed to import text style "${libStyle.name}":`, err);
          }
        }
        console.log(`  Successfully imported ${textStyles.length} text styles`);
      } catch (error) {
        console.error(`Failed to import library text styles:`, error);
      }
    } else {
      textStyles = await figma.getLocalTextStylesAsync();
    }

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
    let effectStyles: EffectStyle[] = [];

    if (libraryKey) {
      console.log(`Importing effect styles from library "${libraryKey}"...`);
      try {
        const availableStyles = await figma.teamLibrary.getAvailableLibraryEffectStylesAsync();
        const libraryStyles = availableStyles.filter(s => s.libraryName === libraryKey);
        console.log(`  ${libraryStyles.length} effect styles belong to "${libraryKey}"`);

        for (const libStyle of libraryStyles) {
          try {
            const importedStyle = await figma.importStyleByKeyAsync(libStyle.key);
            if (importedStyle.type === 'EFFECT') {
              effectStyles.push(importedStyle);
            }
          } catch (err) {
            console.warn(`    Failed to import effect style "${libStyle.name}":`, err);
          }
        }
        console.log(`  Successfully imported ${effectStyles.length} effect styles`);
      } catch (error) {
        console.error(`Failed to import library effect styles:`, error);
      }
    } else {
      effectStyles = await figma.getLocalEffectStylesAsync();
    }

    for (const style of effectStyles) {
      palette.effectStyles.push({
        id: style.id,
        name: style.name,
        effects: JSON.parse(JSON.stringify(style.effects))
      });
    }

    // Extract Variables
    // If library is specified, use Team Library API to get variables from enabled library
    // Otherwise, use local variable collections
    let collectionsToExtract: Array<{ id: string; name: string; key: string; modes: any[] }> = [];

    if (libraryCollectionKeys && libraryCollectionKeys.length > 0) {
      console.log(`Extracting variables from library using Team Library API`);
      // Get all available library variable collections
      const availableCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      console.log(`Found ${availableCollections.length} available library variable collections`);

      // Filter to only the selected library's collections
      for (const libCollection of availableCollections) {
        if (libraryCollectionKeys.includes(libCollection.key)) {
          console.log(`Including library collection: "${libCollection.name}" (key: ${libCollection.key})`);
          collectionsToExtract.push({
            id: libCollection.key, // Use key as ID for library collections
            name: libCollection.name,
            key: libCollection.key,
            modes: [] // Will be populated when we import
          });
        }
      }
    } else {
      console.log(`Extracting local variable collections`);
      const localCollections = figma.variables.getLocalVariableCollections();
      console.log(`Found ${localCollections.length} local variable collections total`);
      collectionsToExtract = localCollections.map(c => ({
        id: c.id,
        name: c.name,
        key: c.key,
        modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name }))
      }));
    }

    console.log(`Will extract ${collectionsToExtract.length} collections`);
    let successCount = 0;
    let failedCollections: string[] = [];

    // TWO-PASS APPROACH FOR ALIAS RESOLUTION
    // Pass 1: Import all variables from all collections into a map
    console.log(`\n=== PASS 1: Importing all variables ===`);
    const allImportedVariables = new Map<string, Variable>();
    const collectionsWithVariables: Array<{
      collection: typeof collectionsToExtract[0];
      variables: Variable[];
      modes: any[];
    }> = [];

    for (const collection of collectionsToExtract) {
      let variables: Variable[] = [];
      let modes: any[] = collection.modes;
      let collectionFailed = false;

      // If extracting from library, import the collection first
      if (libraryCollectionKeys && libraryCollectionKeys.includes(collection.key)) {
        console.log(`[${successCount + 1}/${collectionsToExtract.length}] Importing variables from library collection: "${collection.name}"`);
        try {
          const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
          console.log(`  Found ${libraryVariables.length} variables in library collection`);

          // Import each variable by key to get access to its values
          console.log(`  Importing variables to read values...`);
          for (const libVar of libraryVariables) {
            try {
              const importedVar = await figma.variables.importVariableByKeyAsync(libVar.key);
              variables.push(importedVar);
              // Add to map for alias resolution in pass 2
              allImportedVariables.set(importedVar.id, importedVar);
            } catch (err) {
              console.warn(`    Failed to import variable "${libVar.name}" (key: ${libVar.key}):`, err);
            }
          }

          console.log(`  Successfully imported ${variables.length}/${libraryVariables.length} variables from "${collection.name}"`);

          // Get modes from the first imported variable's collection
          if (variables.length > 0) {
            const importedCollection = figma.variables.getVariableCollectionById(variables[0].variableCollectionId);
            if (importedCollection) {
              modes = importedCollection.modes.map(m => ({ modeId: m.modeId, name: m.name }));
              console.log(`  Modes:`, modes.map(m => m.name));
            }
          }
        } catch (error) {
          console.error(`  Failed to import variables from collection "${collection.name}":`, error);
          console.error(`  Error details:`, error instanceof Error ? error.message : String(error));
          failedCollections.push(collection.name);
          collectionFailed = true;
        }
      } else {
        // Local collection - get variables directly and add to map
        variables = figma.variables.getLocalVariables().filter(
          v => v.variableCollectionId === collection.id
        );
        // Add local variables to map too
        for (const v of variables) {
          allImportedVariables.set(v.id, v);
        }
      }

      if (collectionFailed && variables.length === 0) {
        console.warn(`  Skipping failed collection "${collection.name}"`);
        continue;
      }

      collectionsWithVariables.push({ collection, variables, modes });
      successCount++;
    }

    console.log(`\n=== PASS 1 Complete ===`);
    console.log(`Total variables imported: ${allImportedVariables.size}`);
    console.log(`Collections ready for processing: ${collectionsWithVariables.length}`);

    // Pass 2: Process all variables and resolve aliases using the complete map
    console.log(`\n=== PASS 2: Processing variables and resolving aliases ===`);

    for (const { collection, variables, modes } of collectionsWithVariables) {
      const collectionData: any = {
        id: collection.id,
        name: collection.name,
        key: collection.key,
        modes: modes,
        variables: []
      };

      for (const variable of variables) {
        try {
          // Safely serialize valuesByMode, filtering out undefined values
          const safeValuesByMode: any = {};
          for (const modeId in variable.valuesByMode) {
            const value = variable.valuesByMode[modeId];
            if (value !== undefined) {
              safeValuesByMode[modeId] = value;
            }
          }

          const varData: any = {
            id: variable.id,
            key: variable.key,
            name: variable.name,
            resolvedType: variable.resolvedType,
            valuesByMode: JSON.parse(JSON.stringify(safeValuesByMode)),
            resolvedValues: {}
          };

          // For color variables, resolve aliases using the imported variables map
          if (variable.resolvedType === "COLOR") {
            for (const modeId in variable.valuesByMode) {
              const value = variable.valuesByMode[modeId];

              if (typeof value === 'object' && value && 'r' in value && 'g' in value && 'b' in value) {
                // Direct RGBA value
                varData.resolvedValues[modeId] = {
                  r: value.r,
                  g: value.g,
                  b: value.b,
                  a: value.a ?? 1
                };
              } else if (typeof value === 'object' && value && 'type' in value && value.type === 'VARIABLE_ALIAS') {
                // Resolve alias using the imported variables map
                const resolved = resolveAliasWithMap(value, modeId, allImportedVariables);
                if (resolved) {
                  varData.resolvedValues[modeId] = resolved;
                } else {
                  console.warn(`  Failed to resolve alias for variable "${variable.name}" mode "${modeId}"`);
                }
              }
            }
          }

          collectionData.variables.push(varData);
        } catch (error) {
          console.error(`Failed to process variable "${variable.name}":`, error);
          // Continue with next variable
        }
      }

      palette.variables.collections.push(collectionData);
      console.log(`  Processed collection "${collection.name}" with ${collectionData.variables.length} variables`);
    }

    console.log(`\n=== Extraction Summary ===`);
    console.log(`Successfully extracted: ${successCount}/${collectionsToExtract.length} collections`);
    if (failedCollections.length > 0) {
      console.warn(`Failed collections (${failedCollections.length}):`, failedCollections);
    }
    console.log(`Total variables: ${palette.variables.collections.reduce((sum: number, c: any) => sum + c.variables.length, 0)}`);

    // Extract components
    console.log(`\n=== Extracting Components ===`);
    palette.components = [];

    if (libraryKey) {
      // Note: Figma API doesn't support listing library components directly
      // Components can only be extracted from the source file where they're local
      console.log(`Note: Component extraction from remote libraries is not supported by Figma API.`);
      console.log(`To extract components, open the design system source file and use "Extract Local Resources".`);
      figma.notify(`Components cannot be extracted from remote libraries. Open the DS source file and use "Extract Local Resources".`, { timeout: 5000 });
    } else {
      // Extract components from all pages (local)
      for (const page of figma.root.children) {
        console.log(`Scanning page: ${page.name}`);
        const components = page.findAllWithCriteria({ types: ['COMPONENT'] });

        for (const comp of components) {
          const componentData = await extractComponentProperties(comp, page.name);
          palette.components.push(componentData);
        }
      }
    }

    console.log(`\n=== Extraction Complete ===`);
    console.log(`Total components: ${palette.components.length}`);

    figma.ui.postMessage({
      type: "PALETTE_EXTRACTED",
      palette: JSON.stringify(palette, null, 2)
    });

    figma.notify(`Palette extracted! ${palette.components.length} components, ${palette.paintStyles.length} paint styles, ${palette.textStyles.length} text styles`);
  } catch (error) {
    console.error('Palette extraction error:', error);
    figma.notify(`Extraction failed: ${error}`);
    figma.ui.postMessage({
      type: "ERROR",
      message: `Failed to extract palette: ${error}`
    });
  }
}

async function extractComponentProperties(comp: ComponentNode, pageName: string): Promise<any> {
  const componentData: any = {
    name: comp.name,
    pageName: pageName,
    type: comp.type,
    width: comp.width,
    height: comp.height
  };

        // Extract border radius
        if ('cornerRadius' in comp && typeof comp.cornerRadius === 'number') {
          componentData.cornerRadius = comp.cornerRadius;
        } else if ('topLeftRadius' in comp) {
          componentData.cornerRadius = {
            topLeft: (comp as any).topLeftRadius,
            topRight: (comp as any).topRightRadius,
            bottomLeft: (comp as any).bottomLeftRadius,
            bottomRight: (comp as any).bottomRightRadius
          };
        }

        // Extract auto-layout properties
        if (comp.layoutMode !== 'NONE') {
          componentData.layout = {
            mode: comp.layoutMode,
            primaryAxisSizingMode: comp.primaryAxisSizingMode,
            counterAxisSizingMode: comp.counterAxisSizingMode,
            primaryAxisAlignItems: comp.primaryAxisAlignItems,
            counterAxisAlignItems: comp.counterAxisAlignItems,
            paddingLeft: comp.paddingLeft,
            paddingRight: comp.paddingRight,
            paddingTop: comp.paddingTop,
            paddingBottom: comp.paddingBottom,
            itemSpacing: comp.itemSpacing
          };
        }

        // Extract component properties (variantProperties) - with error handling
        try {
          if ('variantProperties' in comp && comp.variantProperties) {
            componentData.variantProperties = comp.variantProperties;
          }
        } catch (e) {
          // Component set has errors, skip variant properties
        }

        // Extract fills with details
        try {
          if ('fills' in comp && comp.fills !== figma.mixed && Array.isArray(comp.fills) && comp.fills.length > 0) {
            componentData.fills = [];
            for (const fill of comp.fills) {
              try {
                if (fill.type === 'SOLID' && 'color' in fill) {
                  const r = Math.round(fill.color.r * 255);
                  const g = Math.round(fill.color.g * 255);
                  const b = Math.round(fill.color.b * 255);
                  const a = fill.opacity ?? 1;
                  componentData.fills.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
                } else if (fill.type === 'SOLID' && 'boundVariables' in fill && fill.boundVariables && 'color' in fill.boundVariables) {
                  const varId = (fill.boundVariables.color as any)?.id;
                  if (varId) {
                    const variable = figma.variables.getVariableById(varId);
                    if (variable) {
                      componentData.fills.push(`var:${variable.name}`);
                    }
                  }
                }
              } catch (e) {
                // Skip this fill if error
              }
            }
          }
        } catch (e) {
          // Skip fills extraction if error
        }

        // Extract strokes with details
        try {
          if ('strokes' in comp && comp.strokes !== figma.mixed && Array.isArray(comp.strokes) && comp.strokes.length > 0) {
            componentData.strokes = [];
            for (const stroke of comp.strokes) {
              try {
                if (stroke.type === 'SOLID' && 'color' in stroke) {
                  const r = Math.round(stroke.color.r * 255);
                  const g = Math.round(stroke.color.g * 255);
                  const b = Math.round(stroke.color.b * 255);
                  const a = stroke.opacity ?? 1;
                  componentData.strokes.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
                } else if (stroke.type === 'SOLID' && 'boundVariables' in stroke && stroke.boundVariables && 'color' in stroke.boundVariables) {
                  const varId = (stroke.boundVariables.color as any)?.id;
                  if (varId) {
                    const variable = figma.variables.getVariableById(varId);
                    if (variable) {
                      componentData.strokes.push(`var:${variable.name}`);
                    }
                  }
                }
              } catch (e) {
                // Skip this stroke if error
              }
            }
            if ('strokeWeight' in comp && typeof comp.strokeWeight === 'number') {
              componentData.strokeWeight = comp.strokeWeight;
            }
          }
        } catch (e) {
          // Skip strokes extraction if error
        }

  return componentData;
}

// Resolve variable alias using imported variables map (two-pass extraction)
function resolveAliasWithMap(
  value: any,
  modeId: string,
  variablesMap: Map<string, Variable>,
  visited = new Set<string>()
): any {
  if (!value || typeof value !== 'object' || value.type !== 'VARIABLE_ALIAS') {
    return null;
  }

  const aliasId = value.id;

  // Cycle detection
  if (visited.has(aliasId)) {
    console.warn(`Circular alias detected for variable ID: ${aliasId}`);
    return null;
  }
  visited.add(aliasId);

  // Look up the aliased variable from our imported variables map
  const aliasVar = variablesMap.get(aliasId);
  if (!aliasVar) {
    console.warn(`Aliased variable not found in map: ${aliasId}`);
    return null;
  }

  // Try to get the value for the requested mode
  let aliasValue = aliasVar.valuesByMode[modeId];

  // If the mode doesn't exist (cross-collection alias), use the first available mode
  if (!aliasValue) {
    const availableModes = Object.keys(aliasVar.valuesByMode);
    if (availableModes.length > 0) {
      aliasValue = aliasVar.valuesByMode[availableModes[0]];
      console.log(`  Mode ${modeId} not found for "${aliasVar.name}", using mode ${availableModes[0]}`);
    } else {
      return null;
    }
  }

  // If it's a direct RGBA value, return it
  if (typeof aliasValue === 'object' && 'r' in aliasValue && 'g' in aliasValue && 'b' in aliasValue) {
    return {
      r: aliasValue.r,
      g: aliasValue.g,
      b: aliasValue.b,
      a: aliasValue.a ?? 1
    };
  }

  // If it's another alias, recursively resolve it
  if (typeof aliasValue === 'object' && aliasValue.type === 'VARIABLE_ALIAS') {
    return resolveAliasWithMap(aliasValue, modeId, variablesMap, visited);
  }

  // Return primitive values (number, string, boolean)
  if (typeof aliasValue === 'number' || typeof aliasValue === 'string' || typeof aliasValue === 'boolean') {
    return aliasValue;
  }

  return null;
}

async function runComparison(baselineKey: string) {
  try {
    figma.ui.postMessage({ type: "COMPARISON_STARTED" });

    console.log("=== Starting Design System Comparison ===");
    console.log(`Baseline: ${baselineKey}`);

    // Load baseline palette from bundled palettes
    const baselinePalette = PALETTES[baselineKey];
    if (!baselinePalette) {
      throw new Error(`Baseline palette "${baselineKey}" not found`);
    }

    console.log("Baseline palette loaded");

    // Extract current file (target) - simplified extraction
    console.log("Extracting current file...");
    const targetPalette = await extractCurrentFile();
    console.log("Current file extracted");

    // Compare palettes
    console.log("Comparing palettes...");
    const differences = comparePalettes(baselinePalette, targetPalette);
    console.log(`Found ${differences.length} differences`);

    // Send results
    figma.ui.postMessage({
      type: "COMPARISON_COMPLETE",
      result: {
        baseline: baselineKey,
        target: targetPalette.metadata.fileName,
        differences: differences,
        timestamp: Date.now()
      }
    });

    figma.notify(`Comparison complete: ${differences.length} differences found`);
  } catch (error) {
    console.error("Comparison failed:", error);
    figma.ui.postMessage({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Comparison failed"
    });
  }
}

async function extractCurrentFile() {
  // Simplified extraction - just get what we need for comparison
  const palette: any = {
    metadata: {
      fileName: figma.root.name,
      extractedAt: new Date().toISOString()
    },
    paintStyles: [],
    textStyles: [],
    effectStyles: [],
    variables: {
      collections: []
    }
  };

  // Extract local paint styles
  const paintStyles = figma.getLocalPaintStyles();
  for (const style of paintStyles) {
    palette.paintStyles.push({
      id: style.id,
      key: style.key,
      name: style.name,
      paints: JSON.parse(JSON.stringify(style.paints))
    });
  }

  // Extract local text styles
  const textStyles = figma.getLocalTextStyles();
  for (const style of textStyles) {
    palette.textStyles.push({
      id: style.id,
      name: style.name,
      fontFamily: style.fontName.family,
      fontSize: style.fontSize,
      fontWeight: (style.fontName as any).style || "Regular",
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing
    });
  }

  // Extract local effect styles
  const effectStyles = figma.getLocalEffectStyles();
  for (const style of effectStyles) {
    palette.effectStyles.push({
      id: style.id,
      name: style.name,
      effects: JSON.parse(JSON.stringify(style.effects))
    });
  }

  // Extract local variable collections with alias resolution
  const collections = figma.variables.getLocalVariableCollections();

  // Build a map of all variables for alias resolution
  const allLocalVariables = figma.variables.getLocalVariables();
  const variablesMap = new Map<string, Variable>();
  for (const v of allLocalVariables) {
    variablesMap.set(v.id, v);
  }

  for (const collection of collections) {
    const variables = allLocalVariables.filter(
      v => v.variableCollectionId === collection.id
    );

    const collectionData: any = {
      id: collection.id,
      name: collection.name,
      key: collection.key,
      modes: collection.modes.map(m => ({ modeId: m.modeId, name: m.name })),
      variables: []
    };

    for (const variable of variables) {
      const safeValuesByMode: any = {};
      for (const modeId in variable.valuesByMode) {
        const value = variable.valuesByMode[modeId];
        if (value !== undefined) {
          safeValuesByMode[modeId] = value;
        }
      }

      const varData: any = {
        id: variable.id,
        key: variable.key,
        name: variable.name,
        resolvedType: variable.resolvedType,
        valuesByMode: safeValuesByMode,
        resolvedValues: {}
      };

      // Resolve aliases for all types
      for (const modeId in variable.valuesByMode) {
        const value = variable.valuesByMode[modeId];

        if (variable.resolvedType === "COLOR") {
          if (typeof value === 'object' && value && 'r' in value && 'g' in value && 'b' in value) {
            // Direct RGBA value
            varData.resolvedValues[modeId] = {
              r: value.r,
              g: value.g,
              b: value.b,
              a: value.a ?? 1
            };
          } else if (typeof value === 'object' && value && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            // Resolve alias
            const resolved = resolveAliasWithMap(value, modeId, variablesMap);
            if (resolved) {
              varData.resolvedValues[modeId] = resolved;
            }
          }
        } else if (variable.resolvedType === "FLOAT") {
          if (typeof value === 'number') {
            varData.resolvedValues[modeId] = value;
          } else if (typeof value === 'object' && value && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            const resolved = resolveAliasWithMap(value, modeId, variablesMap);
            if (resolved !== null) {
              varData.resolvedValues[modeId] = resolved;
            }
          }
        } else if (variable.resolvedType === "STRING") {
          if (typeof value === 'string') {
            varData.resolvedValues[modeId] = value;
          } else if (typeof value === 'object' && value && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            const resolved = resolveAliasWithMap(value, modeId, variablesMap);
            if (resolved !== null) {
              varData.resolvedValues[modeId] = resolved;
            }
          }
        } else if (variable.resolvedType === "BOOLEAN") {
          if (typeof value === 'boolean') {
            varData.resolvedValues[modeId] = value;
          } else if (typeof value === 'object' && value && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            const resolved = resolveAliasWithMap(value, modeId, variablesMap);
            if (resolved !== null) {
              varData.resolvedValues[modeId] = resolved;
            }
          }
        }
      }

      collectionData.variables.push(varData);
    }

    palette.variables.collections.push(collectionData);
  }

  // Extract components from all pages
  palette.components = [];

  for (const page of figma.root.children) {
    const components = page.findAllWithCriteria({ types: ['COMPONENT'] });

    for (const comp of components) {
      const componentData: any = {
        name: comp.name,
        pageName: page.name,
        type: comp.type,
        width: comp.width,
        height: comp.height
      };

      // Extract border radius
      if ('cornerRadius' in comp && typeof comp.cornerRadius === 'number') {
        componentData.cornerRadius = comp.cornerRadius;
      } else if ('topLeftRadius' in comp) {
        componentData.cornerRadius = {
          topLeft: (comp as any).topLeftRadius,
          topRight: (comp as any).topRightRadius,
          bottomLeft: (comp as any).bottomLeftRadius,
          bottomRight: (comp as any).bottomRightRadius
        };
      }

      // Extract auto-layout properties
      if (comp.layoutMode !== 'NONE') {
        componentData.layout = {
          mode: comp.layoutMode,
          primaryAxisSizingMode: comp.primaryAxisSizingMode,
          counterAxisSizingMode: comp.counterAxisSizingMode,
          primaryAxisAlignItems: comp.primaryAxisAlignItems,
          counterAxisAlignItems: comp.counterAxisAlignItems,
          paddingLeft: comp.paddingLeft,
          paddingRight: comp.paddingRight,
          paddingTop: comp.paddingTop,
          paddingBottom: comp.paddingBottom,
          itemSpacing: comp.itemSpacing
        };
      }

      // Extract component properties (variantProperties) - with error handling
      try {
        if ('variantProperties' in comp && comp.variantProperties) {
          componentData.variantProperties = comp.variantProperties;
        }
      } catch (e) {
        // Component set has errors, skip variant properties
      }

      // Extract fills with details
      try {
        if ('fills' in comp && comp.fills !== figma.mixed && Array.isArray(comp.fills) && comp.fills.length > 0) {
          componentData.fills = [];
          for (const fill of comp.fills) {
            try {
              if (fill.type === 'SOLID' && 'color' in fill) {
                const r = Math.round(fill.color.r * 255);
                const g = Math.round(fill.color.g * 255);
                const b = Math.round(fill.color.b * 255);
                const a = fill.opacity ?? 1;
                componentData.fills.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
              } else if (fill.type === 'SOLID' && 'boundVariables' in fill && fill.boundVariables && 'color' in fill.boundVariables) {
                const varId = (fill.boundVariables.color as any)?.id;
                if (varId) {
                  const variable = figma.variables.getVariableById(varId);
                  if (variable) {
                    componentData.fills.push(`var:${variable.name}`);
                  }
                }
              }
            } catch (e) {
              // Skip this fill if error
            }
          }
        }
      } catch (e) {
        // Skip fills extraction if error
      }

      // Extract strokes with details
      try {
        if ('strokes' in comp && comp.strokes !== figma.mixed && Array.isArray(comp.strokes) && comp.strokes.length > 0) {
          componentData.strokes = [];
          for (const stroke of comp.strokes) {
            try {
              if (stroke.type === 'SOLID' && 'color' in stroke) {
                const r = Math.round(stroke.color.r * 255);
                const g = Math.round(stroke.color.g * 255);
                const b = Math.round(stroke.color.b * 255);
                const a = stroke.opacity ?? 1;
                componentData.strokes.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
              } else if (stroke.type === 'SOLID' && 'boundVariables' in stroke && stroke.boundVariables && 'color' in stroke.boundVariables) {
                const varId = (stroke.boundVariables.color as any)?.id;
                if (varId) {
                  const variable = figma.variables.getVariableById(varId);
                  if (variable) {
                    componentData.strokes.push(`var:${variable.name}`);
                  }
                }
              }
            } catch (e) {
              // Skip this stroke if error
            }
          }
          if ('strokeWeight' in comp && typeof comp.strokeWeight === 'number') {
            componentData.strokeWeight = comp.strokeWeight;
          }
        }
      } catch (e) {
        // Skip strokes extraction if error
      }

      palette.components.push(componentData);
    }
  }

  return palette;
}

function getValuesForFormatting(variable: any): any {
  // Check if resolvedValues exists and has keys
  const resolvedValues = variable.resolvedValues;
  if (resolvedValues && Object.keys(resolvedValues).length > 0) {
    return resolvedValues;
  }
  // Fall back to valuesByMode
  return variable.valuesByMode;
}

function comparePalettes(baseline: any, target: any) {
  const differences: any[] = [];

  // Build GLOBAL maps of all variables across ALL collections (for cross-collection matching)
  const allBaselineVars: any[] = [];
  const allTargetVars: any[] = [];

  for (const collection of (baseline.variables?.collections || [])) {
    for (const variable of collection.variables) {
      allBaselineVars.push(Object.assign({}, variable, {
        collectionName: collection.name,
        fullPath: `${collection.name}/${variable.name}`
      }));
    }
  }

  for (const collection of (target.variables?.collections || [])) {
    for (const variable of collection.variables) {
      allTargetVars.push(Object.assign({}, variable, {
        collectionName: collection.name,
        fullPath: `${collection.name}/${variable.name}`
      }));
    }
  }

  // Build global value map for cross-collection matching
  const globalBaselineByValue = new Map<string, any[]>();
  const globalTargetByValue = new Map<string, any[]>();

  for (const v of allBaselineVars) {
    const value = formatValue(getValuesForFormatting(v), v.resolvedType);
    if (!globalBaselineByValue.has(value)) {
      globalBaselineByValue.set(value, []);
    }
    globalBaselineByValue.get(value)!.push(v);
  }

  for (const v of allTargetVars) {
    const value = formatValue(getValuesForFormatting(v), v.resolvedType);
    if (!globalTargetByValue.has(value)) {
      globalTargetByValue.set(value, []);
    }
    globalTargetByValue.get(value)!.push(v);
  }

  const processedTargetPaths = new Set<string>();

  // Process all baseline variables
  for (const baselineVar of allBaselineVars) {
    const baselineFullPath = baselineVar.fullPath;
    const baselineValue = formatValue(getValuesForFormatting(baselineVar), baselineVar.resolvedType);

    // Check if exact same path exists in target
    const targetVarExact = allTargetVars.find(v => v.fullPath === baselineFullPath);

    if (targetVarExact) {
      // Same path exists
      const targetValue = formatValue(getValuesForFormatting(targetVarExact), targetVarExact.resolvedType);
      processedTargetPaths.add(targetVarExact.fullPath);

      if (baselineValue !== targetValue) {
        // Same path, different value = VALUE CHANGED
        differences.push({
          type: "CHANGED",
          category: "variable",
          name: baselineVar.name,
          fromValue: baselineValue,
          toValue: targetValue,
          collectionName: baselineVar.collectionName,
          migrationHint: `Update "${baselineFullPath}" value`
        });
      }
      // Same path, same value = no difference (silent)
    } else {
      // Path doesn't exist - check if value exists ANYWHERE in target (cross-collection)
      const targetVarsWithSameValue = globalTargetByValue.get(baselineValue);

      if (targetVarsWithSameValue && targetVarsWithSameValue.length > 0) {
        // Same value exists somewhere else = RENAMED (possibly cross-collection)
        const renamedTo = targetVarsWithSameValue[0];
        processedTargetPaths.add(renamedTo.fullPath);

        differences.push({
          type: "RENAMED",
          category: "variable",
          name: `${baselineVar.name} → ${renamedTo.name}`,
          fromValue: baselineValue,
          toValue: baselineValue,
          collectionName: baselineVar.collectionName,
          migrationHint: `Replace "${baselineFullPath}" with "${renamedTo.fullPath}"`
        });
      } else {
        // Value doesn't exist anywhere = REMOVED
        differences.push({
          type: "REMOVED",
          category: "variable",
          name: baselineVar.name,
          fromValue: baselineValue,
          collectionName: baselineVar.collectionName,
          migrationHint: `"${baselineFullPath}" was removed`
        });
      }
    }
  }

  // Process remaining target variables (genuinely new)
  for (const targetVar of allTargetVars) {
    if (!processedTargetPaths.has(targetVar.fullPath)) {
      const targetValue = formatValue(getValuesForFormatting(targetVar), targetVar.resolvedType);

      // Check if this value existed in baseline under different name (should have been caught above, but safety check)
      const baselineWithSameValue = globalBaselineByValue.get(targetValue);
      if (!baselineWithSameValue || baselineWithSameValue.length === 0) {
        // Truly new
        differences.push({
          type: "NEW",
          category: "variable",
          name: targetVar.name,
          toValue: targetValue,
          collectionName: targetVar.collectionName,
          migrationHint: `New variable: "${targetVar.fullPath}"`
        });
      }
    }
  }

  // Compare paint styles (global value matching)
  const baselinePaintStyles = baseline.paintStyles || [];
  const targetPaintStyles = target.paintStyles || [];

  const baselinePaintByValue = new Map<string, any[]>();
  const targetPaintByValue = new Map<string, any[]>();

  for (const s of baselinePaintStyles) {
    const value = formatPaintStyle(s.paints);
    if (!baselinePaintByValue.has(value)) {
      baselinePaintByValue.set(value, []);
    }
    baselinePaintByValue.get(value)!.push(s);
  }

  for (const s of targetPaintStyles) {
    const value = formatPaintStyle(s.paints);
    if (!targetPaintByValue.has(value)) {
      targetPaintByValue.set(value, []);
    }
    targetPaintByValue.get(value)!.push(s);
  }

  const processedTargetPaintNames = new Set<string>();

  for (const baselineStyle of baselinePaintStyles) {
    const baselineName = baselineStyle.name;
    const baselineValue = formatPaintStyle(baselineStyle.paints);
    const targetStyleExact = targetPaintStyles.find((s: any) => s.name === baselineName);

    if (targetStyleExact) {
      const targetValue = formatPaintStyle(targetStyleExact.paints);
      processedTargetPaintNames.add(baselineName);

      if (baselineValue !== targetValue) {
        // Compare individual properties to show what changed
        const propChanges: string[] = [];
        const baselinePaint = baselineStyle.paints && baselineStyle.paints.length > 0 ? baselineStyle.paints[0] : null;
        const targetPaint = targetStyleExact.paints && targetStyleExact.paints.length > 0 ? targetStyleExact.paints[0] : null;

        if (baselinePaint && targetPaint) {
          // Compare paint type
          if (baselinePaint.type !== targetPaint.type) {
            propChanges.push(`Type: ${baselinePaint.type} → ${targetPaint.type}`);
          }

          // Compare color (for SOLID paints)
          if (baselinePaint.type === "SOLID" && targetPaint.type === "SOLID") {
            if (baselinePaint.color && targetPaint.color) {
              const baselineColorStr = `rgba(${Math.round(baselinePaint.color.r * 255)},${Math.round(baselinePaint.color.g * 255)},${Math.round(baselinePaint.color.b * 255)},${(baselinePaint.opacity !== undefined ? baselinePaint.opacity : 1).toFixed(2)})`;
              const targetColorStr = `rgba(${Math.round(targetPaint.color.r * 255)},${Math.round(targetPaint.color.g * 255)},${Math.round(targetPaint.color.b * 255)},${(targetPaint.opacity !== undefined ? targetPaint.opacity : 1).toFixed(2)})`;

              if (baselineColorStr !== targetColorStr) {
                propChanges.push(`Color: ${baselineColorStr} → ${targetColorStr}`);
              }
            }
          }

          // Compare opacity
          const baselineOpacity = baselinePaint.opacity !== undefined ? baselinePaint.opacity : 1;
          const targetOpacity = targetPaint.opacity !== undefined ? targetPaint.opacity : 1;
          if (baselineOpacity !== targetOpacity) {
            propChanges.push(`Opacity: ${(baselineOpacity * 100).toFixed(0)}% → ${(targetOpacity * 100).toFixed(0)}%`);
          }

          // Compare blend mode
          if (baselinePaint.blendMode !== targetPaint.blendMode) {
            propChanges.push(`Blend mode: ${baselinePaint.blendMode || "NORMAL"} → ${targetPaint.blendMode || "NORMAL"}`);
          }

          // Compare visibility
          if (baselinePaint.visible !== targetPaint.visible) {
            propChanges.push(`Visibility: ${baselinePaint.visible ? "visible" : "hidden"} → ${targetPaint.visible ? "visible" : "hidden"}`);
          }
        }

        differences.push({
          type: "CHANGED",
          category: "paintStyle",
          name: baselineName,
          fromValue: baselineValue,
          toValue: targetValue,
          details: propChanges.length > 0 ? propChanges.join(" | ") : undefined,
          collectionName: "Paint Styles",
          migrationHint: `Update paint style "${baselineName}"`
        });
      }
    } else {
      const targetStylesWithSameValue = targetPaintByValue.get(baselineValue);

      if (targetStylesWithSameValue && targetStylesWithSameValue.length > 0) {
        const renamedTo = targetStylesWithSameValue[0];
        processedTargetPaintNames.add(renamedTo.name);

        differences.push({
          type: "RENAMED",
          category: "paintStyle",
          name: `${baselineName} → ${renamedTo.name}`,
          fromValue: baselineValue,
          toValue: baselineValue,
          collectionName: "Paint Styles",
          migrationHint: `Replace paint style "${baselineName}" with "${renamedTo.name}"`
        });
      } else {
        differences.push({
          type: "REMOVED",
          category: "paintStyle",
          name: baselineName,
          fromValue: baselineValue,
          collectionName: "Paint Styles",
          migrationHint: `Paint style "${baselineName}" was removed`
        });
      }
    }
  }

  for (const targetStyle of targetPaintStyles) {
    if (!processedTargetPaintNames.has(targetStyle.name)) {
      const targetValue = formatPaintStyle(targetStyle.paints);
      const baselineWithSameValue = baselinePaintByValue.get(targetValue);

      if (!baselineWithSameValue || baselineWithSameValue.length === 0) {
        differences.push({
          type: "NEW",
          category: "paintStyle",
          name: targetStyle.name,
          toValue: targetValue,
          collectionName: "Paint Styles",
          migrationHint: `New paint style: "${targetStyle.name}"`
        });
      }
    }
  }

  // Compare text styles (global value matching)
  const baselineTextStyles = baseline.textStyles || [];
  const targetTextStyles = target.textStyles || [];

  const baselineTextByValue = new Map<string, any[]>();
  const targetTextByValue = new Map<string, any[]>();

  for (const s of baselineTextStyles) {
    const value = formatTextStyle(s);
    if (!baselineTextByValue.has(value)) {
      baselineTextByValue.set(value, []);
    }
    baselineTextByValue.get(value)!.push(s);
  }

  for (const s of targetTextStyles) {
    const value = formatTextStyle(s);
    if (!targetTextByValue.has(value)) {
      targetTextByValue.set(value, []);
    }
    targetTextByValue.get(value)!.push(s);
  }

  const processedTargetTextNames = new Set<string>();

  for (const baselineStyle of baselineTextStyles) {
    const baselineName = baselineStyle.name;
    const baselineValue = formatTextStyle(baselineStyle);
    const targetStyleExact = targetTextStyles.find((s: any) => s.name === baselineName);

    if (targetStyleExact) {
      const targetValue = formatTextStyle(targetStyleExact);
      processedTargetTextNames.add(baselineName);

      if (baselineValue !== targetValue) {
        // Compare individual properties to show what changed
        const propChanges: string[] = [];

        if (baselineStyle.fontFamily !== targetStyleExact.fontFamily) {
          propChanges.push(`Font family: ${baselineStyle.fontFamily || "undefined"} → ${targetStyleExact.fontFamily || "undefined"}`);
        }

        if (baselineStyle.fontSize !== targetStyleExact.fontSize) {
          propChanges.push(`Font size: ${baselineStyle.fontSize || "undefined"}px → ${targetStyleExact.fontSize || "undefined"}px`);
        }

        if (baselineStyle.fontWeight !== targetStyleExact.fontWeight) {
          propChanges.push(`Font weight: ${baselineStyle.fontWeight || "Regular"} → ${targetStyleExact.fontWeight || "Regular"}`);
        }

        // Compare line height
        const baselineLineHeight = typeof baselineStyle.lineHeight === 'object'
          ? `${baselineStyle.lineHeight.value}${baselineStyle.lineHeight.unit === 'PIXELS' ? 'px' : '%'}`
          : baselineStyle.lineHeight;
        const targetLineHeight = typeof targetStyleExact.lineHeight === 'object'
          ? `${targetStyleExact.lineHeight.value}${targetStyleExact.lineHeight.unit === 'PIXELS' ? 'px' : '%'}`
          : targetStyleExact.lineHeight;

        if (JSON.stringify(baselineStyle.lineHeight) !== JSON.stringify(targetStyleExact.lineHeight)) {
          propChanges.push(`Line height: ${baselineLineHeight} → ${targetLineHeight}`);
        }

        // Compare letter spacing
        const baselineLetterSpacing = typeof baselineStyle.letterSpacing === 'object'
          ? `${baselineStyle.letterSpacing.value}${baselineStyle.letterSpacing.unit === 'PIXELS' ? 'px' : '%'}`
          : baselineStyle.letterSpacing || "0";
        const targetLetterSpacing = typeof targetStyleExact.letterSpacing === 'object'
          ? `${targetStyleExact.letterSpacing.value}${targetStyleExact.letterSpacing.unit === 'PIXELS' ? 'px' : '%'}`
          : targetStyleExact.letterSpacing || "0";

        if (JSON.stringify(baselineStyle.letterSpacing) !== JSON.stringify(targetStyleExact.letterSpacing)) {
          propChanges.push(`Letter spacing: ${baselineLetterSpacing} → ${targetLetterSpacing}`);
        }

        differences.push({
          type: "CHANGED",
          category: "textStyle",
          name: baselineName,
          fromValue: propChanges.join(" | "),
          toValue: "",
          collectionName: "Text Styles",
          migrationHint: `Text style properties changed: ${propChanges.join(", ")}`
        });
      }
    } else {
      const targetStylesWithSameValue = targetTextByValue.get(baselineValue);

      if (targetStylesWithSameValue && targetStylesWithSameValue.length > 0) {
        const renamedTo = targetStylesWithSameValue[0];
        processedTargetTextNames.add(renamedTo.name);

        differences.push({
          type: "RENAMED",
          category: "textStyle",
          name: `${baselineName} → ${renamedTo.name}`,
          fromValue: baselineValue,
          toValue: baselineValue,
          collectionName: "Text Styles",
          migrationHint: `Replace text style "${baselineName}" with "${renamedTo.name}"`
        });
      } else {
        differences.push({
          type: "REMOVED",
          category: "textStyle",
          name: baselineName,
          fromValue: baselineValue,
          collectionName: "Text Styles",
          migrationHint: `Text style "${baselineName}" was removed`
        });
      }
    }
  }

  for (const targetStyle of targetTextStyles) {
    if (!processedTargetTextNames.has(targetStyle.name)) {
      const targetValue = formatTextStyle(targetStyle);
      const baselineWithSameValue = baselineTextByValue.get(targetValue);

      if (!baselineWithSameValue || baselineWithSameValue.length === 0) {
        differences.push({
          type: "NEW",
          category: "textStyle",
          name: targetStyle.name,
          toValue: targetValue,
          collectionName: "Text Styles",
          migrationHint: `New text style: "${targetStyle.name}"`
        });
      }
    }
  }

  // Compare effect styles (global value matching)
  const baselineEffectStyles = baseline.effectStyles || [];
  const targetEffectStyles = target.effectStyles || [];

  const baselineEffectByValue = new Map<string, any[]>();
  const targetEffectByValue = new Map<string, any[]>();

  for (const s of baselineEffectStyles) {
    const value = formatEffectStyle(s.effects);
    if (!baselineEffectByValue.has(value)) {
      baselineEffectByValue.set(value, []);
    }
    baselineEffectByValue.get(value)!.push(s);
  }

  for (const s of targetEffectStyles) {
    const value = formatEffectStyle(s.effects);
    if (!targetEffectByValue.has(value)) {
      targetEffectByValue.set(value, []);
    }
    targetEffectByValue.get(value)!.push(s);
  }

  const processedTargetEffectNames = new Set<string>();

  for (const baselineStyle of baselineEffectStyles) {
    const baselineName = baselineStyle.name;
    const baselineValue = formatEffectStyle(baselineStyle.effects);
    const targetStyleExact = targetEffectStyles.find((s: any) => s.name === baselineName);

    if (targetStyleExact) {
      const targetValue = formatEffectStyle(targetStyleExact.effects);
      processedTargetEffectNames.add(baselineName);

      if (baselineValue !== targetValue) {
        // Compare individual properties to show what changed
        const propChanges: string[] = [];
        const baselineEffect = baselineStyle.effects && baselineStyle.effects.length > 0 ? baselineStyle.effects[0] : null;
        const targetEffect = targetStyleExact.effects && targetStyleExact.effects.length > 0 ? targetStyleExact.effects[0] : null;

        if (baselineEffect && targetEffect) {
          // Compare effect type
          if (baselineEffect.type !== targetEffect.type) {
            propChanges.push(`Type: ${baselineEffect.type} → ${targetEffect.type}`);
          }

          // Compare blur radius
          if (baselineEffect.radius !== targetEffect.radius) {
            propChanges.push(`Blur radius: ${baselineEffect.radius || 0}px → ${targetEffect.radius || 0}px`);
          }

          // Compare offset
          const baselineOffsetX = baselineEffect.offset?.x || 0;
          const baselineOffsetY = baselineEffect.offset?.y || 0;
          const targetOffsetX = targetEffect.offset?.x || 0;
          const targetOffsetY = targetEffect.offset?.y || 0;

          if (baselineOffsetX !== targetOffsetX || baselineOffsetY !== targetOffsetY) {
            propChanges.push(`Offset: (${baselineOffsetX}, ${baselineOffsetY}) → (${targetOffsetX}, ${targetOffsetY})`);
          }

          // Compare spread
          if (baselineEffect.spread !== targetEffect.spread) {
            propChanges.push(`Spread: ${baselineEffect.spread || 0}px → ${targetEffect.spread || 0}px`);
          }

          // Compare color
          if (baselineEffect.color && targetEffect.color) {
            const baselineColorStr = `rgba(${Math.round((baselineEffect.color.r || 0) * 255)},${Math.round((baselineEffect.color.g || 0) * 255)},${Math.round((baselineEffect.color.b || 0) * 255)},${(baselineEffect.color.a !== undefined ? baselineEffect.color.a : 1).toFixed(2)})`;
            const targetColorStr = `rgba(${Math.round((targetEffect.color.r || 0) * 255)},${Math.round((targetEffect.color.g || 0) * 255)},${Math.round((targetEffect.color.b || 0) * 255)},${(targetEffect.color.a !== undefined ? targetEffect.color.a : 1).toFixed(2)})`;

            if (baselineColorStr !== targetColorStr) {
              propChanges.push(`Color: ${baselineColorStr} → ${targetColorStr}`);
            }
          }

          // Compare blend mode
          if (baselineEffect.blendMode !== targetEffect.blendMode) {
            propChanges.push(`Blend mode: ${baselineEffect.blendMode || "NORMAL"} → ${targetEffect.blendMode || "NORMAL"}`);
          }

          // Compare visibility
          if (baselineEffect.visible !== targetEffect.visible) {
            propChanges.push(`Visibility: ${baselineEffect.visible ? "visible" : "hidden"} → ${targetEffect.visible ? "visible" : "hidden"}`);
          }
        }

        differences.push({
          type: "CHANGED",
          category: "effectStyle",
          name: baselineName,
          fromValue: baselineValue,
          toValue: targetValue,
          details: propChanges.length > 0 ? propChanges.join(" | ") : undefined,
          collectionName: "Effect Styles",
          migrationHint: `Update effect style "${baselineName}"`
        });
      }
    } else {
      const targetStylesWithSameValue = targetEffectByValue.get(baselineValue);

      if (targetStylesWithSameValue && targetStylesWithSameValue.length > 0) {
        const renamedTo = targetStylesWithSameValue[0];
        processedTargetEffectNames.add(renamedTo.name);

        differences.push({
          type: "RENAMED",
          category: "effectStyle",
          name: `${baselineName} → ${renamedTo.name}`,
          fromValue: baselineValue,
          toValue: baselineValue,
          collectionName: "Effect Styles",
          migrationHint: `Replace effect style "${baselineName}" with "${renamedTo.name}"`
        });
      } else {
        differences.push({
          type: "REMOVED",
          category: "effectStyle",
          name: baselineName,
          fromValue: baselineValue,
          collectionName: "Effect Styles",
          migrationHint: `Effect style "${baselineName}" was removed`
        });
      }
    }
  }

  for (const targetStyle of targetEffectStyles) {
    if (!processedTargetEffectNames.has(targetStyle.name)) {
      const targetValue = formatEffectStyle(targetStyle.effects);
      const baselineWithSameValue = baselineEffectByValue.get(targetValue);

      if (!baselineWithSameValue || baselineWithSameValue.length === 0) {
        differences.push({
          type: "NEW",
          category: "effectStyle",
          name: targetStyle.name,
          toValue: targetValue,
          collectionName: "Effect Styles",
          migrationHint: `New effect style: "${targetStyle.name}"`
        });
      }
    }
  }

  // Compare components
  const baselineComponents = baseline.components || [];
  const targetComponents = target.components || [];

  // Helper to extract base name (before variant properties like "State=Focused")
  function getBaseName(compName: string): string {
    // Remove variant properties like "State=X, Type=Y"
    const match = compName.match(/^([^,=]+)/);
    return match ? match[1].trim() : compName;
  }

  // Group components by base name
  const baselineByBaseName = new Map<string, any[]>();
  const targetByBaseName = new Map<string, any[]>();

  for (const comp of baselineComponents) {
    const baseName = getBaseName(comp.name);
    if (!baselineByBaseName.has(baseName)) {
      baselineByBaseName.set(baseName, []);
    }
    baselineByBaseName.get(baseName)!.push(comp);
  }

  for (const comp of targetComponents) {
    const baseName = getBaseName(comp.name);
    if (!targetByBaseName.has(baseName)) {
      targetByBaseName.set(baseName, []);
    }
    targetByBaseName.get(baseName)!.push(comp);
  }

  // Process component groups
  const processedTargetComps = new Set<string>();
  const allBaseNames = new Set([...baselineByBaseName.keys(), ...targetByBaseName.keys()]);

  for (const baseName of allBaseNames) {
    const baselineVariants = baselineByBaseName.get(baseName) || [];
    const targetVariants = targetByBaseName.get(baseName) || [];

    if (baselineVariants.length === 0) {
      // New component group
      for (const variant of targetVariants) {
        processedTargetComps.add(variant.name);
      }
      differences.push({
        type: "NEW",
        category: "component",
        name: `New component: "${baseName}"`,
        toValue: `${targetVariants.length} variant(s)`,
        collectionName: targetVariants[0]?.pageName || "Components",
        migrationHint: `New component group with ${targetVariants.length} variants`
      });
    } else if (targetVariants.length === 0) {
      // Removed component group
      differences.push({
        type: "REMOVED",
        category: "component",
        name: `Removed component: "${baseName}"`,
        fromValue: `${baselineVariants.length} variant(s) removed`,
        collectionName: baselineVariants[0]?.pageName || "Components",
        migrationHint: `Component group removed with ${baselineVariants.length} variants`
      });
    } else {
      // Component exists in both - compare variant counts
      if (baselineVariants.length !== targetVariants.length) {
        differences.push({
          type: "INSIGHT",
          category: "component",
          name: `"${baseName}" variant count changed`,
          fromValue: `Geiger: ${baselineVariants.length} variants`,
          toValue: `Unified: ${targetVariants.length} variants`,
          collectionName: baselineVariants[0]?.pageName || "Components",
          migrationHint: `Variant count changed from ${baselineVariants.length} to ${targetVariants.length}`
        });
      }

      // Compare individual variants
      for (const baselineComp of baselineVariants) {
        const targetComp = targetVariants.find((c: any) => c.name === baselineComp.name);

        if (targetComp) {
          processedTargetComps.add(targetComp.name);

          // Compare detailed properties
          const propChanges: string[] = [];

          if (baselineComp.width !== targetComp.width) {
            propChanges.push(`width: ${baselineComp.width}px → ${targetComp.width}px`);
          }
          if (baselineComp.height !== targetComp.height) {
            propChanges.push(`height: ${baselineComp.height}px → ${targetComp.height}px`);
          }

          // Compare corner radius
          const baselineRadius = JSON.stringify(baselineComp.cornerRadius);
          const targetRadius = JSON.stringify(targetComp.cornerRadius);
          if (baselineRadius !== targetRadius && baselineComp.cornerRadius && targetComp.cornerRadius) {
            if (typeof baselineComp.cornerRadius === 'number' && typeof targetComp.cornerRadius === 'number') {
              propChanges.push(`corner radius: ${baselineComp.cornerRadius}px → ${targetComp.cornerRadius}px`);
            } else {
              propChanges.push(`corner radius changed`);
            }
          }

          // Compare padding
          if (baselineComp.layout && targetComp.layout) {
            const baselinePadding = `${baselineComp.layout.paddingTop}/${baselineComp.layout.paddingRight}/${baselineComp.layout.paddingBottom}/${baselineComp.layout.paddingLeft}`;
            const targetPadding = `${targetComp.layout.paddingTop}/${targetComp.layout.paddingRight}/${targetComp.layout.paddingBottom}/${targetComp.layout.paddingLeft}`;
            if (baselinePadding !== targetPadding) {
              propChanges.push(`padding: ${baselinePadding} → ${targetPadding}`);
            }

            // Compare spacing
            if (baselineComp.layout.itemSpacing !== targetComp.layout.itemSpacing) {
              propChanges.push(`spacing: ${baselineComp.layout.itemSpacing}px → ${targetComp.layout.itemSpacing}px`);
            }
          }

          // Compare fills
          const baselineFills = (baselineComp.fills || []).join(", ");
          const targetFills = (targetComp.fills || []).join(", ");
          if (baselineFills !== targetFills) {
            propChanges.push(`fill: ${baselineFills || "none"} → ${targetFills || "none"}`);
          }

          // Compare strokes
          const baselineStrokes = (baselineComp.strokes || []).join(", ");
          const targetStrokes = (targetComp.strokes || []).join(", ");
          if (baselineStrokes !== targetStrokes) {
            propChanges.push(`stroke: ${baselineStrokes || "none"} → ${targetStrokes || "none"}`);
          }

          if (baselineComp.strokeWeight !== targetComp.strokeWeight) {
            propChanges.push(`stroke weight: ${baselineComp.strokeWeight || 0}px → ${targetComp.strokeWeight || 0}px`);
          }

          if (propChanges.length > 0) {
            differences.push({
              type: "CHANGED",
              category: "component",
              name: baselineComp.name,
              fromValue: propChanges.join(" | "),
              toValue: "",
              collectionName: baselineComp.pageName,
              migrationHint: `Properties changed: ${propChanges.join(", ")}`
            });
          }
        } else {
          // Variant removed
          differences.push({
            type: "REMOVED",
            category: "component",
            name: baselineComp.name,
            fromValue: `Removed variant`,
            collectionName: baselineComp.pageName,
            migrationHint: `Variant removed from "${baseName}"`
          });
        }
      }

      // Check for new variants
      for (const targetComp of targetVariants) {
        if (!processedTargetComps.has(targetComp.name)) {
          processedTargetComps.add(targetComp.name);
          const fills = (targetComp.fills || []).join(", ");
          const strokes = (targetComp.strokes || []).join(", ");

          differences.push({
            type: "NEW",
            category: "component",
            name: targetComp.name,
            toValue: `${targetComp.width}x${targetComp.height}, fill: ${fills || "none"}, stroke: ${strokes || "none"}`,
            collectionName: targetComp.pageName,
            migrationHint: `New variant added to "${baseName}"`
          });
        }
      }
    }
  }

  // Add page-level component analysis (e.g., icon size changes)
  const pageInsights = analyzePageComponents(baselineComponents, targetComponents);

  // Add structural insights
  const insights = analyzeStructuralChanges(differences);

  // Generate recommendations based on industry best practices
  const recommendations = generateRecommendations(targetComponents, target);

  return pageInsights.concat(insights).concat(recommendations).concat(differences);
}

function generateRecommendations(targetComponents: any[], targetPalette: any): any[] {
  const recommendations: any[] = [];

  // Define enterprise design system best practices
  const BEST_PRACTICES = {
    essentialComponents: [
      { name: 'Button', states: ['Default', 'Hover', 'Active', 'Disabled', 'Focus', 'Loading'] },
      { name: 'Input', states: ['Default', 'Hover', 'Focus', 'Disabled', 'Error', 'Success'] },
      { name: 'Card', states: ['Default', 'Hover', 'Active'] },
      { name: 'Modal', states: ['Default'] },
      { name: 'Toast', states: ['Success', 'Error', 'Warning', 'Info'] },
      { name: 'Alert', states: ['Success', 'Error', 'Warning', 'Info'] },
      { name: 'Checkbox', states: ['Unchecked', 'Checked', 'Indeterminate', 'Disabled'] },
      { name: 'Radio', states: ['Unchecked', 'Checked', 'Disabled'] },
      { name: 'Toggle', states: ['Off', 'On', 'Disabled'] },
      { name: 'Dropdown', states: ['Default', 'Open', 'Disabled'] },
      { name: 'Table', states: ['Default'] },
      { name: 'Tabs', states: ['Default', 'Active', 'Disabled'] },
      { name: 'Badge', states: ['Default'] },
      { name: 'Avatar', states: ['Default'] },
      { name: 'Tooltip', states: ['Default'] },
      { name: 'Spinner', states: ['Default'] },
      { name: 'Breadcrumb', states: ['Default'] },
      { name: 'Pagination', states: ['Default'] },
      { name: 'Tag', states: ['Default'] }
    ],
    requiredStates: ['Hover', 'Active', 'Focus', 'Disabled']
  };

  // Extract existing component names (normalize)
  const existingComponents = new Set<string>();
  for (const comp of targetComponents) {
    // Extract base component name (before State= or Type=)
    const baseName = comp.name.split(/[,=]/)[0].trim().toLowerCase();
    existingComponents.add(baseName);
  }

  // Check for missing essential components
  for (const essential of BEST_PRACTICES.essentialComponents) {
    const normalizedName = essential.name.toLowerCase();
    const exists = Array.from(existingComponents).some(name =>
      name.includes(normalizedName) || normalizedName.includes(name)
    );

    if (!exists) {
      recommendations.push({
        type: "INSIGHT",
        category: "recommendation",
        name: `Missing component: ${essential.name}`,
        toValue: `Recommended states: ${essential.states.join(', ')}`,
        collectionName: "Recommendations",
        migrationHint: `${essential.name} is a common component in enterprise design systems (Material, Carbon, Fluent)`
      });
    }
  }

  // Check for missing states in existing components
  const componentGroups = new Map<string, Set<string>>();

  for (const comp of targetComponents) {
    const baseName = comp.name.split(/[,=]/)[0].trim();

    if (!componentGroups.has(baseName)) {
      componentGroups.set(baseName, new Set());
    }

    // Extract state from variantProperties or name
    if (comp.variantProperties && comp.variantProperties.State) {
      componentGroups.get(baseName)!.add(comp.variantProperties.State);
    } else if (comp.name.includes('State=')) {
      const stateMatch = comp.name.match(/State=([^,]+)/);
      if (stateMatch) {
        componentGroups.get(baseName)!.add(stateMatch[1].trim());
      }
    }
  }

  // Check each component group for missing recommended states
  // These should go to the component's own collection, not "Recommendations"
  for (const [compName, existingStates] of componentGroups) {
    const normalizedCompName = compName.toLowerCase();

    // Find matching best practice
    const bestPractice = BEST_PRACTICES.essentialComponents.find(bp =>
      normalizedCompName.includes(bp.name.toLowerCase()) || bp.name.toLowerCase().includes(normalizedCompName)
    );

    if (bestPractice && existingStates.size > 0) {
      const missingStates = bestPractice.states.filter(state => !existingStates.has(state));

      if (missingStates.length > 0) {
        // Find the page/collection name for this component
        const componentExample = targetComponents.find(c => c.name.startsWith(compName));
        const pageName = componentExample?.pageName || "Components";

        recommendations.push({
          type: "INSIGHT",
          category: "recommendation",
          name: `Recommended: Add missing states`,
          toValue: `${missingStates.join(', ')}`,
          collectionName: pageName,
          migrationHint: `These states are recommended for ${compName} based on enterprise design systems (Material, Carbon, Fluent)`
        });
      }
    }
  }

  // Check component groups for focus states (per component, not per variant)
  const componentGroupsMissingFocus = new Set<string>();

  for (const [compName, existingStates] of componentGroups) {
    const normalizedCompName = compName.toLowerCase();
    const isInteractive = normalizedCompName.includes('button') || normalizedCompName.includes('input') ||
                          normalizedCompName.includes('checkbox') || normalizedCompName.includes('radio') ||
                          normalizedCompName.includes('toggle') || normalizedCompName.includes('link');

    if (isInteractive && !existingStates.has('Focus') && !existingStates.has('Focused')) {
      componentGroupsMissingFocus.add(compName);
    }
  }

  // Add focus state recommendations to each component's own collection
  for (const baseName of componentGroupsMissingFocus) {
    const componentExample = targetComponents.find(c => c.name.startsWith(baseName));
    const pageName = componentExample?.pageName || "Components";

    recommendations.push({
      type: "INSIGHT",
      category: "recommendation",
      name: `Accessibility: Add Focus state`,
      toValue: `Required for WCAG 2.1 keyboard navigation (Level AA)`,
      collectionName: pageName,
      migrationHint: `${baseName} is interactive but lacks a Focus state variant`
    });
  }

  return recommendations;
}

function analyzePageComponents(baselineComponents: any[], targetComponents: any[]): any[] {
  const insights: any[] = [];

  // Group components by page
  const baselineByPage = new Map<string, any[]>();
  const targetByPage = new Map<string, any[]>();

  for (const comp of baselineComponents) {
    if (!baselineByPage.has(comp.pageName)) {
      baselineByPage.set(comp.pageName, []);
    }
    baselineByPage.get(comp.pageName)!.push(comp);
  }

  for (const comp of targetComponents) {
    if (!targetByPage.has(comp.pageName)) {
      targetByPage.set(comp.pageName, []);
    }
    targetByPage.get(comp.pageName)!.push(comp);
  }

  // Look for page name variations (e.g., "Iconography" vs "Icons")
  const pageNameMap = new Map<string, string>();
  for (const baselinePage of baselineByPage.keys()) {
    // Simple fuzzy match: check if page names are similar
    for (const targetPage of targetByPage.keys()) {
      if (baselinePage.toLowerCase().includes("icon") && targetPage.toLowerCase().includes("icon")) {
        pageNameMap.set(baselinePage, targetPage);
      } else if (baselinePage.toLowerCase().includes("typo") && targetPage.toLowerCase().includes("typo")) {
        pageNameMap.set(baselinePage, targetPage);
      } else if (baselinePage.toLowerCase().includes("button") && targetPage.toLowerCase().includes("button")) {
        pageNameMap.set(baselinePage, targetPage);
      }
    }
  }

  // Analyze matched pages
  for (const [baselinePage, targetPage] of pageNameMap) {
    const baselineComps = baselineByPage.get(baselinePage) || [];
    const targetComps = targetByPage.get(targetPage) || [];

    // Calculate most common size (mode)
    const baselineSizes = new Map<string, number>();
    const targetSizes = new Map<string, number>();

    for (const comp of baselineComps) {
      const sizeKey = `${Math.round(comp.width)}x${Math.round(comp.height)}`;
      baselineSizes.set(sizeKey, (baselineSizes.get(sizeKey) || 0) + 1);
    }

    for (const comp of targetComps) {
      const sizeKey = `${Math.round(comp.width)}x${Math.round(comp.height)}`;
      targetSizes.set(sizeKey, (targetSizes.get(sizeKey) || 0) + 1);
    }

    const baselineCommonSize = Array.from(baselineSizes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const targetCommonSize = Array.from(targetSizes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

    const changes: string[] = [];

    // Size change
    if (baselineCommonSize && targetCommonSize && baselineCommonSize !== targetCommonSize) {
      changes.push(`Size: ${baselineCommonSize} → ${targetCommonSize}`);
    }

    // Count change
    if (baselineComps.length !== targetComps.length) {
      changes.push(`Count: ${baselineComps.length} → ${targetComps.length} components`);
    }

    // Stroke weight change (if applicable)
    const baselineStrokes = baselineComps.filter(c => c.strokeWeight).map(c => c.strokeWeight);
    const targetStrokes = targetComps.filter(c => c.strokeWeight).map(c => c.strokeWeight);
    if (baselineStrokes.length > 0 && targetStrokes.length > 0) {
      const baselineAvgStroke = baselineStrokes.reduce((sum, s) => sum + s, 0) / baselineStrokes.length;
      const targetAvgStroke = targetStrokes.reduce((sum, s) => sum + s, 0) / targetStrokes.length;
      if (Math.abs(baselineAvgStroke - targetAvgStroke) > 0.1) {
        changes.push(`Stroke: ${baselineAvgStroke.toFixed(1)}px → ${targetAvgStroke.toFixed(1)}px`);
      }
    }

    if (changes.length > 0) {
      insights.push({
        type: "INSIGHT",
        category: "component",
        name: `Page "${baselinePage}" → "${targetPage}" system changes`,
        fromValue: changes.join(" | "),
        toValue: "",
        collectionName: targetPage,
        migrationHint: `Component system properties changed on this page`
      });
    }
  }

  return insights;
}

function analyzeStructuralChanges(differences: any[]): any[] {
  const insights: any[] = [];

  // Group differences by collection
  const byCollection = new Map<string, any[]>();
  for (const diff of differences) {
    if (diff.category === "variable" && diff.collectionName) {
      if (!byCollection.has(diff.collectionName)) {
        byCollection.set(diff.collectionName, []);
      }
      byCollection.get(diff.collectionName)!.push(diff);
    }
  }

  // Analyze each collection for patterns
  for (const [collectionName, diffs] of byCollection) {
    // Extract path segments from variable names
    const baselineNames = new Set<string>();
    const targetNames = new Set<string>();

    for (const diff of diffs) {
      if (diff.type === "REMOVED") {
        baselineNames.add(diff.name);
      } else if (diff.type === "NEW") {
        targetNames.add(diff.name);
      } else if (diff.type === "RENAMED") {
        // Format: "oldName → newName"
        const parts = diff.name.split(" → ");
        if (parts.length === 2) {
          baselineNames.add(parts[0]);
          targetNames.add(parts[1]);
        }
      } else if (diff.type === "CHANGED") {
        baselineNames.add(diff.name);
        targetNames.add(diff.name);
      }
    }

    // Only analyze path segment renames (keep this, it's useful)
    const segmentRenames = findSegmentRenames(Array.from(baselineNames), Array.from(targetNames));

    for (const [oldSegment, newSegment] of segmentRenames) {
      insights.push({
        type: "INSIGHT",
        category: "structural",
        name: `Path segment renamed: "${oldSegment}" → "${newSegment}"`,
        fromValue: `Found in multiple variable paths`,
        toValue: `Affects ${countAffectedPaths(diffs, oldSegment, newSegment)} variables`,
        collectionName: collectionName
      });
    }

    // Removed: "New variant" and "Removed variant" insights
    // These were confusing for variable collections
    // Component variant insights are already handled in component comparison
  }

  return insights;
}

function findSegmentRenames(baselineNames: string[], targetNames: string[]): Map<string, string> {
  const renames = new Map<string, string>();

  // Extract all path segments
  const baselineSegments = new Map<string, number>();
  const targetSegments = new Map<string, number>();

  for (const name of baselineNames) {
    const segments = name.split("/");
    for (const seg of segments) {
      baselineSegments.set(seg, (baselineSegments.get(seg) || 0) + 1);
    }
  }

  for (const name of targetNames) {
    const segments = name.split("/");
    for (const seg of segments) {
      targetSegments.set(seg, (targetSegments.get(seg) || 0) + 1);
    }
  }

  // Find segments that disappeared from baseline and appeared in target with similar frequency
  for (const [baseSeg, baseCount] of baselineSegments) {
    if (!targetSegments.has(baseSeg) && baseCount > 3) { // Only consider if appears multiple times
      // Look for a target segment with similar frequency
      for (const [targetSeg, targetCount] of targetSegments) {
        if (!baselineSegments.has(targetSeg) && Math.abs(targetCount - baseCount) <= 2) {
          // Check if the paths match structurally (same positions, just different segment)
          if (pathsMatchExceptSegment(baselineNames, targetNames, baseSeg, targetSeg)) {
            renames.set(baseSeg, targetSeg);
            break;
          }
        }
      }
    }
  }

  return renames;
}

function pathsMatchExceptSegment(baselineNames: string[], targetNames: string[], oldSeg: string, newSeg: string): boolean {
  let matches = 0;

  for (const baseName of baselineNames) {
    if (baseName.includes(oldSeg)) {
      const targetEquivalent = baseName.replace(oldSeg, newSeg);
      if (targetNames.includes(targetEquivalent)) {
        matches++;
      }
    }
  }

  return matches > 2; // Need at least 3 matches to confirm pattern
}

function countAffectedPaths(diffs: any[], oldSegment: string, newSegment: string): number {
  let count = 0;
  for (const diff of diffs) {
    if (diff.name && (diff.name.includes(oldSegment) || diff.name.includes(newSegment))) {
      count++;
    }
  }
  return count;
}

function extractTopLevelSegments(names: string[]): string[] {
  const topLevel = new Set<string>();
  for (const name of names) {
    const segments = name.split("/");
    if (segments.length > 0) {
      topLevel.add(segments[0]);
    }
  }
  return Array.from(topLevel);
}

function formatValue(valuesByMode: any, resolvedType: string): string {
  if (!valuesByMode || Object.keys(valuesByMode).length === 0) {
    return "undefined";
  }

  // Use first mode
  const firstModeId = Object.keys(valuesByMode)[0];
  const value = valuesByMode[firstModeId];

  // Check for alias first (works for all types)
  if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
    return `[unresolved alias]`;
  }

  if (resolvedType === "COLOR") {
    if (typeof value === 'object' && value !== null && 'r' in value) {
      const r = Math.round(value.r * 255);
      const g = Math.round(value.g * 255);
      const b = Math.round(value.b * 255);
      const a = value.a !== undefined ? value.a.toFixed(2) : "1.00";
      return `rgba(${r},${g},${b},${a})`;
    }
    return "color";
  } else if (resolvedType === "FLOAT") {
    if (typeof value === 'number') {
      return value.toString();
    }
    return "number";
  } else if (resolvedType === "STRING") {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return "string";
  } else if (resolvedType === "BOOLEAN") {
    if (typeof value === 'boolean') {
      return String(value);
    }
    return "boolean";
  }

  // Fallback for primitive types
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }

  // If it's still an object, try to extract meaningful info
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return "unknown";
}

function formatPaintStyle(paints: any[]): string {
  if (!paints || paints.length === 0) return "none";

  const paint = paints[0];
  if (paint.type === "SOLID" && paint.color) {
    const r = Math.round(paint.color.r * 255);
    const g = Math.round(paint.color.g * 255);
    const b = Math.round(paint.color.b * 255);
    const a = paint.opacity !== undefined ? paint.opacity.toFixed(2) : "1.00";
    return `rgba(${r},${g},${b},${a})`;
  }

  return paint.type || "unknown";
}

function formatTextStyle(style: any): string {
  const parts = [];
  if (style.fontFamily) parts.push(style.fontFamily);
  if (style.fontSize) parts.push(`${style.fontSize}px`);
  if (style.fontWeight) parts.push(style.fontWeight);
  return parts.join(" ");
}

function formatEffectStyle(effects: any[]): string {
  if (!effects || effects.length === 0) return "none";

  const effect = effects[0];
  if (effect.type === "DROP_SHADOW") {
    return `drop-shadow(${effect.offset?.x || 0}px ${effect.offset?.y || 0}px ${effect.radius || 0}px)`;
  }

  return effect.type || "unknown";
}
