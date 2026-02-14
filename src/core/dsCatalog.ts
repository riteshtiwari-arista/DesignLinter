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
  collectionsByKey: Map<string, any>;
  variablesByKey: Map<string, any>;
  colorsByRgba: Map<string, DSVarRef[]>;
  numbersByValue: Map<string, DSVarRef[]>;
  stringsByValue: Map<string, DSVarRef[]>;
  booleansByValue: Map<string, DSVarRef[]>;
};

let DS_CATALOG: DSCatalog | null = null;
const importedVariables = new Map<string, Variable>();

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
  selectedLibraryKeys?: string[],
  progressCallback?: (message: string) => void
): Promise<DSCatalog> {
  console.log("=== Loading DS Catalog ===");
  progressCallback?.("Loading design system catalog...");

  const catalog: DSCatalog = {
    loadedAt: Date.now(),
    collectionsByKey: new Map(),
    variablesByKey: new Map(),
    colorsByRgba: new Map(),
    numbersByValue: new Map(),
    stringsByValue: new Map(),
    booleansByValue: new Map(),
  };

  try {
    // Get all library variable collections
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    console.log(`Found ${collections.length} library variable collections`);
    progressCallback?.(`Found ${collections.length} library collections`);

    if (collections.length === 0) {
      console.warn("No library collections found!");
      console.warn("Make sure you have enabled a Design System library in Assets → Team Libraries");
    }

    let totalVarKeys = 0;
    let collectionIndex = 0;

    for (const collection of collections) {
      collectionIndex++;
      catalog.collectionsByKey.set(collection.key, collection);
      console.log(`  Collection: ${collection.name} (${collection.key})`);
      progressCallback?.(`Loading collection ${collectionIndex}/${collections.length}: ${collection.name}`);

      // Get variables in this collection (metadata only - no values yet)
      try {
        const libraryVarMetadata = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
        console.log(`    Library variables: ${libraryVarMetadata.length}`);
        totalVarKeys += libraryVarMetadata.length;

        // Import variables to get their actual values
        console.log(`    Importing variables to get values...`);
        progressCallback?.(`Importing ${libraryVarMetadata.length} variables from ${collection.name}...`);
        let importedCount = 0;

        for (let i = 0; i < libraryVarMetadata.length; i++) {
          const varMeta = libraryVarMetadata[i];

          // Show progress every 50 variables
          if (i % 50 === 0 && i > 0) {
            progressCallback?.(`Importing variables: ${i}/${libraryVarMetadata.length}...`);
          }

          try {
            // Import the variable to get its full data including values
            const variable = await figma.variables.importVariableByKeyAsync(varMeta.key);
            importedVariables.set(varMeta.key, variable);
            importedCount++;

            catalog.variablesByKey.set(varMeta.key, varMeta);

            const varRef: DSVarRef = {
              collectionKey: collection.key,
              collectionName: collection.name,
              variableKey: varMeta.key,
              variableName: varMeta.name,
              resolvedType: varMeta.resolvedType,
              libraryName: (collection as any).libraryName || collection.name
            };

            // Now index by actual values from the imported variable
            if (varMeta.resolvedType === "COLOR") {
              for (const modeId in variable.valuesByMode) {
                const value = variable.valuesByMode[modeId];
                // Skip alias references, only index concrete values
                if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
                  const key = normalizeRgba(value as RGBA);

                  if (!catalog.colorsByRgba.has(key)) {
                    catalog.colorsByRgba.set(key, []);
                  }
                  catalog.colorsByRgba.get(key)!.push(varRef);

                  // Log first few colors for debugging
                  if (catalog.colorsByRgba.size <= 5) {
                    console.log(`      Indexed color "${varMeta.name}": ${key}`);
                  }
                }
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
          } catch (err) {
            console.warn(`    Could not import variable "${varMeta.name}":`, err);
          }
        }

        console.log(`    Imported ${importedCount}/${libraryVarMetadata.length} variables`);
      } catch (err) {
        console.warn(`Could not load variables for collection ${collection.name}:`, err);
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

export async function ensureDSCatalogLoaded(progressCallback?: (message: string) => void): Promise<DSCatalog> {
  if (!DS_CATALOG) {
    return await loadDSCatalog(undefined, progressCallback);
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
