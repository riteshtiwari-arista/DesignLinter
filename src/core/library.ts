import type { LibraryInfo } from "./types";
import { getCachedLibraries, setCachedLibraries } from "./storage";
import { PALETTES } from "../palettes";

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

    // First, add all bundled palettes (so they're always available)
    const bundledLibraryNames = Object.keys(PALETTES);
    console.log(`Found ${bundledLibraryNames.length} bundled palettes:`, bundledLibraryNames);

    for (const libraryName of bundledLibraryNames) {
      libraryMap.set(libraryName, {
        name: libraryName,
        collectionKeys: [] // Bundled palettes don't need collection keys
      });
    }

    // Then, add enabled libraries from Figma (may override bundled ones)
    // Figma only provides API for variable collections, not for all enabled libraries
    // Libraries without variables won't appear in this list
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

      console.log(`Found ${variableCollections.length} enabled library variable collections`);
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

    console.log(`Total libraries available: ${libraryInfos.length}`);

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
