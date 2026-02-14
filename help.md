1) First: confirm it’s not a style binding (very common)

If the LINE’s stroke is coming from a PaintStyle (stroke style), the node can show no boundVariables, while the style carries the binding.

Check this path:

node.strokeStyleId (if present and not empty)

figma.getStyleByIdAsync(strokeStyleId)

style.boundVariables?.color

Paint styles support variable bindings.

async function getStrokeBindingViaStyle(node: SceneNode) {
  if (!("strokeStyleId" in node)) return null;
  const id = node.strokeStyleId;
  if (!id) return null;

  const style = await figma.getStyleByIdAsync(id);
  if (!style || style.type !== "PAINT") return null;

  const aliases = style.boundVariables?.color;
  if (aliases?.length) return { source: "style", alias: aliases[0] };

  return null;
}


If this returns something, you’re done: treat as “using DS via style”.

2) Then: check node-level bindings (the “should work but doesn’t” path)

Per Figma docs, when a variable is applied in UI, the alias is captured in node.boundVariables.

So this is the expected check:

function getStrokeBindingViaNode(node: SceneNode) {
  const b = (node as any).boundVariables;
  if (!b) return null;

  // stroke paint (color)
  const strokeAliases = b.strokes;
  if (strokeAliases?.length) return { source: "node", field: "strokes", alias: strokeAliases[0] };

  // stroke weight (border thickness)
  const weightAlias =
    b.strokeWeight ?? b.strokeTopWeight ?? b.strokeRightWeight ?? b.strokeBottomWeight ?? b.strokeLeftWeight;

  if (weightAlias) return { source: "node", field: "strokeWeight", alias: weightAlias };

  return null;
}


If boundVariables is {} on a LINE even when UI shows “Border”, that’s consistent with “Figma doesn’t expose it reliably for strokes in some cases” (they’ve acknowledged stroke-variable weirdness in dev mode historically).

3) If both are empty, use inferredVariables as your fallback (practical fix)

node.inferredVariables.strokes is explicitly designed for cases where a field isn’t bound but the value matches variables; index aligns with node.strokes.

So: if boundVariables is empty but inferredVariables.strokes[i] has candidates, treat it as:

Not provably bound (API can’t see binding)

But value matches variable “Border” exactly

Mark as “Likely DS” (or “DS match”) instead of flagging as an issue.

function getStrokeBindingViaInference(node: SceneNode) {
  const inf = (node as any).inferredVariables;
  if (!inf?.strokes) return null;

  // inferredVariables.strokes is an array aligned with node.strokes
  const candidates = inf.strokes[0]; // first stroke paint
  if (!candidates?.length) return null;

  // candidates are variable IDs (or objects depending on API version)
  return { source: "inferred", candidates };
}


This is the single best way to stop false-positives without lying.

4) Also check if the line is inside an instance (bindings might live on the main component)

Your dev mentioned “parent/component/instance” — that’s a real possibility.

If the LINE is a child layer inside an Instance, Figma sometimes “flattens” what you can read on the instance child. In that case:

Find the nearest ancestor INSTANCE

Inspect the main component version for that child

There’s no perfect 1:1 mapping API for “this instance child ↔ that main component child” in every case, but in many DS setups the node names are stable enough to resolve (name + path). I’d implement this as a best-effort:

Build a “layer path” from instance root → child (names)

Get instance.mainComponent and walk the same path by names

Then read bindings on the main component’s matching node

If you want, paste your layer structure (just names) and I’ll sketch the resolver.

What I would change in the report UX (so users trust it)

Instead of binary “uses DS / not DS”, use 3 states:

Bound (confirmed) — you found it via node.boundVariables or style.boundVariables

Matches DS (inferred) — no binding visible, but inferredVariables points to “Border”

Not DS — neither bound nor inferred

That keeps your tool honest and stops blaming users for Figma API gaps.