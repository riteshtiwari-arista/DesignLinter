// Design System Palettes
// Maps library keys to extracted palette JSON files

import geigerDS from './geiger-design-system.json';

export interface DSPalette {
  metadata: {
    extractedAt: string;
    version: string;
    fileName: string;
  };
  paintStyles: Array<{
    id: string;
    key: string;
    name: string;
    paints: any[];
    resolvedColors?: Array<{ r: number; g: number; b: number; a: number }>;
  }>;
  textStyles: Array<{
    id: string;
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: { value: number; unit: string };
    letterSpacing: { value: number; unit: string };
  }>;
  effectStyles: Array<{
    id: string;
    name: string;
    effects: any[];
  }>;
  variables: {
    collections: Array<{
      id: string;
      name: string;
      modes: Array<{ modeId: string; name: string }>;
      variables: Array<{
        id: string;
        name: string;
        resolvedType: string;
        valuesByMode: Record<string, any>;
        resolvedValues?: Record<string, any>;
      }>;
    }>;
  };
}

// Map library keys to their extracted palettes
export const PALETTES: Record<string, DSPalette> = {
  'Geiger Design System': geigerDS as DSPalette,
  // Add more palettes here as you extract them
  // 'Clarity Components': clarityDS,
};

export function getPaletteForLibrary(libraryKey?: string): DSPalette | null {
  if (!libraryKey) return null;
  return PALETTES[libraryKey] || null;
}
