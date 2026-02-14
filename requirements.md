You are Codex. Build a production-quality Figma plugin called "Arista Principles Linter".
Goal: one-click linting for Arista UX principles across CVaaS/CV-CUE/Velo/ETM/NDR files.

Hard requirements
1) No hardcoded design system component names. The plugin must auto-discover enabled Figma libraries (Team Library API) and let the user pick one as the "Design System Library".
2) Linting must focus on objective checks:
   - Token usage: colors + typography + effects must be bound to variables or DS styles where possible.
   - DS component usage: instances should come from DS library (optional in v1 if reliably detectable).
   - Required states presence: loading/empty/error/stale/permission via simple page-level tags (no DS component keys needed).
   - Truth over polish: if a page contains charts/tables/insight cards, require a "data context" annotation using page-level tags (no DS component keys needed).
3) Plugin UI must be polished: light/dark theme, clean spacing, good typography, badges, empty states. Not a blank page with ugly buttons.
4) Provide autofix ONLY for safe, deterministic fixes:
   - bind color variables by exact RGBA match against DS variable values
   - apply paint styles by exact match if variables not available
   Do NOT do fuzzy matching.
5) Must be publishable: correct manifest, permissions, build pipeline, README.

Deliverables
- A complete repo in the current folder with all files.
- Commands to run: npm install, npm run build.
- The built plugin should run in Figma Desktop.

Implementation plan (execute fully, do not ask questions)
A) Scaffold repo with Vite + React + TypeScript
B) Create Figma plugin manifest + controller (main.ts) + UI (React)
C) Implement DS library discovery + caching
D) Implement scanner + rules + UI rendering + zoom-to-node
E) Implement Evidence block generator + copy to clipboard
F) Add README with install/run/publish instructions.

Now execute the steps below exactly.

========================
STEP 1: Create folder structure + package
========================
Create:
- manifest.json
- package.json
- tsconfig.json
- vite.config.ts
- src/main.ts
- src/core/types.ts
- src/core/storage.ts
- src/core/library.ts
- src/core/scanner.ts
- src/core/reporter.ts
- src/core/rules/tokens.colors.ts
- src/core/rules/tokens.typography.ts
- src/core/rules/tokens.effects.ts
- src/core/rules/requiredStates.ts
- src/core/rules/truthMetadata.ts
- src/ui/index.html
- src/ui/ui.tsx
- src/ui/App.tsx
- src/ui/theme.css
- src/ui/components/TopBar.tsx
- src/ui/components/Tabs.tsx
- src/ui/components/IssueList.tsx
- src/ui/components/IssueRow.tsx
- src/ui/components/SettingsPanel.tsx
- src/ui/components/EvidencePanel.tsx
- src/ui/components/EmptyState.tsx
- README.md

========================
STEP 2: Write exact file contents
========================

---- package.json ----
{
  "name": "arista-principles-linter",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "lint": "echo \"(optional)\""
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.8"
  }
}

---- tsconfig.json ----
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "types": ["@figma/plugin-typings"],
    "outDir": "dist"
  },
  "include": ["src"]
}

---- vite.config.ts ----
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        ui: "src/ui/index.html"
      },
      output: {
        entryFileNames: (chunk) => {
          // main.ts is built by tsc; UI is bundled by vite
          return "[name].js";
        }
      }
    }
  }
});

IMPORTANT: also add @vitejs/plugin-react to devDependencies and deps resolution. If missing, add it.

---- manifest.json ----
{
  "name": "Arista Principles Linter",
  "id": "com.arista.principles.linter",
  "api": "1.0.0",
  "main": "dist/main.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "permissions": ["teamlibrary"],
  "networkAccess": { "allowedDomains": [] }
}

---- src/ui/index.html ----
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arista Principles Linter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/ui.tsx"></script>
  </body>
</html>

---- src/ui/theme.css ----
Create a premium-looking theme using CSS variables:
- supports light and dark via [data-theme="dark"]
- base font: system-ui
- subtle borders, rounded corners, spacing scale
- badges for severity (info/warn/block)
Do not use harsh colors; keep it enterprise-polished.

---- src/ui/ui.tsx ----
Mount React app. Also add message bridge:
- listen to window.onmessage to receive results
- send messages to main via parent.postMessage({ pluginMessage: ... }, "*")

---- src/core/types.ts ----
Define:
type Severity = "info" | "warn" | "block";
type Principle = "Clarity" | "Predictability" | "Pressure" | "Function" | "Truth" | "Evolution";
interface Finding { ... } include:
id, principle, severity, ruleId, nodeId, nodeName, pageName, message, howToFix, canAutoFix, fixPayload?
interface Evidence { type, links, summary, validationPlan? }
interface Settings { theme, scanScope, strictness, dsLibraryKey?, requiredStateTags?, truthTag? }

