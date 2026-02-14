import React, { useState } from "react";
import IssueRow from "./IssueRow";

interface Finding {
  id: string;
  principle: string;
  severity: "info" | "warn" | "block";
  ruleId: string;
  nodeId: string;
  nodeName: string;
  pageName: string;
  message: string;
  howToFix: string;
  canAutoFix: boolean;
  fixPayload?: any;
}

interface IssueListProps {
  findings: Finding[];
  onZoom: (nodeId: string) => void;
  onFix: (findingId: string, nodeId: string, fixPayload: any) => void;
  resolvedMap: Record<string, "resolved" | "auto-fixed">;
  onToggleResolved: (findingId: string) => void;
  selectedNodeId: string | null;
}

export default function IssueList({ findings, onZoom, onFix, resolvedMap, onToggleResolved, selectedNodeId }: IssueListProps) {
  // Map rule IDs to friendly category names
  const categoryNames: Record<string, string> = {
    "tokens.colors": "Colors",
    "tokens.colors.fill": "Colors",
    "tokens.colors.stroke": "Colors",
    "tokens.typography": "Typography",
    "tokens.effects": "Effects",
    "consistency.spacing": "Spacing",
    "consistency.padding": "Spacing",
    "consistency.borderRadius": "Border Radius",
    "requiredStates": "Required States",
    "truthMetadata": "Truth Metadata"
  };

  // Filter state: 'all', 'resolved', 'unresolved'
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');

  // Filter findings based on filter state
  const filteredFindings = findings.filter(finding => {
    const isResolved = resolvedMap[finding.id] || false;
    if (filter === 'resolved') return isResolved;
    if (filter === 'unresolved') return !isResolved;
    return true; // 'all'
  });

  // Group by rule type (category)
  const grouped = filteredFindings.reduce((acc, finding) => {
    const category = categoryNames[finding.ruleId] || finding.ruleId;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  // Sort categories with custom order (annotation checks last)
  const categoryOrder = [
    "Colors",
    "Typography",
    "Effects",
    "Spacing",
    "Border Radius",
    "Required States",
    "Truth Metadata"
  ];

  const categories = Object.keys(grouped).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);

    // If both are in the order list, use that order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only one is in the list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // Otherwise alphabetical
    return a.localeCompare(b);
  });

  // Track which sections are expanded (default: all expanded)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    categories.reduce((acc, c) => {
      acc[c] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleSection = (category: string) => {
    setExpanded(prev => Object.assign({}, prev, { [category]: !prev[category] }));
  };

  const toggleAll = () => {
    const allExpanded = categories.every(c => expanded[c]);
    const newState = categories.reduce((acc, c) => {
      acc[c] = !allExpanded;
      return acc;
    }, {} as Record<string, boolean>);
    setExpanded(newState);
  };

  const allExpanded = categories.every(c => expanded[c]);

  return (
    <div style={{ padding: "18px" }}>
      {/* Filter Controls */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setFilter('all')}
            className="btn-sm"
            style={{
              background: filter === 'all' ? '#5B8FD6' : '#E8EFF8',
              color: filter === 'all' ? 'white' : '#5B8FD6'
            }}
          >
            All ({findings.length})
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className="btn-sm"
            style={{
              background: filter === 'unresolved' ? '#5B8FD6' : '#E8EFF8',
              color: filter === 'unresolved' ? 'white' : '#5B8FD6'
            }}
          >
            Unresolved ({findings.filter(f => !resolvedMap[f.id]).length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className="btn-sm"
            style={{
              background: filter === 'resolved' ? '#5B8FD6' : '#E8EFF8',
              color: filter === 'resolved' ? 'white' : '#5B8FD6'
            }}
          >
            Resolved ({findings.filter(f => resolvedMap[f.id]).length})
          </button>
        </div>

        {/* Expand/Collapse All */}
        {categories.length > 1 && (
          <button
            onClick={toggleAll}
            className="btn-sm"
            style={{
              color: "#5B8FD6",
              fontSize: "12px",
              fontWeight: 500,
              background: "transparent"
            }}
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        )}
      </div>

      {categories.map((category) => {
        const items = grouped[category];
        const blockCount = items.filter(f => f.severity === "block").length;
        const warnCount = items.filter(f => f.severity === "warn").length;
        const infoCount = items.filter(f => f.severity === "info").length;
        const isExpanded = expanded[category];

        return (
          <div key={category} style={{ marginBottom: "14px" }}>
            <div
              onClick={() => toggleSection(category)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                marginBottom: isExpanded ? "10px" : "0",
                borderRadius: "0",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s"
              }}
            >
              {/* Chevron */}
              <span
                style={{
                  fontSize: "10px",
                  transition: "transform 0.15s",
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                  width: "12px",
                  color: "var(--text-secondary)"
                }}
              >
                ▶
              </span>

              <h2 style={{ fontSize: "14px", fontWeight: 600, flex: 1, color: "var(--text-primary)" }}>
                {category}
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                {items.length}
              </span>
              {blockCount > 0 && <span className="badge badge-block">{blockCount}</span>}
              {warnCount > 0 && <span className="badge badge-warn">{warnCount}</span>}
              {infoCount > 0 && <span className="badge badge-info">{infoCount}</span>}
            </div>

            {isExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {items.map((finding) => (
                  <IssueRow
                    key={finding.id}
                    finding={finding}
                    onZoom={onZoom}
                    onFix={onFix}
                    resolvedType={resolvedMap[finding.id]}
                    onToggleResolved={() => onToggleResolved(finding.id)}
                    isSelected={selectedNodeId === finding.nodeId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
