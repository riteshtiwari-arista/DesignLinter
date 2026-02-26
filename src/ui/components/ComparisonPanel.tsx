import React, { useState } from "react";

interface ComparisonDiff {
  type: "CHANGED" | "NEW" | "REMOVED" | "RENAMED" | "INSIGHT";
  category: "variable" | "paintStyle" | "textStyle" | "effectStyle" | "structural" | "component" | "recommendation";
  name: string;
  fromValue?: string;
  toValue?: string;
  collectionName?: string;
  migrationHint?: string;
}

interface ComparisonResult {
  baseline: string;
  target: string;
  differences: ComparisonDiff[];
  timestamp: number;
}

interface ComparisonPanelProps {
  result: ComparisonResult | null;
  comparing: boolean;
  onRunComparison: (baselineKey: string) => void;
  availableBaselines: Array<{ key: string; name: string }>;
}

export default function ComparisonPanel({
  result,
  comparing,
  onRunComparison,
  availableBaselines
}: ComparisonPanelProps) {
  const [selectedBaseline, setSelectedBaseline] = useState<string>(
    availableBaselines.length > 0 ? availableBaselines[0].key : ""
  );

  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const toggleCollection = (name: string) => {
    const next = new Set(expandedCollections);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedCollections(next);
  };

  const expandAll = () => {
    if (result) {
      const allCollections = new Set(result.differences.map(d => d.collectionName || "Other"));
      setExpandedCollections(allCollections);
    }
  };

  const collapseAll = () => {
    setExpandedCollections(new Set());
  };

  const toggleTypeFilter = (type: string) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedTypes(new Set());
  };

  // Group differences by collection with filtering
  const groupedDiffs = React.useMemo(() => {
    if (!result) return new Map();

    // Filter differences
    let filtered = result.differences;

    // Filter by search text
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(diff =>
        diff.name.toLowerCase().includes(search) ||
        (diff.collectionName || "").toLowerCase().includes(search)
      );
    }

    // Filter by type
    if (selectedTypes.size > 0) {
      filtered = filtered.filter(diff => selectedTypes.has(diff.type));
    }

    // Group by collection
    const groups = new Map<string, ComparisonDiff[]>();
    for (const diff of filtered) {
      const collection = diff.collectionName || "Other";
      if (!groups.has(collection)) {
        groups.set(collection, []);
      }
      groups.get(collection)!.push(diff);
    }
    return groups;
  }, [result, searchText, selectedTypes]);

  const exportReport = () => {
    if (!result) return;

    const lines: string[] = [];
    lines.push(`Design System Comparison Report`);
    lines.push(`Baseline: ${result.baseline}`);
    lines.push(`Target: ${result.target}`);
    lines.push(`Generated: ${new Date(result.timestamp).toLocaleString()}`);
    lines.push(`Total Differences: ${result.differences.length}`);
    lines.push(``);

    for (const [collectionName, diffs] of groupedDiffs) {
      lines.push(`COLLECTION: ${collectionName} (${diffs.length})`);

      // Show insights first
      const insights = diffs.filter(d => d.type === "INSIGHT");
      if (insights.length > 0) {
        lines.push(`\n  === STRUCTURAL INSIGHTS ===`);
        for (const diff of insights) {
          lines.push(`  ${diff.name}`);
          if (diff.fromValue) lines.push(`    ${diff.fromValue}`);
          if (diff.toValue) lines.push(`    ${diff.toValue}`);
        }
        lines.push(``);
      }

      // Then show regular diffs
      const regularDiffs = diffs.filter(d => d.type !== "INSIGHT");
      if (regularDiffs.length > 0) {
        lines.push(`  === DETAILED CHANGES ===`);
        for (const diff of regularDiffs) {
          if (diff.type === "CHANGED") {
            lines.push(`  CHANGED: ${diff.name}`);
            lines.push(`    ${diff.fromValue} → ${diff.toValue}`);
            if ((diff as any).details) {
              lines.push(`    Details: ${(diff as any).details}`);
            }
          } else if (diff.type === "RENAMED") {
            lines.push(`  RENAMED: ${diff.name}`);
            lines.push(`    Value: ${diff.fromValue}`);
          } else if (diff.type === "NEW") {
            lines.push(`  NEW: ${diff.name}`);
            lines.push(`    ${diff.toValue}`);
          } else {
            lines.push(`  REMOVED: ${diff.name}`);
            lines.push(`    ${diff.fromValue}`);
          }
        }
      }
      lines.push(``);
    }

    const text = lines.join("\n");

    // Copy to clipboard using modern API
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Report copied to clipboard!" } }, "*");
      }).catch(() => {
        parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Failed to copy report" } }, "*");
      });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Report copied to clipboard!" } }, "*");
      } catch (e) {
        parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Failed to copy report" } }, "*");
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div style={{ padding: "18px" }}>
      <div style={{
        marginBottom: "20px",
        padding: "16px",
        background: "var(--bg-primary)",
        border: "1px solid var(--border-color)"
      }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "14px" }}>
          Compare Design Systems
        </h3>

        <div style={{ marginBottom: "12px" }}>
          <label style={{
            display: "block",
            fontSize: "12px",
            marginBottom: "6px",
            fontWeight: 500
          }}>
            Baseline (Production):
          </label>
          <select
            value={selectedBaseline}
            onChange={(e) => setSelectedBaseline(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", fontSize: "12px" }}
            disabled={comparing}
          >
            {availableBaselines.map(baseline => (
              <option key={baseline.key} value={baseline.key}>
                {baseline.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={{
            display: "block",
            fontSize: "12px",
            marginBottom: "6px",
            fontWeight: 500
          }}>
            Compare against:
          </label>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Current file (live extraction)
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => onRunComparison(selectedBaseline)}
          disabled={comparing || !selectedBaseline}
          style={{ width: "100%" }}
        >
          {comparing ? "Comparing..." : "Run Comparison"}
        </button>
      </div>

      {result && (
        <div style={{
          padding: "16px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
              {result.baseline} → {result.target}: {
                Array.from(groupedDiffs.values()).reduce((sum, diffs) => sum + diffs.length, 0)
              } / {result.differences.length} differences
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-secondary btn-sm" onClick={expandAll}>
                Expand All
              </button>
              <button className="btn btn-secondary btn-sm" onClick={collapseAll}>
                Collapse All
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportReport}>
                Export Report
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "12px",
                border: "1px solid var(--border-color)",
                marginBottom: "12px"
              }}
            />

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)" }}>Filter:</span>
              {["CHANGED", "RENAMED", "NEW", "REMOVED", "INSIGHT"].map(type => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 500,
                    border: "1px solid var(--border-color)",
                    background: selectedTypes.has(type) ? "#5B8FD6" : "transparent",
                    color: selectedTypes.has(type) ? "white" : "var(--text-primary)",
                    cursor: "pointer",
                    borderRadius: "12px"
                  }}
                >
                  {type}
                </button>
              ))}
              {(searchText || selectedTypes.size > 0) && (
                <button
                  onClick={clearFilters}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 500,
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "#DC3545",
                    cursor: "pointer",
                    borderRadius: "12px"
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {result.differences.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
              No differences found. Design systems are identical.
            </div>
          ) : (
            <div>
              {Array.from(groupedDiffs.entries()).map(([collectionName, diffs]) => {
                const isExpanded = expandedCollections.has(collectionName);
                const changed = diffs.filter(d => d.type === "CHANGED" && d.category !== "recommendation").length;
                const renamed = diffs.filter(d => d.type === "RENAMED").length;
                const added = diffs.filter(d => d.type === "NEW").length;
                const removed = diffs.filter(d => d.type === "REMOVED").length;
                const recommendations = diffs.filter(d => d.category === "recommendation").length;
                const isRecommendations = collectionName === "Recommendations";

                return (
                  <div key={collectionName} style={{ marginBottom: "12px" }}>
                    <div
                      onClick={() => toggleCollection(collectionName)}
                      style={{
                        padding: "10px 12px",
                        background: isRecommendations ? "#FFF9E6" : "#F5F7FA",
                        border: isRecommendations ? "1px solid #FFE066" : "1px solid var(--border-color)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 600, color: isRecommendations ? "#8B6914" : "inherit" }}>
                        {isExpanded ? "▼" : "▶"} {collectionName} ({diffs.length})
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {changed > 0 && <span style={{ marginRight: "8px" }}>Changed: {changed}</span>}
                        {renamed > 0 && <span style={{ marginRight: "8px" }}>Renamed: {renamed}</span>}
                        {added > 0 && <span style={{ marginRight: "8px" }}>New: {added}</span>}
                        {removed > 0 && <span style={{ marginRight: "8px" }}>Removed: {removed}</span>}
                        {recommendations > 0 && <span style={{ color: "#FF9500", fontWeight: 600 }}>Recommendations: {recommendations}</span>}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        border: "1px solid var(--border-color)",
                        borderTop: "none",
                        padding: "12px"
                      }}>
                        {/* Show insights first */}
                        {diffs.filter(d => d.type === "INSIGHT").map((diff, i) => {
                          const isRecommendation = diff.category === "recommendation";
                          return (
                            <div
                              key={`insight-${i}`}
                              style={{
                                marginBottom: "12px",
                                padding: "10px",
                                background: isRecommendation ? "#FFF9E6" : "#F0F7FF",
                                border: isRecommendation ? "1px solid #FFB020" : "1px solid #5B8FD6",
                                borderRadius: "4px"
                              }}
                            >
                              <div style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                marginBottom: "4px",
                                color: isRecommendation ? "#8B6914" : "#2D4461"
                              }}>
                                {diff.name}
                              </div>
                              {diff.fromValue && (
                                <div style={{ fontSize: "11px", color: isRecommendation ? "#FF9500" : "#5B8FD6", marginBottom: "2px" }}>
                                  {diff.fromValue}
                                </div>
                              )}
                              {diff.toValue && (
                                <div style={{ fontSize: "11px", color: isRecommendation ? "#FF9500" : "#5B8FD6" }}>
                                  {diff.toValue}
                                </div>
                              )}
                              {diff.migrationHint && (
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", fontStyle: "italic" }}>
                                  {diff.migrationHint}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Then show regular diffs */}
                        {diffs.filter(d => d.type !== "INSIGHT").map((diff, i) => (
                          <div
                            key={i}
                            style={{
                              marginBottom: "10px",
                              paddingBottom: "10px",
                              borderBottom: i < diffs.length - 1 ? "1px solid #E8EFF8" : "none"
                            }}
                          >
                            <div style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              marginBottom: "4px",
                              color: diff.type === "CHANGED" ? "#FF9500" :
                                     diff.type === "RENAMED" ? "#5B8FD6" :
                                     diff.type === "NEW" ? "#34A853" : "#DC3545"
                            }}>
                              {diff.type}: {diff.name}
                            </div>
                            {diff.type === "CHANGED" && (
                              <>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                  {diff.fromValue} → {diff.toValue}
                                </div>
                                {(diff as any).details && (
                                  <div style={{
                                    fontSize: "11px",
                                    color: "var(--text-primary)",
                                    marginTop: "6px",
                                    padding: "6px 8px",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-color)",
                                    fontFamily: "monospace"
                                  }}>
                                    {(diff as any).details}
                                  </div>
                                )}
                                {diff.migrationHint && (
                                  <div style={{ fontSize: "11px", color: "#FF9500", marginTop: "4px", fontWeight: 500 }}>
                                    {diff.migrationHint}
                                  </div>
                                )}
                              </>
                            )}
                            {diff.type === "RENAMED" && (
                              <>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                  Value: {diff.fromValue}
                                </div>
                                {diff.migrationHint && (
                                  <div style={{ fontSize: "11px", color: "#5B8FD6", marginTop: "4px", fontWeight: 500 }}>
                                    {diff.migrationHint}
                                  </div>
                                )}
                              </>
                            )}
                            {diff.type === "NEW" && (
                              <>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                  {diff.toValue}
                                </div>
                                {diff.migrationHint && (
                                  <div style={{ fontSize: "11px", color: "#34A853", marginTop: "4px", fontWeight: 500 }}>
                                    {diff.migrationHint}
                                  </div>
                                )}
                              </>
                            )}
                            {diff.type === "REMOVED" && (
                              <>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                  {diff.fromValue}
                                </div>
                                {diff.migrationHint && (
                                  <div style={{ fontSize: "11px", color: "#DC3545", marginTop: "4px", fontWeight: 500 }}>
                                    {diff.migrationHint}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
