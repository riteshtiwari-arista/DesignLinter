// Design System Variable Catalog
// Loads and indexes all variables from enabled team libraries

export type DSVarRef = {
  collectionKey: string;
  collectionName: string;
  variableKey: string;
  variableName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  libraryName?: string;
};

export type DSCatalog = {
  loadedAt: number;
  selectedLibraryKey?: string;
  collectionsByKey: Map<string, any>;
  variablesByKey: Map<string, any>;
  colorsByRgba: Map<string, DSVarRef[]>;
  numbersByValue: Map<string, DSVarRef[]>;
  stringsByValue: Map<string, DSVarRef[]>;
  booleansByValue: Map<string, DSVarRef[]>;
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
  };

  try {
    // Get all library variable collections
    const allCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    // Debug: Show all library names
    console.log("All available libraries:");
    const uniqueLibraries = new Set(allCollections.map(col => col.libraryName));
    uniqueLibraries.forEach(lib => console.log(`  - "${lib}"`));

    // Filter collections based on selected library (if any)
    const collections = selectedLibraryKey
      ? allCollections.filter(col => {
          const matches = col.libraryName === selectedLibraryKey;
          if (!matches) {
            console.log(`Skipping collection "${col.name}" from library "${col.libraryName}" (looking for "${selectedLibraryKey}")`);
          }
          return matches;
        })
      : allCollections;

    console.log(`Found ${allCollections.length} total collections, using ${collections.length} based on selection`);
    progressCallback?.(`Found ${collections.length} library collections`);

    if (collections.length === 0) {
      console.warn("No library collections found!");
      console.warn("Make sure you have enabled a Design System library in Assets → Team Libraries");
    }

    // PASS 1: Import all variables from all collections first
    console.log("=== PASS 1: Importing all variables ===");
    const allVariableMetadata: Array<{ varMeta: any, collection: any }> = [];
    let totalVarKeys = 0;

    for (const collection of collections) {
      catalog.collectionsByKey.set(collection.key, collection);

      try {
        const libraryVarMetadata = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
        console.log(`  Collection: ${collection.name} - ${libraryVarMetadata.length} variables`);
        totalVarKeys += libraryVarMetadata.length;

        // Import all variables to populate the cache
        for (const varMeta of libraryVarMetadata) {
          try {
            const variable = await figma.variables.importVariableByKeyAsync(varMeta.key);
            importedVariables.set(varMeta.key, variable);
            variableCache.set(variable.id, variable);
            variableCache.set(varMeta.key, variable);
            catalog.variablesByKey.set(varMeta.key, varMeta);

            // Store for second pass
            allVariableMetadata.push({ varMeta, collection });
          } catch (err) {
            console.warn(`    Could not import variable "${varMeta.name}":`, err);
          }
        }
      } catch (err) {
        console.warn(`Could not load variables for collection ${collection.name}:`, err);
      }
    }

    console.log(`Imported ${variableCache.size} variables into cache`);

    // PASS 2: Now resolve and index all variables
    console.log("=== PASS 2: Resolving and indexing ===");
    let collectionIndex = 0;
    let currentCollectionName = "";

    for (const { varMeta, collection } of allVariableMetadata) {
      // Track which collection we're processing for progress updates
      if (collection.name !== currentCollectionName) {
        collectionIndex++;
        currentCollectionName = collection.name;
        console.log(`  Processing collection: ${collection.name}`);
        progressCallback?.(`Processing collection ${collectionIndex}/${collections.length}: ${collection.name}`);
      }

      const variable = variableCache.get(varMeta.key);
      if (!variable) continue;

      const varRef: DSVarRef = {
        collectionKey: collection.key,
        collectionName: collection.name,
        variableKey: varMeta.key,
        variableName: varMeta.name,
        resolvedType: varMeta.resolvedType,
        libraryName: (collection as any).libraryName || collection.name
      };

      // Index by resolved values
      if (varMeta.resolvedType === "COLOR") {
        let indexed = false;

        for (const modeId in variable.valuesByMode) {
          // Use recursive resolver for both concrete and alias values
          const rgba = await resolveColorVariableToRGBA(variable.id, modeId);

          if (rgba) {
            const key = normalizeRgba(rgba);

            if (!catalog.colorsByRgba.has(key)) {
              catalog.colorsByRgba.set(key, []);
            }
            catalog.colorsByRgba.get(key)!.push(varRef);
            indexed = true;

            // Log first few colors for debugging
            if (catalog.colorsByRgba.size <= 5) {
              const valueType = isAlias(variable.valuesByMode[modeId]) ? "alias" : "concrete";
              console.log(`    Indexed ${valueType} color "${varMeta.name}": ${key}`);
            }
          }
        }

        if (!indexed) {
          console.warn(`    Could not resolve color "${varMeta.name}"`);
        }
      } else if (varMeta.resolvedType === "FLOAT") {
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
      } else if (varMeta.resolvedType === "STRING") {
        for (const modeId in variable.valuesByMode) {
          const value = variable.valuesByMode[modeId];
          if (typeof value === 'string') {
            if (!catalog.stringsByValue.has(value)) {
              catalog.stringsByValue.set(value, []);
            }
            catalog.stringsByValue.get(value)!.push(varRef);
          }
        }
      } else if (varMeta.resolvedType === "BOOLEAN") {
        for (const modeId in variable.valuesByMode) {
          const value = String(variable.valuesByMode[modeId]);

          if (!catalog.booleansByValue.has(value)) {
            catalog.booleansByValue.set(value, []);
          }
          catalog.booleansByValue.get(value)!.push(varRef);
        }
      }
    }

    console.log(`=== Catalog Summary ===`);
    console.log(`  Total collections: ${catalog.collectionsByKey.size}`);
    console.log(`  Total variable keys found: ${totalVarKeys}`);
    console.log(`  Total variables: ${catalog.variablesByKey.size}`);
    console.log(`  Color lookup keys: ${catalog.colorsByRgba.size}`);
    console.log(`  Number lookup keys: ${catalog.numbersByValue.size}`);
    console.log(`  String lookup keys: ${catalog.stringsByValue.size}`);
    console.log(`  Boolean lookup keys: ${catalog.booleansByValue.size}`);

    // Show sample of what's indexed
    if (catalog.colorsByRgba.size > 0) {
      const sampleKeys = Array.from(catalog.colorsByRgba.keys()).slice(0, 3);
      console.log(`  Sample color keys:`, sampleKeys);
    }

    progressCallback?.(`Catalog ready: ${catalog.colorsByRgba.size} colors indexed`);

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

// Lazy import a variable by key (only when needed)
export async function importVariableByKey(varKey: string): Promise<Variable | null> {
  // Check cache first
  if (importedVariables.has(varKey)) {
    const cached = importedVariables.get(varKey)!;
    console.log(`Using cached variable: ${cached.name}`);
    return cached;
  }

  try {
    console.log(`Importing variable by key: ${varKey}`);
    const variable = await figma.variables.importVariableByKeyAsync(varKey);
    console.log(`Successfully imported: ${variable.name} (ID: ${variable.id})`);
    importedVariables.set(varKey, variable);
    return variable;
  } catch (err) {
    console.error(`FAILED to import variable ${varKey}:`, err);
    return null;
  }
}

// Get imported variable (if already imported)
export function getImportedVariable(varKey: string): Variable | null {
  return importedVariables.get(varKey) || null;
}
