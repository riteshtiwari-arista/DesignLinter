# Project Status - Arista Principles Linter

**Last Updated:** 2026-02-13

## ✅ COMPLETED

### Core Functionality
- [x] **Plugin builds successfully** using esbuild (main.js) + Vite (UI)
- [x] **UI loads in Figma** - All JavaScript/CSS inlined in ui.html (required for Figma)
- [x] **Library detection works** - Uses `getAvailableLibraryVariableCollectionsAsync()` to get actual library names
- [x] **Library validation** - Shows ✓ with collection count when library is selected
- [x] **Settings persistence** - Uses figma.clientStorage
- [x] **Light/dark theme** - Polished enterprise UI

### Scan Scopes
- [x] **Selection Only** - Scan selected frames/nodes
- [x] **Current Page** - Scan entire current page
- [x] **All Pages** - Scan entire document

### Linting Rules (7 total)

**Token Validation:**
1. [x] **Colors** - Detects fills/strokes not bound to DS variables or paint styles
   - Auto-fix: Bind variable or apply paint style (exact RGBA match)
   - Severity: Info (relaxed) / Warn (strict)

2. [x] **Typography** - Detects text not using DS text styles or variables
   - Auto-fix: Apply text style (exact match)
   - Severity: Info (relaxed) / Warn (strict)

3. [x] **Effects** - Detects effects not using DS effect styles or variables
   - No auto-fix
   - Severity: Info

**Consistency Checks:**
4. [x] **Spacing** - Validates auto-layout gaps & padding against common scale (4,8,12,16,20,24,32,40,48,64)
   - Suggests nearest common value
   - Severity: Info

5. [x] **Border Radius** - Validates cornerRadius against common values (0,2,4,6,8,12,16,20,24,32,pill)
   - Suggests nearest common value
   - Severity: Info

**Metadata/Annotation Checks:**
6. [x] **Required States** - For pages with tables/charts, requires 3+ state tags
   - Detection: table/chart/grid in names, >15 children, auto-layout with >10 children
   - Auto-fix: Creates "States" annotation frame
   - Severity: Info

7. [x] **Truth Metadata** - For pages with insights/AI, requires 4 truth tags
   - Detection: insight/ai/analytics keywords in names or text content
   - Auto-fix: Creates "Data Context" annotation frame
   - Severity: Info

### UI Features
- [x] **Issues tab** - Grouped by principle with severity badges
- [x] **Evidence tab** - Generate Jira-ready summary (copy to clipboard)
- [x] **Settings tab** - Library selection, scope, strictness, tag customization
- [x] **Zoom to node** - Click to navigate to issues in Figma
- [x] **Auto-fix buttons** - One-click fixes for deterministic issues
- [x] **Empty states** - Clean "no issues found" messaging

---

## 🐛 KNOWN ISSUES RESOLVED

### Build Issues (FIXED)
- ✅ ES6 imports in main.js → Fixed with esbuild IIFE bundling
- ✅ Spread operators causing syntax errors → Replaced with Object.assign
- ✅ External script loading failing → All assets now inlined in HTML
- ✅ Module type issues → Removed type="module", using IIFE format

### Library Detection Issues (FIXED)
- ✅ Library names not showing → Now using `libraryName` from Team Library API
- ✅ Validation showing errors → Now validates against detected libraries
- ✅ Component names showing instead of library names → Fixed to use actual library names

---

## 📋 NEXT STEPS / TODO

### High Priority
- [ ] **Test with real design files** - Validate all rules work correctly
- [ ] **DS Component Usage Check** - Flag instances not from selected DS library (optional in v1)
- [ ] **Performance optimization** - For large files (1000+ nodes)
- [ ] **Progress indicator** - Show % complete during long scans

### Medium Priority
- [ ] **Bulk auto-fix** - Apply all fixes at once with one click
- [ ] **Export results** - Save findings as JSON/CSV
- [ ] **Issue filtering** - Filter by severity, principle, or rule
- [ ] **Settings presets** - Save/load different configurations
- [ ] **Historical tracking** - Compare scan results over time

