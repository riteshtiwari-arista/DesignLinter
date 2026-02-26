// Design System Palettes
// Maps library keys to extracted palette JSON files

import geigerDS from './geiger-design-system.json';
import clarityDS from './clarity-components.json';
import clarity220 from './clarity-ui-library-light-2.2.0.json';
import saseDS from './sase-library-1.1.0.json';

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
        key?: string;
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
  'Clarity Components': clarityDS as DSPalette,
  'Clarity-UI-Library-light 2.2.0 - Management Center Resources (Copy)': clarity220 as DSPalette,
  'SASE-Library-1.1.0': saseDS as DSPalette,
};

export function getPaletteForLibrary(libraryKey?: string): DSPalette | null {
  if (!libraryKey) return null;
  return PALETTES[libraryKey] || null;
}
