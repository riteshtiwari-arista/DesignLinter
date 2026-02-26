// Design System Catalog
// Loads design system resources from bundled palettes

import { getPaletteForLibrary, type DSPalette } from "../palettes";

export type DSVarRef = {
  collectionKey: string;
  collectionName: string;
  variableKey: string;
  variableName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  libraryName?: string;
};

export type DSStyleRef = {
  styleId: string;
  styleKey: string;
  styleName: string;
  libraryName?: string;
};

export type DSCatalog = {
  loadedAt: number;
  selectedLibraryKey?: string;

  // Variables
  collectionsByKey: Map<string, any>;
  variablesByKey: Map<string, any>;
  colorsByRgba: Map<string, DSVarRef[]>;
  numbersByValue: Map<string, DSVarRef[]>;
  stringsByValue: Map<string, DSVarRef[]>;
  booleansByValue: Map<string, DSVarRef[]>;

  // Paint Styles
  paintStylesByRgba: Map<string, DSStyleRef[]>;
  paintStyleNames: Set<string>;

  // Text Styles
  textStyleNames: Set<string>;

  // Effect Styles
  effectStyleNames: Set<string>;
};

let DS_CATALOG: DSCatalog | null = null;
const importedVariables = new Map<string, Variable>();
const variableCache = new Map<string, Variable>();

// Type guards
function isAlias(v: any): boolean {
  return v?.type === "VARIABLE_ALIAS";
}

function isRgba(v: any): v is RGBA {
  return v &&
    typeof v.r === "number" &&
    typeof v.g === "number" &&
    typeof v.b === "number" &&
    typeof v.a === "number";
}

// Get variable from cache or import
async function getVar(idOrKey: string): Promise<Variable | null> {
  if (variableCache.has(idOrKey)) {
    return variableCache.get(idOrKey)!;
  }

  let v: Variable | null = null;

  try {
    v = await figma.variables.getVariableByIdAsync(idOrKey);
  } catch {
    // If getById fails, try import by key
    try {
      v = await figma.variables.importVariableByKeyAsync(idOrKey);
    } catch {
      return null;
    }
  }

  if (v) {
    variableCache.set(v.id, v);
    if (idOrKey !== v.id) {
      variableCache.set(idOrKey, v); // Cache by both id and key
    }
  }

  return v;
}

// Recursive alias resolver with cycle protection
async function resolveColorVariableToRGBA(
  variableIdOrKey: string,
  modeId: string,
  visited = new Set<string>()
): Promise<RGBA | null> {
  const variable = await getVar(variableIdOrKey);
  if (!variable) return null;

  // Cycle protection
  if (visited.has(variable.id)) {
    console.warn(`Cycle detected resolving variable ${variable.name}`);
    return null;
  }
  visited.add(variable.id);

  let val = variable.valuesByMode[modeId];

  // If the requested mode doesn't exist, use the first available mode
  // This handles cross-collection aliases where mode IDs differ
  if (!val) {
    const availableModes = Object.keys(variable.valuesByMode);
    if (availableModes.length > 0) {
      val = variable.valuesByMode[availableModes[0]];
    } else {
      return null;
    }
  }

  // If it's concrete RGBA, return it
  if (isRgba(val)) {
    return val as RGBA;
  }

  // If it's an alias, recursively resolve it
  if (isAlias(val)) {
    return resolveColorVariableToRGBA((val as any).id, modeId, visited);
  }

  return null;
}

// Normalize RGBA to string key: "rgba(r,g,b,a)"
function normalizeRgba(color: RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Number(color.a.toFixed(3));
  return `rgba(${r},${g},${b},${a})`;
}