### Low Priority / Nice to Have
- [ ] **Opacity token check** - Validate opacity values
- [ ] **Naming conventions** - Check layer naming patterns
- [ ] **Component variants** - Validate proper variant usage
- [ ] **Accessibility checks** - Color contrast, text sizes
- [ ] **Custom rules** - Allow users to define their own rules

### Auto-fix Enhancements
- [ ] **Auto-fix for effects** - Apply matching effect styles
- [ ] **Auto-fix for spacing** - Snap to nearest common value
- [ ] **Auto-fix for border radius** - Snap to nearest common value
- [ ] **Undo support** - Allow reverting auto-fixes

---

## 🏗️ ARCHITECTURE NOTES

### File Structure
```
src/
├── main.ts                      # Plugin controller (esbuild → IIFE)
├── core/
│   ├── types.ts                # Type definitions
│   ├── storage.ts              # Settings persistence
│   ├── library.ts              # Library detection via Team Library API
│   ├── scanner.ts              # Node tree traversal
│   ├── reporter.ts             # Results aggregation
│   └── rules/
│       ├── tokens.colors.ts
│       ├── tokens.typography.ts
│       ├── tokens.effects.ts
│       ├── consistency.spacing.ts
│       ├── consistency.borderRadius.ts
│       ├── requiredStates.ts
│       └── truthMetadata.ts
└── ui/                         # React UI (Vite → inlined in HTML)
    ├── App.tsx
    ├── theme.css
    └── components/
        ├── TopBar.tsx
        ├── Tabs.tsx
        ├── IssueList.tsx
        ├── IssueRow.tsx
        ├── SettingsPanel.tsx
        ├── EvidencePanel.tsx
        └── EmptyState.tsx
```

### Build Process
1. `esbuild` bundles main.ts → dist/main.js (IIFE format)
2. `vite` bundles UI → dist/ui.js + dist/ui.css
3. Custom Vite plugin inlines JS & CSS into dist/ui.html
4. Figma loads manifest.json → dist/main.js + dist/ui.html

### Key Technical Details
- **Library detection**: Uses `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
- **Matching strategy**: Library name stored as key, matches by name in validation
- **Cache**: Libraries cached for 10 minutes in clientStorage
- **Message bridge**: main.ts ↔ UI via postMessage
- **Inline assets**: Required because Figma can't load external JS files

---

## 📝 TESTING CHECKLIST

### Before Publishing
- [ ] Test Selection scope with single frame
- [ ] Test Current Page scope
- [ ] Test All Pages scope on multi-page file
- [ ] Test with no DS library selected
- [ ] Test with Geiger Design System selected
- [ ] Test with Clarity Components selected
- [ ] Verify all auto-fixes work correctly
- [ ] Test Evidence export to clipboard
- [ ] Test Settings persistence across plugin reopens
- [ ] Test light/dark theme switching
- [ ] Test on file with 0 issues (should show success message)
- [ ] Test on file with many issues (>100)

### Edge Cases
- [ ] File with no enabled libraries
- [ ] Page with no nodes
- [ ] Empty selection
- [ ] Nodes with mixed properties (fills, cornerRadius, etc.)
- [ ] Very large files (performance)

---

## 🚀 PUBLISHING

When ready to publish:
1. Test thoroughly (see checklist above)
2. Update version in package.json and manifest.json
3. Run `npm run build`
4. In Figma: Plugins → Development → Arista Principles Linter → Publish
5. Follow Figma's publishing guidelines
6. Add screenshots and description

---

## 📞 SUPPORT

For issues or questions:
- GitHub: (Add repository URL)
- Internal: (Add Slack channel or contact)

---

## 🎯 SUCCESS CRITERIA

The plugin is ready for production when:
- ✅ All 7 linting rules work correctly
- ✅ Library detection shows actual library names
- ✅ Auto-fixes work without errors
- ✅ UI is polished and responsive
- ✅ Performance acceptable on large files (<5s for 1000 nodes)
- ✅ No console errors during normal operation
- ✅ Evidence export formats correctly for Jira
