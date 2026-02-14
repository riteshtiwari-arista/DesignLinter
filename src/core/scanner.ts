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

export function* walkNodes(node: BaseNode): Generator<SceneNode> {
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
    yield* walkNodes(child);
  }
}

export function getAllNodesToScan(roots: readonly SceneNode[] | PageNode[], skipHidden = true): SceneNode[] {
  const nodes: SceneNode[] = [];

  for (const root of roots) {
    for (const node of walkNodes(root)) {
      if (skipHidden && "visible" in node && node.visible === false) {
        continue;
      }
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