// Normalize number to string key
function normalizeNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export async function loadDSCatalog(
  selectedLibraryKey?: string,
  progressCallback?: (message: string) => void
): Promise<DSCatalog> {
  console.log("=== Loading DS Catalog ===");
  if (selectedLibraryKey) {
    console.log(`Filtering to library: ${selectedLibraryKey}`);
  }
  progressCallback?.("Loading design system catalog...");

  const catalog: DSCatalog = {
    loadedAt: Date.now(),
    selectedLibraryKey: selectedLibraryKey,
    collectionsByKey: new Map(),
    variablesByKey: new Map(),
    colorsByRgba: new Map(),
    numbersByValue: new Map(),
    stringsByValue: new Map(),
    booleansByValue: new Map(),
    paintStylesByRgba: new Map(),
    paintStyleNames: new Set(),
    textStyleNames: new Set(),
    effectStyleNames: new Set(),
  };

  try {
    // Load from bundled palette instead of team library
    const palette = getPaletteForLibrary(selectedLibraryKey);

    if (!palette) {
      console.warn(`No bundled palette found for library "${selectedLibraryKey}"`);
      console.warn(`Available palettes: ${Object.keys(require('../palettes').PALETTES).join(', ')}`);
      console.warn(`Please extract the palette from your DS file - see EXTRACT_PALETTE.md`);
      progressCallback?.("No palette found for selected library");
      DS_CATALOG = catalog;
      return catalog;
    }

    console.log(`=== Loading from Bundled Palette ===`);
    console.log(`  Library: ${selectedLibraryKey}`);
    console.log(`  Extracted: ${palette.metadata.extractedAt}`);
    console.log(`  Version: ${palette.metadata.version}`);

    // Index Paint Styles
    console.log(`\n=== Indexing Paint Styles ===`);
    progressCallback?.("Loading paint styles...");

    for (const style of palette.paintStyles) {
      catalog.paintStyleNames.add(style.name);

      // Index by resolved colors
      if (style.resolvedColors) {
        for (const color of style.resolvedColors) {
          const key = normalizeRgba(color);

          if (!catalog.paintStylesByRgba.has(key)) {
            catalog.paintStylesByRgba.set(key, []);
          }

          catalog.paintStylesByRgba.get(key)!.push({
            styleId: style.id,
            styleKey: style.key,
            styleName: style.name,
            libraryName: selectedLibraryKey
          });
        }
      }
    }

    console.log(`  Indexed ${palette.paintStyles.length} paint styles`);
    console.log(`  Color lookup keys: ${catalog.paintStylesByRgba.size}`);

    // Index Text Styles
    console.log(`\n=== Indexing Text Styles ===`);
    for (const style of palette.textStyles) {
      catalog.textStyleNames.add(style.name);
    }
    console.log(`  Indexed ${palette.textStyles.length} text styles`);

    // Index Effect Styles
    console.log(`\n=== Indexing Effect Styles ===`);
    for (const style of palette.effectStyles) {
      catalog.effectStyleNames.add(style.name);
    }
    console.log(`  Indexed ${palette.effectStyles.length} effect styles`);

    // Index Variables
    console.log(`\n=== Indexing Variables ===`);
    progressCallback?.("Loading variables...");

    let totalVars = 0;

    for (const collection of palette.variables.collections) {
      catalog.collectionsByKey.set(collection.id, collection);
      console.log(`  Collection: ${collection.name} - ${collection.variables.length} variables`);

      for (const variable of collection.variables) {
        totalVars++;
        // Index by key (used for importing)
        if (variable.key) {
          catalog.variablesByKey.set(variable.key, variable);
        }

        const varRef: DSVarRef = {
          collectionKey: collection.id,
          collectionName: collection.name,
          variableKey: variable.key || variable.id, // Prefer key, fallback to id
          variableName: variable.name,
          resolvedType: variable.resolvedType as any,
          libraryName: selectedLibraryKey
        };

        // Index by resolved values
        if (variable.resolvedType === "COLOR") {
          const uniqueColors = new Set<string>();

          // Collect all unique resolved RGBA values from resolvedValues
          if (variable.resolvedValues) {
            for (const modeId in variable.resolvedValues) {
              const rgba = variable.resolvedValues[modeId];
              if (rgba && typeof rgba === 'object' && 'r' in rgba) {
                const key = normalizeRgba(rgba);
                uniqueColors.add(key);
              }
            }
          }

          // Fallback: If no resolvedValues, try valuesByMode directly
          if (uniqueColors.size === 0 && variable.valuesByMode) {
            for (const modeId in variable.valuesByMode) {
              const value = variable.valuesByMode[modeId];
              if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
                const key = normalizeRgba(value);
                uniqueColors.add(key);
              }
            }
          }

          // Index each unique color
          for (const key of uniqueColors) {
            if (!catalog.colorsByRgba.has(key)) {
              catalog.colorsByRgba.set(key, []);
            }
            catalog.colorsByRgba.get(key)!.push(varRef);
          }
        } else if (variable.resolvedType === "FLOAT") {
          for (const modeId in variable.valuesByMode) {
            const value = variable.valuesByMode[modeId];
            if (typeof value === 'number') {
              const key = normalizeNumber(value);

              if (!catalog.numbersByValue.has(key)) {
                catalog.numbersByValue.set(key, []);
              }
              catalog.numbersByValue.get(key)!.push(varRef);
            }
          }
        } else if (variable.resolvedType === "STRING") {
          for (const modeId in variable.valuesByMode) {
            const value = variable.valuesByMode[modeId];
            if (typeof value === 'string') {
              if (!catalog.stringsByValue.has(value)) {
                catalog.stringsByValue.set(value, []);
              }
              catalog.stringsByValue.get(value)!.push(varRef);
            }
          }
        } else if (variable.resolvedType === "BOOLEAN") {
          for (const modeId in variable.valuesByMode) {
            const value = String(variable.valuesByMode[modeId]);

            if (!catalog.booleansByValue.has(value)) {
              catalog.booleansByValue.set(value, []);
            }
            catalog.booleansByValue.get(value)!.push(varRef);
          }
        }
      }
    }

    console.log(`  Indexed ${totalVars} variables from ${palette.variables.collections.length} collections`);

    console.log(`\n=== Catalog Summary ===`);
    console.log(`  Paint Styles: ${palette.paintStyles.length} (${catalog.paintStylesByRgba.size} color keys)`);
    console.log(`  Text Styles: ${palette.textStyles.length}`);
    console.log(`  Effect Styles: ${palette.effectStyles.length}`);
    console.log(`  Variable Collections: ${palette.variables.collections.length}`);
    console.log(`  Total Variables: ${totalVars}`);
    console.log(`  Color Variables: ${catalog.colorsByRgba.size} lookup keys`);
    console.log(`  Number Variables: ${catalog.numbersByValue.size} lookup keys`);
    console.log(`  String Variables: ${catalog.stringsByValue.size} lookup keys`);
    console.log(`  Boolean Variables: ${catalog.booleansByValue.size} lookup keys`);

    progressCallback?.(`Catalog ready: ${palette.paintStyles.length} styles, ${totalVars} variables indexed`);

  } catch (error) {
    console.error("Failed to load DS catalog:", error);
    progressCallback?.("Failed to load catalog");
  }

  DS_CATALOG = catalog;
  return catalog;
}

