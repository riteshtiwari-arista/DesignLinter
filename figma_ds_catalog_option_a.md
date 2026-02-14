# Option A --- Build an In-Memory Design System Variable Catalog (No Copying)

Goal: Your plugin should load **all Design System variables** that are
available in the current file (enabled libraries), build a **fast lookup
catalog**, and use it during scanning to decide:

-   Confirmed DS usage (bound via API)
-   DS match (value matches a DS token even if binding is not visible)
-   Not DS

This approach does **not** create local variables and does **not**
duplicate the DS library.

------------------------------------------------------------------------

## 1) Constraints You Must Accept

1.  Libraries must be enabled by the user in this file.
    -   Plugins cannot enable libraries.
    -   If no DS library is enabled, your plugin will see no library
        collections.
2.  `getLocalVariableCollectionsAsync()` returns only local collections.
    -   It can be 0 even if the file is using DS library variables.
    -   Do not use this for DS library variables.
3.  `node.boundVariables` can be empty `{}` even when UI shows a binding
    (API gap).
    -   Your catalog + value matching prevents false violations.

------------------------------------------------------------------------

## 2) Manifest Requirements

Add `teamlibrary` permission:

``` json
{
  "name": "Your Plugin",
  "id": "YOUR_PLUGIN_ID",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "permissions": ["teamlibrary"]
}
```

------------------------------------------------------------------------

## 3) Catalog Data Structure

Core maps:

-   `variablesByKey`
-   `collectionsByKey`
-   `colorsByRgba`
-   `numbersByValue`
-   `stringsByValue`
-   `booleansByValue`

Example variable reference:

``` ts
type DSVarRef = {
  collectionKey: string
  collectionName: string
  variableKey: string
  variableName: string
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
}
```

------------------------------------------------------------------------

## 4) Catalog Loading Flow

### Step 1 --- Get library collections

Use:

``` ts
figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
```

If empty, instruct user to enable DS library.

### Step 2 --- Get variables

``` ts
figma.teamLibrary.getVariablesInLibraryCollectionAsync(collectionKey)
```

### Step 3 --- Build lookup maps

Store descriptors and index by type.

------------------------------------------------------------------------

## 5) Normalization Helpers

### RGBA normalization

Format:

    rgba(r,g,b,a)

Where RGB are 0--255 and alpha rounded to 3 decimals.

### Number normalization

    Number(value).toFixed(4)

Trim trailing zeros.

------------------------------------------------------------------------

## 6) Module Specification

Create `dsCatalog.ts` exposing:

-   `loadDSCatalog()`
-   `ensureDSCatalogLoaded()`
-   `matchColor(rgbaKey)`
-   `matchNumber(value)`

Type definitions:

``` ts
export type DSCatalog = {
  loadedAt: number
  collectionsByKey: Map<string, any>
  variablesByKey: Map<string, any>
  colorsByRgba: Map<string, DSVarRef[]>
  numbersByValue: Map<string, DSVarRef[]>
  stringsByValue: Map<string, DSVarRef[]>
  booleansByValue: Map<string, DSVarRef[]>
}
```

------------------------------------------------------------------------

## 7) Loading Logic (Pseudo Implementation)

``` ts
let DS_CATALOG = null;

export async function loadDSCatalog() {
  const collections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

  const catalog = {
    loadedAt: Date.now(),
    collectionsByKey: new Map(),
    variablesByKey: new Map(),
    colorsByRgba: new Map(),
    numbersByValue: new Map(),
    stringsByValue: new Map(),
    booleansByValue: new Map(),
  };

  for (const c of collections) {
    catalog.collectionsByKey.set(c.key, c);

    const vars =
      await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key);

    for (const v of vars) {
      catalog.variablesByKey.set(v.key, v);
    }
  }

  DS_CATALOG = catalog;
  return catalog;
}
```

------------------------------------------------------------------------

## 8) Lazy Value Matching Strategy

Do NOT import every variable upfront.

Instead:

1.  Scan node value
2.  Attempt binding detection
3.  If not found → lazily import variables of matching type
4.  Cache imported variables
5.  Build lookup index once

Example import:

``` ts
figma.variables.importVariableByKeyAsync(key)
```

------------------------------------------------------------------------

## 9) Report States

Use three states:

  State        Meaning
  ------------ -------------------------
  CONFIRMED    Binding detected
  MATCHES_DS   Value equals DS token
  NOT_DS       No binding and no match

------------------------------------------------------------------------

## 10) UX When No Library Found

Show:

> Enable your Design System library via Assets → Libraries and rerun
> scan.

Do not treat as an error.

------------------------------------------------------------------------

## 11) Acceptance Criteria

-   Works even when local collections = 0
-   Correctly recognizes DS tokens from libraries
-   Stops false "Not DS" reports
-   Handles stroke/fill/spacing tokens

------------------------------------------------------------------------

## 12) Definition of Done

Option A is complete when:

-   Library collections load successfully
-   Catalog builds in memory
-   Scanner performs value matching
-   Designers are no longer falsely flagged
