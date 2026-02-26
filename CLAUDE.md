# CLAUDE.md

This file provides guidance to AI assistants when working with code in this repository.

## Project Overview

Design Linter is a Figma plugin that validates designs against Arista's design system guidelines. It checks for token compliance, consistency issues, and provides auto-fix capabilities.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Build plugin (outputs to dist/)
npm run watch        # Build and watch for changes
```

After building, load the plugin in Figma:
1. Plugins → Development → Import plugin from manifest
2. Select `manifest.json` from this directory

## Architecture

### Two-Part Plugin Structure

1. **Main Thread** (`src/main.ts`): Runs in Figma's plugin sandbox with access to the Figma API
2. **UI Thread** (`src/ui/`): React app that renders the plugin interface

Communication between threads via `postMessage`:
- UI → Main: `parent.postMessage({ pluginMessage: { type: "RUN_SCAN" } }, "*")`
- Main → UI: `figma.ui.postMessage({ type: "SCAN_COMPLETE", findings })`

### Key Modules

**Design System Catalog** (`src/core/dsCatalog.ts`)
- Loads design system resources from bundled JSON palettes
- Indexes paint styles, text styles, effect styles, and variables by their values
- Provides fast lookup functions: `matchColor()`, `matchPaintStyle()`, `matchNumber()`
- Uses RGBA normalization for color matching: `rgba(r,g,b,a)` with rounded values

**Palette Architecture**
- Remote paint styles from team libraries cannot be enumerated via Figma API
- Solution: Extract palette once from DS source file, bundle as static JSON
- Extraction: Settings → "Extract Palette JSON" (run in DS source file)
- Palette files stored in `src/palettes/*.json`
- To add new palette: extract, save to `src/palettes/`, update `src/palettes/index.ts`, rebuild

**Rule Checks** (`src/core/rules/`)
- Each rule exports an async function that takes nodes and settings, returns findings
- `tokens.colors.ts`: Checks fills/strokes against DS variables and paint styles
- `tokens.typography.ts`: Validates text styles
- `tokens.effects.ts`: Validates effect styles
- `consistency.spacing.ts`: Checks auto-layout gaps and padding
- `consistency.borderRadius.ts`: Validates corner radius values
- `requiredStates.ts`: Verifies annotation tags for states
- `truthMetadata.ts`: Validates data context annotations

**Auto-Fix System**
- Finding contains `canAutoFix: boolean` and `fixPayload` object
- Main thread handlers in `applyFix()` function handle different fix types
- Original values stored before applying fix to enable undo
- Undo removes the auto-fix and restores original node properties

**Scanner** (`src/core/scanner.ts`)
- `getScanRoots()`: Determines which nodes to scan based on scope setting
- `getAllNodesToScan()`: Recursively walks node tree, skips instances/components
- Handles selection, page, and all-pages scope

### Settings Storage

Settings persisted to Figma's `clientStorage` API:
- Theme (light/dark)
- Scan scope (selection/page/all-pages)
- Strictness (relaxed/strict)
- Selected design system library key
- Required state tags
- Truth metadata tags
- Color scanning options (ignore hidden fills, zero opacity, transparent)

## Design System Palette Extraction

See `HOW_TO_EXTRACT_PALETTE.md` for complete instructions.

Quick summary:
1. Open DS source file in Figma (must have LOCAL styles, not remote)
2. Run plugin → Settings → "Extract Palette JSON"
3. Save JSON to `src/palettes/[library-name].json`
4. Update `src/palettes/index.ts` to import and register the palette
5. Rebuild: `npm run build`

Palette structure:
```typescript
{
  metadata: { extractedAt, version, fileName },
  paintStyles: [{ id, key, name, paints, resolvedColors }],
  textStyles: [{ id, name, fontFamily, fontSize, ... }],
  effectStyles: [{ id, name, effects }],
  variables: {
    collections: [{
      id, name, modes,
      variables: [{ id, name, resolvedType, valuesByMode, resolvedValues }]
    }]
  }
}
```

## Common Patterns

### Adding a New Rule

1. Create `src/core/rules/yourRule.ts`:
```typescript
import type { Finding, Settings } from "../types";
import { getPageName } from "../scanner";

export async function checkYourRule(
  nodes: SceneNode[],
  settings: Settings
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    // Your validation logic
    if (violatesRule) {
      findings.push({
        id: `${node.id}-your-rule`,
        principle: "Clarity",
        severity: settings.strictness === "strict" ? "warn" : "info",
        ruleId: "yourRule",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Description of issue",
        howToFix: "How to fix it",
        canAutoFix: false
      });
    }
  }

  return findings;
}
```

2. Import and call in `src/main.ts` `runScan()` function
3. Add category mapping in `src/ui/components/IssueList.tsx` `categoryNames`

### Adding Auto-Fix

1. Set `canAutoFix: true` in finding
2. Add `fixPayload` with `{ type: "your-fix-type", ...params }`
3. Add case in `src/main.ts` `applyFix()` switch statement
4. Implement fix handler function
5. Store original value before applying fix (for undo)

## TypeScript Configuration

- `tsconfig.json`: Main TypeScript config
- Uses Figma plugin typings: `@figma/plugin-typings`
- Build output: ES2017 for main thread, ESNext for UI

## Important Notes

- Never use `figma.currentPage.findAll()` - extremely slow on large files
- Always walk the tree manually with `getAllNodesToScan()`
- Store expensive computations (like catalog loading) in module-level variables
- Use progress callbacks for long operations to show user feedback
- All auto-fix operations must store original values for undo capability
- Paint style matching requires the `key` field (for `importStyleByKeyAsync`)

## Testing

Manual testing workflow:
1. Make code changes
2. Run `npm run build`
3. In Figma: Close plugin → Reopen plugin (or use Cmd+Option+P to reload)
4. Test the feature
5. Check console (Cmd+Option+I) for errors and debug logs

## File Structure

```
src/
  core/
    dsCatalog.ts       # Design system catalog (indexes resources)
    scanner.ts         # Node traversal and collection
    storage.ts         # Settings persistence
    library.ts         # Team library enumeration
    types.ts           # Shared TypeScript types
    rules/             # Individual rule checks
      tokens.colors.ts
      tokens.typography.ts
      tokens.effects.ts
      consistency.spacing.ts
      consistency.borderRadius.ts
      requiredStates.ts
      truthMetadata.ts
  palettes/
    index.ts           # Palette registry
    *.json            # Extracted design system palettes
  ui/
    App.tsx           # Main UI component
    components/       # UI components
      Tabs.tsx
      IssueList.tsx
      IssueRow.tsx
      EvidencePanel.tsx
      SettingsPanel.tsx
      EmptyState.tsx
    index.html        # UI entry point
    styles.css        # Global styles
  main.ts             # Plugin main thread entry
```

## Recent Updates

### Paint Style Support (2026-02-14)
- Added paint style matching alongside variable matching
- Implemented bundled palette architecture (extraction from DS source files)
- Auto-fix for paint styles with undo functionality
- Store original node values before applying fixes
- Color scanning options: ignore hidden fills, zero opacity, transparent colors
