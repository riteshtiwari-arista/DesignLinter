import type { Settings } from "./types";

export function getScanRoots(scope: Settings["scanScope"]): readonly SceneNode[] | PageNode[] {
  if (scope === "selection" && figma.currentPage.selection.length > 0) {
    return figma.currentPage.selection;
  }
  if (scope === "all-pages") {
    return figma.root.children.filter(node => node.type === "PAGE") as PageNode[];
  }
  return [figma.currentPage];
}

function isNodeOrAncestorInvisible(node: BaseNode): boolean {
  let current: BaseNode | null = node;

  while (current) {
    // Check if this node has visibility property and is invisible
    if ("visible" in current && current.visible === false) {
      return true;
    }
    // Move up to parent (stop at PAGE or DOCUMENT level)
    if (current.type === "PAGE" || current.type === "DOCUMENT") {
      break;
    }
    current = current.parent;
  }

  return false;
}

export function* walkNodes(node: BaseNode, skipHidden = false): Generator<SceneNode> {
  // Skip this node and all its children if it or any ancestor is invisible
  if (skipHidden && isNodeOrAncestorInvisible(node)) {
    return;
  }

  if (!("children" in node)) {
    if ("type" in node) {
      yield node as SceneNode;
    }
    return;
  }

  if ("type" in node) {
    yield node as SceneNode;
  }

  for (const child of node.children) {
    yield* walkNodes(child, skipHidden);
  }
}

export function getAllNodesToScan(roots: readonly SceneNode[] | PageNode[], skipHidden = true): SceneNode[] {
  const nodes: SceneNode[] = [];

  for (const root of roots) {
    for (const node of walkNodes(root, skipHidden)) {
      nodes.push(node);
    }
  }

  return nodes;
}

export function getPageName(node: SceneNode): string {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") {
      return current.name;
    }
    current = current.parent;
  }
  return "Unknown Page";
}
