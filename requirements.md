# Figma Plugin --- Resolving Alias Variables in Design Systems

## Purpose

Many modern Design Systems use **semantic tokens** that are aliases
instead of concrete values.

Example:

    primary-color → {base.blue} (alias)
    base.blue → rgba(91,143,214,1) (concrete)

Your plugin currently skips aliases because it only indexes variables
with direct RGB values.

This document describes how to correctly:

-   Resolve alias chains
-   Support semantic tokens
-   Build reliable DS matching
-   Avoid false "Not DS" reports

------------------------------------------------------------------------

## Core Problem

All Geiger Design System color variables are aliases.

Your current logic:

    if variable has RGB → index
    else → skip

Result:

❌ Entire Design System ignored.

Correct behavior:

    Resolve aliases → find final concrete RGBA → index semantic token

------------------------------------------------------------------------

## Key Concept

A variable value can be:

### Concrete color

    { r: number, g: number, b: number, a: number }

### Alias

    { type: "VARIABLE_ALIAS", id: "VariableID" }

Aliases must be followed recursively until a real color is reached.

------------------------------------------------------------------------

## Required Architecture

You must build:

1.  Variable cache
2.  Recursive alias resolver
3.  Mode-aware resolution
4.  RGBA indexing
5.  Cycle protection

------------------------------------------------------------------------

## Step 1 --- Variable Cache

Avoid repeated imports.

``` ts
const varCache = new Map<string, Variable>();

async function getVar(idOrKey: string): Promise<Variable> {
  if (varCache.has(idOrKey)) return varCache.get(idOrKey)!;

  let v: Variable | null = null;

  try {
    v = await figma.variables.getVariableByIdAsync(idOrKey);
  } catch {}

  if (!v) {
    v = await figma.variables.importVariableByKeyAsync(idOrKey);
  }

  varCache.set(v.id, v);
  return v;
}
```

------------------------------------------------------------------------

## Step 2 --- Type Guards

``` ts
function isAlias(v: any) {
  return v?.type === "VARIABLE_ALIAS";
}

function isRgba(v: any) {
  return v &&
    typeof v.r === "number" &&
    typeof v.g === "number" &&
    typeof v.b === "number" &&
    typeof v.a === "number";
}
```

------------------------------------------------------------------------

## Step 3 --- Recursive Alias Resolver

This is the critical part.

``` ts
export async function resolveColorVariableToRGBA(
  variableIdOrKey: string,
  modeId: string,
  visited = new Set<string>()
): Promise<RGBA | null> {

  const variable = await getVar(variableIdOrKey);

  if (visited.has(variable.id)) return null;
  visited.add(variable.id);

  const val = variable.valuesByMode[modeId];
  if (!val) return null;

  if (isRgba(val)) return val;

  if (isAlias(val)) {
    return resolveColorVariableToRGBA(val.id, modeId, visited);
  }

  return null;
}
```

### Why visited set exists

Prevents infinite loops if alias chains accidentally cycle.

------------------------------------------------------------------------

## Step 4 --- Mode Awareness

Variables differ per mode (Light/Dark).

Get modes from the collection:

``` ts
const collection =
  await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );

const modes = collection.modes;
```

Always resolve aliases per mode.

------------------------------------------------------------------------

## Step 5 --- RGBA Normalization

Convert RGBA to stable comparison key.

``` ts
function rgbaToKey(c: RGBA) {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const a = Number(c.a.toFixed(3));
  return `rgba(${r},${g},${b},${a})`;
}
```

------------------------------------------------------------------------

## Step 6 --- Index Semantic Tokens

Even aliases must be indexed.

``` ts
for (const v of colorVariables) {

  const imported =
    await figma.variables.importVariableByKeyAsync(v.key);

  for (const mode of modes) {

    const rgba =
      await resolveColorVariableToRGBA(imported.id, mode.modeId);

    if (!rgba) continue;

    const key = rgbaToKey(rgba);

    const ref = {
      variableKey: v.key,
      variableName: v.name,
      mode: mode.name
    };

    const arr = colorsByRgba.get(key) ?? [];
    arr.push(ref);
    colorsByRgba.set(key, arr);
  }
}
```

Now semantic tokens correctly map to final colors.

------------------------------------------------------------------------

## Step 7 --- Scanner Logic (Final)

When scanning nodes:

1.  Check `boundVariables`
2.  Check style bindings
3.  Else compute node RGBA
4.  Lookup in `colorsByRgba`

If match exists:

✅ MATCHES_DS

------------------------------------------------------------------------

## Step 8 --- Performance Rules

DO:

-   Cache imported variables
-   Cache resolved RGBA per `(varId, modeId)`
-   Resolve once per session

DO NOT:

-   Import variables repeatedly
-   Resolve aliases during every node scan

------------------------------------------------------------------------

## Step 9 --- Report States

  State        Meaning
  ------------ -------------------------
  CONFIRMED    Binding visible via API
  MATCHES_DS   Alias resolved match
  NOT_DS       No binding and no match

------------------------------------------------------------------------

## Step 10 --- Definition of Done

Implementation is correct when:

-   Alias-only Design Systems work
-   Semantic tokens resolve properly
-   DS borders/colors stop being falsely flagged
-   Light/Dark modes resolve independently

------------------------------------------------------------------------

## Mental Model

Your plugin is not detecting bindings.

Your plugin is validating:

> Does this visual value originate from the Design System?

Alias resolution makes semantic tokens first-class citizens.
