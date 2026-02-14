# Design Linter

Figma plugin for validating design system compliance at Arista Networks.

## Features

- **Token Validation**: Colors, typography, effects
- **Consistency Checks**: Spacing, padding, border radius
- **Auto-fix**: One-click corrections for common issues
- **Flexible Scope**: Scan selection, page, or entire file

## Installation

```bash
npm install
npm run build
```

Load in Figma:
1. Plugins → Development → Import plugin from manifest
2. Select `manifest.json`

## Usage

1. Enable your Design System library in Figma (Assets → Team Libraries)
2. Run the plugin (Plugins → Design Linter)
3. Configure settings (scan scope, strictness)
4. Click "Run Scan"
5. Review issues and apply fixes

## Design System Palette Extraction

To extract your design system palette for bundling with the plugin, see [HOW_TO_EXTRACT_PALETTE.md](HOW_TO_EXTRACT_PALETTE.md) for detailed instructions.

## Rules

**Colors**: Fills/strokes should use design system variables or styles
**Typography**: Text should use design system text styles
**Effects**: Shadows and blurs should use design system effect styles
**Spacing**: Auto-layout gaps and padding should use common scale (4, 8, 12, 16, 24, 32, 40, 48, 64)
**Border Radius**: Corner radius should use common values (0, 2, 4, 6, 8, 12, 16, 20, 24, 32)

## Development

```bash
npm run dev   # Watch mode
npm run build # Production build
```

## License

Internal Arista Networks tool.
