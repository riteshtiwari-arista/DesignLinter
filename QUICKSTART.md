# Quick Start Guide

## First Time Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the plugin**
   ```bash
   npm run build
   ```

3. **Load in Figma**
   - Open Figma Desktop
   - **Plugins** → **Development** → **Import plugin from manifest**
   - Select `manifest.json` from this directory

## Using the Plugin

### 1. Select Your Design System Library

1. Open the plugin in Figma
2. Go to **Settings** tab
3. In the **Select Library** dropdown, choose your library:
   - "Geiger Design System"
   - "Clarity Components"
   - Or any other enabled library
4. You should see ✓ confirming the library was found

### 2. Choose Scan Scope

Still in Settings:
- **Selection Only**: Scan just what you've selected
- **Current Page**: Scan the entire page you're on
- **All Pages**: Scan the whole document (slower)

### 3. Run a Scan

1. Go to **Issues** tab
2. Click **Run Scan** button
3. Wait for results (should be quick for most files)

### 4. Review Issues

Issues are grouped by principle:
- **Clarity**: Token and consistency issues
- **Predictability**: State documentation
- **Truth**: Data context metadata

Each issue shows:
- Severity badge (Info/Warn/Block)
- Description of the problem
- How to fix it
- Node name

### 5. Fix Issues

**Manual fix:**
1. Click **Zoom to node** to navigate to the issue
2. Fix it manually in Figma

**Auto-fix:**
1. Click **Auto-fix** button (only shows if available)
2. Plugin applies the fix automatically
3. Scan runs again to verify

### 6. Export Evidence

1. Go to **Evidence** tab
2. Click **Copy to Clipboard**
3. Paste into Jira ticket or design review doc

## Common Scenarios

### Scenario 1: Check a Single Frame
1. Select the frame in Figma
2. Settings → Scope → **Selection Only**
3. Run Scan

### Scenario 2: Audit Entire Page
1. Settings → Scope → **Current Page**
2. Select your DS library
3. Run Scan
4. Fix issues or export evidence

### Scenario 3: Pre-Review Checklist
1. Settings → Scope → **All Pages**
2. Settings → Strictness → **Strict**
3. Run Scan
4. Fix all Warn/Block issues
5. Export evidence for design review

## What Gets Checked

✅ Colors use DS variables or paint styles  
✅ Typography uses DS text styles  
✅ Effects use DS effect styles  
✅ Spacing follows common scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)  
✅ Border radius follows common values  
✅ Data-heavy pages have state documentation  
✅ Insight/AI pages have truth/data context metadata  

## Tips

- **Start small**: Scan one frame first to see what issues look like
- **Use strict mode** before design reviews to catch everything
- **Customize tags** in Settings if your team uses different state/truth labels
- **Refresh libraries** if you just enabled a new library in Figma

## Troubleshooting

**No libraries showing?**
- Make sure libraries are enabled in Figma: Assets → Team Libraries
- Click "Refresh Libraries" button in Settings
- Check you're on a page that uses library components/styles

**Validation showing error?**
- The library might not have variable collections
- Try selecting a different library
- Check console (right-click plugin → Inspect → Console)

**Auto-fix not working?**
- Auto-fix only works for exact matches (colors, typography)
- Spacing and border radius don't have auto-fix yet
- Check console for errors

## Next Steps

After testing:
- See STATUS.md for what's implemented and what's next
- See CLAUDE.md for technical architecture details
- See README.md for development setup
