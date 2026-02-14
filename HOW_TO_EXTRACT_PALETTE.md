# How to Extract Your Design System Palette

## Quick Start (3 Steps)

### Step 1: Open Your Design System File
Open the Figma file where your Design System is defined (the source file with local paint styles, text styles, and variables).

**For Geiger Design System:** Open the "Geiger Design System" source file in Figma.

### Step 2: Run the Extractor
1. Run the Design Linter plugin in this file
2. Go to **Settings** tab
3. Scroll to **"Design System Palette Extraction"** section
4. Click **"Extract Palette JSON"** button
5. Wait for the success message
6. The JSON is now in your clipboard!

### Step 3: Save the JSON
1. Create a file in your plugin directory:
   ```
   src/palettes/geiger-design-system.json
   ```

2. Paste the clipboard contents into this file

3. Rebuild the plugin:
   ```bash
   npm run build
   ```

4. Done! The plugin will now use this palette.

## What Gets Extracted

The extraction includes:

- **Paint Styles** (all your color styles like "Core/White", "Base 1", etc.)
- **Text Styles** (typography styles)
- **Effect Styles** (shadows, blurs)
- **Variables** (all local variables with resolved values)

## When to Re-Extract

Re-extract whenever you:
- Add new colors or styles
- Rename existing styles
- Change color values
- Update your design system

Just re-run the extractor and replace the JSON file.

## Troubleshooting

**"No paint styles found"**
- Make sure you're in the Design System SOURCE file (not a file using the library)
- The file should have LOCAL styles, not remote library styles

**"Failed to copy to clipboard"**
- Check the browser console - the JSON will be logged there
- Copy it manually from the console

**Build fails after adding JSON**
- Make sure the JSON is valid (use a JSON validator)
- Check for syntax errors (missing commas, brackets)

## Multiple Design Systems

To support multiple design systems:

1. Extract each one separately
2. Save as different files:
   - `src/palettes/geiger-design-system.json`
   - `src/palettes/clarity-components.json`

3. Update `src/palettes/index.ts`:
   ```typescript
   import geigerDS from './geiger-design-system.json';
   import clarityDS from './clarity-components.json';

   export const PALETTES = {
     'Geiger Design System': geigerDS,
     'Clarity Components': clarityDS,
   };
   ```

4. Rebuild the plugin

Now you can select which library to use in settings!