---- src/core/storage.ts ----
Implement get/set using figma.clientStorage with defaults.

---- src/core/library.ts ----
Implement:
async function listEnabledLibraries(): Promise<Array<{ key: string; name: string }>>
- use figma.teamLibrary.getAvailableLibrariesAsync()
Cache the list for 10 minutes in clientStorage.
If no libraries enabled, return empty.

Also implement:
async function getLibraryPaintStyles(libraryKey): returns descriptors (name, key)
async function getLibraryTextStyles(libraryKey)
async function getLibraryEffectStyles(libraryKey)
Use Team Library API calls for styles descriptors and then import styles as needed.
(Where importing is required, use figma.importStyleByKeyAsync(key).)

Implement:
async function listLibraryVariableCollections(): Promise<...>
Use figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
Then import variables by collection using variables API:
- For each collection, figma.variables.getVariableCollectionByIdAsync if available
- If not, import variable by key where possible.
If API limitations exist, gracefully degrade to style matching only.

---- src/core/scanner.ts ----
Implement:
function getScanRoots(scope): selection or currentPage
function walk(node): traverse all descendants (FRAME/GROUP/COMPONENT/INSTANCE/TEXT/RECT etc)
Return flat list of nodes to check.
Avoid scanning hidden nodes optionally.

---- Rules v1 (write these):
---- src/core/rules/tokens.colors.ts ----
For nodes that support fills/strokes/effects:
- If paint is SOLID and not bound to a variable AND not a paint style from DS library -> warn/block depending strictness
- If DS variables are accessible: exact RGBA match -> canAutoFix: bind variable
- Else if DS paint styles accessible: exact match -> canAutoFix: apply paint style

---- src/core/rules/tokens.typography.ts ----
For TEXT nodes:
- If not using a text style AND no bound typography variables -> warn
Autofix:
- If DS text styles accessible and exact match (font family, style, size, line height, letter spacing) -> apply style

---- src/core/rules/tokens.effects.ts ----
For nodes with effects:
- If effect is not from effect style and not variable-bound -> info/warn

---- src/core/rules/requiredStates.ts ----
Do NOT require DS components.
Require page-level tags:
- default required tags list: ["state:loading","state:empty","state:error","state:stale","state:denied"]
Rule: If page contains tables/charts (heuristic: node names include "Table" or "Chart" or has > 20 rows/rects in a group), then require at least 3 of these tags somewhere on page (as text nodes) OR as a sticky note frame named "States".
Provide autofix: create a small "States" frame in top-left with the missing tags as text.

---- src/core/rules/truthMetadata.ts ----
Do NOT require DS components.
If page contains "insight" / "anomaly" / "recommendation" / "ai" in node names OR chart/table heuristics triggered:
Require presence of "truth:" tags:
Default: ["truth:source","truth:freshness","truth:scope","truth:confidence"]
Same detection: text nodes anywhere on page OR a frame named "Data Context".
Autofix: create a "Data Context" frame with those labels.

---- src/core/reporter.ts ----
Group findings by principle, compute counts, generate:
- a short summary string for Jira
- JSON export object

---- src/main.ts ----
Controller:
- showUI({ width: 380, height: 560 })
- handle messages:
  - "INIT": send settings + libraries list
  - "SETTINGS_SAVE": persist settings
  - "REFRESH_LIBRARIES": refresh list
  - "RUN_SCAN": run scanner + rules and send findings
  - "ZOOM_TO": figma.viewport.scrollAndZoomIntoView([node])
  - "APPLY_FIX": apply fix payload to node or create frames

Make scan fast; show progress messages.

---- UI (App.tsx) ----
Polished UI:
- Top bar with title + Run button
- Tabs: Issues, Evidence, Settings
- Issues: grouped sections with counts and list rows
- Each issue row: severity badge, message, node name, buttons: Zoom, Auto-fix (if available)
- Evidence tab: form fields + "Copy Evidence Block"
- Settings: theme toggle, scan scope, strictness, DS library select, refresh button

---- README.md ----
Include:
- install, build
- how to load plugin in Figma (Development → Import plugin from manifest)
- how to enable DS library in a file (Assets → Library)
- what checks are performed
- how tags work for States and Data Context
- publishing notes

========================
STEP 3: Ensure build works
========================
- Add @figma/plugin-typings and @vitejs/plugin-react as devDependencies
- Ensure Vite outputs ui.html in dist as ui.html (rename if needed)
- Ensure tsc outputs main.js in dist
- Confirm manifest paths match dist outputs.

Finally, output:
1) a short note confirming file tree created
2) commands to run
3) any Figma API limitations encountered + how you handled them (brief)

