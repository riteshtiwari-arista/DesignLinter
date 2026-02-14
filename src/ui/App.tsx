import React, { useState, useEffect } from "react";
import Tabs from "./components/Tabs";
import IssueList from "./components/IssueList";
import EvidencePanel from "./components/EvidencePanel";
import SettingsPanel from "./components/SettingsPanel";
import EmptyState from "./components/EmptyState";

interface Settings {
  theme: "light" | "dark";
  scanScope: "selection" | "page";
  strictness: "relaxed" | "strict";
  dsLibraryKey?: string;
  requiredStateTags?: string[];
  truthTags?: string[];
}

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

interface LibraryInfo {
  key: string;
  name: string;
}

type Tab = "issues" | "evidence" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("issues");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedNodes, setScannedNodes] = useState(0);
  const [scanProgress, setScanProgress] = useState("");
  const [scanSteps, setScanSteps] = useState<Array<{label: string, status: "pending" | "running" | "done"}>>([]);
  const [resolvedMap, setResolvedMap] = useState<Record<string, "resolved" | "auto-fixed">>({});
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [initProgress, setInitProgress] = useState("Loading settings...");

  useEffect(() => {
    console.log("App mounted");

    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      console.log("Received message:", msg);
      if (!msg) return;

      switch (msg.type) {
        case "INIT_PROGRESS":
          setInitProgress(msg.message);
          break;

        case "INIT":
          console.log("INIT received", msg);
          setSettings(msg.settings);
          setLibraries(msg.libraries);
          applyTheme(msg.settings.theme);
          break;

        case "SCAN_STARTED":
          setScanning(true);
          setFindings([]);
          setResolvedMap({});
          setScanProgress("Initializing scan...");
          setScanSteps([
            { label: "Collecting nodes", status: "pending" },
            { label: "Checking colors", status: "pending" },
            { label: "Checking typography", status: "pending" },
            { label: "Checking effects", status: "pending" },
            { label: "Checking spacing", status: "pending" },
            { label: "Checking border radius", status: "pending" }
          ]);
          break;

        case "SCAN_PROGRESS":
          setScanProgress(msg.message);
          // Update step status based on message
          setScanSteps(prev => {
            const steps = [...prev];
            const message = msg.message.toLowerCase();

            if (message.includes("collected")) {
              steps[0].status = "done";
              steps[1].status = "running";
            } else if (message.includes("colors")) {
              steps[1].status = "done";
              steps[2].status = "running";
            } else if (message.includes("typography")) {
              steps[2].status = "done";
              steps[3].status = "running";
            } else if (message.includes("effects")) {
              steps[3].status = "done";
              steps[4].status = "running";
            } else if (message.includes("spacing")) {
              steps[4].status = "done";
              steps[5].status = "running";
            } else if (message.includes("border radius")) {
              steps[5].status = "done";
            }

            return steps;
          });
          break;

        case "SCAN_COMPLETE":
          setScanning(false);
          setScanProgress("");
          setFindings(msg.findings);
          setScannedNodes(msg.scannedNodes);
          break;

        case "SETTINGS_SAVED":
          // Could show a toast notification
          break;

        case "LIBRARIES_REFRESHED":
          setLibraries(msg.libraries);
          break;

        case "FIX_APPLIED":
          // Mark the fixed finding as "auto-fixed" (resolved)
          if (msg.findingId) {
            setResolvedMap(prev => ({ ...prev, [msg.findingId]: "auto-fixed" }));
          }
          break;

        case "EXTRACTION_STARTED":
          alert("Extracting design system palette...");
          break;

        case "EXTRACTION_COMPLETE":
          // Always log to console
          console.log("========================================");
          console.log("DESIGN SYSTEM PALETTE JSON");
          console.log("========================================");
          console.log(msg.data);
          console.log("========================================");
          console.log("Copy the JSON above and save it as:");
          console.log("src/palettes/geiger-design-system.json");
          console.log("========================================");

          // Try to copy to clipboard (may not work in plugin context)
          navigator.clipboard.writeText(msg.data).then(() => {
            alert(`Palette extracted successfully!\n\nPaint Styles: ${msg.summary.paintStyles}\nText Styles: ${msg.summary.textStyles}\nEffect Styles: ${msg.summary.effectStyles}\nVariables: ${msg.summary.variables}\n\nJSON copied to clipboard AND logged to console.\n\nSave it as:\nsrc/palettes/geiger-design-system.json`);
          }).catch(() => {
            alert(`Palette extracted successfully!\n\nPaint Styles: ${msg.summary.paintStyles}\nText Styles: ${msg.summary.textStyles}\nEffect Styles: ${msg.summary.effectStyles}\nVariables: ${msg.summary.variables}\n\nJSON logged to console (clipboard failed).\n\nOpen console (Cmd+Option+I) and copy the JSON.\nSave it as:\nsrc/palettes/geiger-design-system.json`);
          });
          break;

        case "ERROR":
          alert(`Error: ${msg.message}`);
          setScanning(false);
          break;
      }
    };
  }, []);

  const applyTheme = (theme: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", theme);
  };

  const handleRunScan = () => {
    // Set scanning state immediately for instant UI feedback
    setScanning(true);
    setScanProgress("Initializing scan...");
    setFindings([]);
    parent.postMessage({ pluginMessage: { type: "RUN_SCAN" } }, "*");
  };

  const handleSettingsChange = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated as Settings);
    parent.postMessage({ pluginMessage: { type: "SETTINGS_SAVE", settings: updated } }, "*");

    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }
  };

  const handleRefreshLibraries = () => {
    parent.postMessage({ pluginMessage: { type: "REFRESH_LIBRARIES" } }, "*");
  };

  const handleZoomTo = (findingId: string, nodeId: string) => {
    setSelectedFindingId(findingId);
    parent.postMessage({ pluginMessage: { type: "ZOOM_TO", nodeId } }, "*");
  };

  const handleApplyFix = (findingId: string, nodeId: string, fixPayload: any) => {
    parent.postMessage({ pluginMessage: { type: "APPLY_FIX", findingId, nodeId, fixPayload } }, "*");
  };

  const handleUndoFix = (findingId: string, nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: "UNDO_FIX", findingId, nodeId } }, "*");
  };

  const handleToggleResolved = (findingId: string, nodeId: string, wasAutoFixed: boolean) => {
    // If it was auto-fixed, undo the fix in Figma
    if (wasAutoFixed) {
      handleUndoFix(findingId, nodeId);
    }

    setResolvedMap(prev => {
      const newMap = { ...prev };
      if (newMap[findingId]) {
        delete newMap[findingId]; // Remove resolved state
      } else {
        newMap[findingId] = "resolved"; // Mark as manually resolved
      }
      return newMap;
    });
  };

  const handleCopyAll = () => {
    // Get category names mapping
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

    const lines: string[] = [];
    lines.push("# Design Linter Findings");
    lines.push("");

    const resolvedCount = findings.filter(f => resolvedMap[f.id]).length;
    const unresolvedCount = findings.length - resolvedCount;

    lines.push(`**Total Issues:** ${findings.length}`);
    lines.push(`**Resolved:** ${resolvedCount}`);
    lines.push(`**Unresolved:** ${unresolvedCount}`);
    lines.push("");

    findings.forEach((f, i) => {
      const category = categoryNames[f.ruleId] || f.ruleId;
      const resolvedType = resolvedMap[f.id];
      const status = resolvedType ? (resolvedType === "auto-fixed" ? "Auto-fixed" : "Resolved") : "Unresolved";

      lines.push(`${i + 1}. **${f.message}**`);
      lines.push(`   - Category: ${category}`);
      lines.push(`   - Status: ${status}`);
      lines.push(`   - Node: ${f.nodeName}`);
      lines.push(`   - Page: ${f.pageName}`);
      lines.push(`   - Severity: ${f.severity}`);
      lines.push(`   - Fix: ${f.howToFix}`);
      lines.push("");
    });

    const text = lines.join("\n");

    // Create temporary textarea to copy text
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Copied all findings to clipboard!" } }, "*");
    } catch (err) {
      parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Failed to copy to clipboard" } }, "*");
    }

    document.body.removeChild(textarea);
  };

  console.log("Render - settings:", settings);

  if (!settings) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: "24px",
        textAlign: "center"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid #E8EFF8",
          borderTopColor: "#5B8FD6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: "20px"
        }} />
        <div style={{
          fontSize: "14px",
          color: "#2D4461",
          fontWeight: 500
        }}>
          {initProgress}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Tabs activeTab={tab} onTabChange={setTab} findingsCount={findings.length} />

      <div style={{ flex: 1, overflow: "auto", position: "relative", background: "var(--bg-secondary)" }}>
        {tab === "issues" && (
          scanning ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                padding: "40px 24px"
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                border: "4px solid #E8EFF8",
                borderTopColor: "#5B8FD6",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginBottom: "24px"
              }} />
              <div style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#2D4461",
                marginBottom: "28px"
              }}>
                Scanning your design...
              </div>
              <div style={{
                width: "100%",
                maxWidth: "280px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {scanSteps
                  .filter(step => step.status !== "pending")
                  .map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 0",
                        animation: "fadeIn 0.3s ease-in"
                      }}
                    >
                      <div style={{
                        width: "16px",
                        height: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}>
                        {step.status === "done" ? (
                          <span style={{
                            color: "#34A853",
                            fontSize: "12px",
                            fontWeight: 600,
                            animation: "pulse 1.5s ease-in-out infinite"
                          }}>...</span>
                        ) : (
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              border: "2px solid #E8EFF8",
                              borderTopColor: "#5B8FD6",
                              borderRadius: "50%",
                              animation: "spin 0.6s linear infinite"
                            }}
                          />
                        )}
                      </div>
                      <span style={{
                        fontSize: "13px",
                        color: "#2D4461",
                        fontWeight: step.status === "running" ? 500 : 400
                      }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : findings.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <EmptyState
                message={scannedNodes > 0 ? "No issues found!" : "Run a scan to check for issues"}
              />
              <div style={{ padding: "18px", borderTop: "1px solid var(--border-color)", background: "white" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleRunScan}
                  style={{ width: "100%" }}
                >
                  Run Scan
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ flex: 1, overflow: "auto" }}>
                <IssueList
                  findings={findings}
                  onZoom={handleZoomTo}
                  onFix={handleApplyFix}
                  resolvedMap={resolvedMap}
                  onToggleResolved={handleToggleResolved}
                  selectedFindingId={selectedFindingId}
                  onUndoFix={handleUndoFix}
                />
              </div>
              <div style={{ padding: "18px", borderTop: "1px solid var(--border-color)", background: "white", display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleCopyAll}
                  style={{ flex: 1 }}
                >
                  Copy All ({findings.length})
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleRunScan}
                  style={{ flex: 1 }}
                >
                  Re-Run
                </button>
              </div>
            </div>
          )
        )}

        {tab === "evidence" && (
          <EvidencePanel findings={findings} />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={settings}
            libraries={libraries}
            onSettingsChange={handleSettingsChange}
            onRefreshLibraries={handleRefreshLibraries}
          />
        )}
      </div>
    </div>
  );
}