export async function ensureDSCatalogLoaded(
  selectedLibraryKey?: string,
  progressCallback?: (message: string) => void
): Promise<DSCatalog> {
  // Reload if catalog doesn't exist or if the selected library has changed
  if (!DS_CATALOG || DS_CATALOG.selectedLibraryKey !== selectedLibraryKey) {
    console.log(`Reloading catalog (library changed from "${DS_CATALOG?.selectedLibraryKey}" to "${selectedLibraryKey}")`);
    return await loadDSCatalog(selectedLibraryKey, progressCallback);
  }
  return DS_CATALOG;
}

export function getCatalog(): DSCatalog | null {
  return DS_CATALOG;
}

// Match a color value to DS variables
export function matchColor(color: RGBA): DSVarRef[] | null {
  const catalog = getCatalog();
  if (!catalog) {
    console.warn("matchColor called but catalog is null");
    return null;
  }

  const key = normalizeRgba(color);
  const matches = catalog.colorsByRgba.get(key) || null;

  // Log lookups for debugging (only first few)
  const totalLookups = (globalThis as any).__colorLookupCount || 0;
  if (totalLookups < 5) {
    console.log(`Color lookup: ${key}`);
    console.log(`  Input RGBA: r=${color.r.toFixed(3)}, g=${color.g.toFixed(3)}, b=${color.b.toFixed(3)}, a=${color.a.toFixed(3)}`);
    console.log(`  Result: ${matches ? `${matches.length} matches` : 'NO MATCH'}`);
    if (matches) {
      console.log(`  Matched: ${matches.map(m => m.variableName).join(', ')}`);
    }
    (globalThis as any).__colorLookupCount = totalLookups + 1;
  }

  return matches;
}

// Match a number value to DS variables
export function matchNumber(value: number): DSVarRef[] | null {
  const catalog = getCatalog();
  if (!catalog) return null;

  const key = normalizeNumber(value);
  return catalog.numbersByValue.get(key) || null;
}

// Match a color value to DS paint styles
export function matchPaintStyle(color: RGBA): DSStyleRef[] | null {
  const catalog = getCatalog();
  if (!catalog) return null;

  const key = normalizeRgba(color);
  return catalog.paintStylesByRgba.get(key) || null;
}

// Lazy import a variable by key (only when needed)
export async function importVariableByKey(varKey: string): Promise<Variable | null> {
  // Check cache first
  if (importedVariables.has(varKey)) {
    const cached = importedVariables.get(varKey)!;
    return cached;
  }

  try {
    // First, check if variable already exists in the file (might have been imported previously)
    const localVariables = figma.variables.getLocalVariables();
    const existingVar = localVariables.find(v => v.key === varKey);

    if (existingVar) {
      importedVariables.set(varKey, existingVar);
      return existingVar;
    }

    // Try importing directly by key
    try {
      const variable = await figma.variables.importVariableByKeyAsync(varKey);
      importedVariables.set(varKey, variable);
      return variable;
    } catch (importErr) {
      // Import by key failed - this is common for library variables
      // Fallback: Try finding and importing from library collections
      const catalog = getCatalog();
      if (!catalog.selectedLibraryKey) {
        throw new Error("No library selected");
      }

      // Get library variable collections
      const availableCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

      // Find the collection that contains this variable
      for (const collection of availableCollections) {
        if (collection.libraryName === catalog.selectedLibraryKey) {
          try {
            const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
            const libVar = variables.find(v => v.key === varKey);

            if (libVar) {
              // Found it! Import using the collection method
              const imported = await figma.variables.importVariableByKeyAsync(libVar.key);
              importedVariables.set(varKey, imported);
              return imported;
            }
          } catch (collErr) {
            // Continue to next collection
            continue;
          }
        }
      }

      throw importErr; // Re-throw original error if all fallbacks fail
    }
  } catch (err) {
    // All import methods failed
    return null;
  }
}

// Get imported variable (if already imported)
export function getImportedVariable(varKey: string): Variable | null {
  return importedVariables.get(varKey) || null;
}
