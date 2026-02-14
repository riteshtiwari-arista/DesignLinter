import type { Finding, Principle } from "./types";

export interface GroupedFindings {
  principle: Principle;
  findings: Finding[];
  counts: {
    info: number;
    warn: number;
    block: number;
  };
}

export function groupFindingsByPrinciple(findings: Finding[]): GroupedFindings[] {
  const groups = new Map<Principle, Finding[]>();

  for (const finding of findings) {
    const existing = groups.get(finding.principle) || [];
    existing.push(finding);
    groups.set(finding.principle, existing);
  }

  const result: GroupedFindings[] = [];

  for (const [principle, principleFindings] of groups) {
    const counts = {
      info: principleFindings.filter(f => f.severity === "info").length,
      warn: principleFindings.filter(f => f.severity === "warn").length,
      block: principleFindings.filter(f => f.severity === "block").length
    };

    result.push({ principle, findings: principleFindings, counts });
  }

  return result.sort((a, b) => a.principle.localeCompare(b.principle));
}

export function generateJiraSummary(findings: Finding[]): string {
  const grouped = groupFindingsByPrinciple(findings);
  const lines: string[] = ["Design Linter Results"];

  for (const group of grouped) {
    const total = group.findings.length;
    const { info, warn, block } = group.counts;
    lines.push(`${group.principle}: ${total} issues (${block} blocking, ${warn} warnings, ${info} info)`);
  }

  return lines.join("\n");
}

export function generateJSONExport(findings: Finding[]) {
  return {
    timestamp: new Date().toISOString(),
    totalIssues: findings.length,
    byPrinciple: groupFindingsByPrinciple(findings),
    findings
  };
}
