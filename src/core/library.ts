import type { LibraryInfo } from "./types";
import { getCachedLibraries, setCachedLibraries } from "./storage";

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function listEnabledLibraries(forceRefresh = false): Promise<LibraryInfo[]> {
  if (!forceRefresh) {
    const cached = await getCachedLibraries();
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.libraries;
    }
  }

  try {
    // Map: libraryName -> { name, collectionKeys[] }
    const libraryMap = new Map<string, { name: string; collectionKeys: string[] }>();

    // Use getAvailableLibraryVariableCollectionsAsync
    try {
      const variableCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

      for (const collection of variableCollections) {
        if (collection.libraryName) {
          const existing = libraryMap.get(collection.libraryName);
          if (existing) {
            existing.collectionKeys.push(collection.key);
          } else {
            libraryMap.set(collection.libraryName, {
              name: collection.libraryName,
              collectionKeys: [collection.key]
            });
          }
        }
      }
    } catch (e) {
      console.log("Team Library Variable Collections API not available:", e);
    }

    // Build final list
    const libraryInfos: LibraryInfo[] = Array.from(libraryMap.values()).map(lib => ({
      name: lib.name,
      key: lib.name,
      collectionKeys: lib.collectionKeys
    }));

    // Sort alphabetically
    libraryInfos.sort((a, b) => a.name.localeCompare(b.name));

    await setCachedLibraries(libraryInfos);
    return libraryInfos;
  } catch (error) {
    console.error("Failed to fetch libraries:", error);
    return [];
  }
}

export async function getLibraryPaintStyles(libraryKey: string) {
  try {
    // Work with local paint styles that have been imported from libraries
    const allPaintStyles = figma.getLocalPaintStyles();
    return allPaintStyles.filter(style => style.key && style.key.startsWith(libraryKey));
  } catch (error) {
    console.error("Failed to fetch paint styles:", error);
    return [];
  }
}

export async function getLibraryTextStyles(libraryKey: string) {
  try {
    const allTextStyles = figma.getLocalTextStyles();
    return allTextStyles.filter(style => style.key.startsWith(libraryKey));
  } catch (error) {
    console.error("Failed to fetch text styles:", error);
    return [];
  }
}

export async function getLibraryEffectStyles(libraryKey: string) {
  try {
    const allEffectStyles = figma.getLocalEffectStyles();
    return allEffectStyles.filter(style => style.key.startsWith(libraryKey));
  } catch (error) {
    console.error("Failed to fetch effect styles:", error);
    return [];
  }
}

export async function listLibraryVariableCollections() {
  try {
    const collections = figma.variables.getLocalVariableCollections();
    return collections;
  } catch (error) {
    console.error("Failed to fetch variable collections:", error);
    return [];
  }
}

export async function getLibraryVariables(libraryKey: string) {
  try {
    const allVariables = figma.variables.getLocalVariables();
    // Filter variables that belong to the library
    return allVariables.filter(v => v.key && v.key.startsWith(libraryKey));
  } catch (error) {
    console.error("Failed to fetch variables:", error);
    return [];
  }
}
