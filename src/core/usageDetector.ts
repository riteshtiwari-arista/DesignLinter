// Usage Detector - Workaround A from help.md
// Detects remote libraries and assets actually being used in the document

export interface RemoteStyleUsage {
  id: string;
  key: string;
  name: string;
  type: 'PAINT' | 'TEXT' | 'EFFECT';
  libraryName?: string;
  usedByNodes: string[]; // node IDs
}

export interface RemoteComponentUsage {
  key: string;
  name: string;
  libraryName?: string;
  instanceCount: number;
  instanceIds: string[]; // instance node IDs
}

export interface LibraryUsageReport {
  librariesInUse: Set<string>;
  remoteStyles: Map<string, RemoteStyleUsage>;
  remoteComponents: Map<string, RemoteComponentUsage>;
}

export async function detectLibraryUsage(nodes: SceneNode[]): Promise<LibraryUsageReport> {
  const report: LibraryUsageReport = {
    librariesInUse: new Set(),
    remoteStyles: new Map(),
    remoteComponents: new Map(),
  };

  console.log(`\n=== Detecting Library Usage ===`);
  console.log(`Scanning ${nodes.length} nodes...`);

  for (const node of nodes) {
    // Check for remote paint styles
    if ('fillStyleId' in node && node.fillStyleId && node.fillStyleId !== figma.mixed && node.fillStyleId !== '') {
      await checkRemoteStyle(node.fillStyleId, 'PAINT', node.id, report);
    }

    if ('strokeStyleId' in node && node.strokeStyleId && node.strokeStyleId !== figma.mixed && node.strokeStyleId !== '') {
      await checkRemoteStyle(node.strokeStyleId, 'PAINT', node.id, report);
    }

    // Check for remote text styles
    if ('textStyleId' in node && node.textStyleId && node.textStyleId !== figma.mixed && node.textStyleId !== '') {
      await checkRemoteStyle(node.textStyleId, 'TEXT', node.id, report);
    }

    // Check for remote effect styles
    if ('effectStyleId' in node && node.effectStyleId && node.effectStyleId !== figma.mixed && node.effectStyleId !== '') {
      await checkRemoteStyle(node.effectStyleId, 'EFFECT', node.id, report);
    }

    // Check for remote components (instances)
    if (node.type === 'INSTANCE') {
      await checkRemoteComponent(node, report);
    }
  }

  console.log(`\n=== Library Usage Summary ===`);
  console.log(`Libraries in use: ${report.librariesInUse.size}`);
  console.log(`  ${Array.from(report.librariesInUse).join(', ')}`);
  console.log(`Remote paint/text/effect styles: ${report.remoteStyles.size}`);
  console.log(`Remote components: ${report.remoteComponents.size}`);

  return report;
}

async function checkRemoteStyle(
  styleId: string,
  type: 'PAINT' | 'TEXT' | 'EFFECT',
  nodeId: string,
  report: LibraryUsageReport
) {
  try {
    const style = await figma.getStyleByIdAsync(styleId);

    if (!style) return;

    // Check if it's a remote style (from a library)
    if (style.remote) {
      // Try multiple ways to get library name
      let libraryName = (style as any).libraryName;

      // Fallback: parse from style name if it has library prefix
      // Many libraries use format like "LibraryName/StyleName"
      if (!libraryName && style.name.includes('/')) {
        const parts = style.name.split('/');
        if (parts.length > 1) {
          libraryName = parts[0];
        }
      }

      // Fallback: use "Unknown Library" if we can't determine
      if (!libraryName) {
        libraryName = `Remote Library (${type})`;
      }

      console.log(`Found remote ${type} style: "${style.name}" from library: "${libraryName}"`);

      report.librariesInUse.add(libraryName);

      const existing = report.remoteStyles.get(styleId);
      if (existing) {
        existing.usedByNodes.push(nodeId);
      } else {
        report.remoteStyles.set(styleId, {
          id: styleId,
          key: style.key,
          name: style.name,
          type,
          libraryName,
          usedByNodes: [nodeId],
        });
      }
    }
  } catch (err) {
    console.warn(`Failed to check style ${styleId}:`, err);
  }
}

async function checkRemoteComponent(node: InstanceNode, report: LibraryUsageReport) {
  try {
    const mainComponent = node.mainComponent;

    if (!mainComponent) return;

    // Check if it's a remote component (from a library)
    if (mainComponent.remote) {
      // Try to get library name
      let libraryName = (mainComponent as any).libraryName;

      // Fallback: parse from component name
      if (!libraryName && mainComponent.name.includes('/')) {
        const parts = mainComponent.name.split('/');
        if (parts.length > 1) {
          libraryName = parts[0];
        }
      }

      // Fallback: use generic name
      if (!libraryName) {
        libraryName = 'Remote Components';
      }

      console.log(`Found remote component: "${mainComponent.name}" from library: "${libraryName}"`);

      report.librariesInUse.add(libraryName);

      const existing = report.remoteComponents.get(mainComponent.key);
      if (existing) {
        existing.instanceCount++;
        existing.instanceIds.push(node.id);
      } else {
        report.remoteComponents.set(mainComponent.key, {
          key: mainComponent.key,
          name: mainComponent.name,
          libraryName,
          instanceCount: 1,
          instanceIds: [node.id],
        });
      }
    }
  } catch (err) {
    console.warn(`Failed to check component for node ${node.id}:`, err);
  }
}

export function getLibrariesFromUsage(report: LibraryUsageReport): string[] {
  return Array.from(report.librariesInUse).sort();
}
