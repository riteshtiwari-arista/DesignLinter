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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    console.log("App mounted");

    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      console.log("Received message:", msg);
      if (!msg) return;

      switch (msg.type) {
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

  const handleZoomTo = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    parent.postMessage({ pluginMessage: { type: "ZOOM_TO", nodeId } }, "*");
  };

  const handleApplyFix = (findingId: string, nodeId: string, fixPayload: any) => {
    parent.postMessage({ pluginMessage: { type: "APPLY_FIX", findingId, nodeId, fixPayload } }, "*");
  };

  const handleToggleResolved = (findingId: string) => {
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
      <div style={{ padding: "24px", textAlign: "center", color: "#333" }}>
        <div>Loading settings...</div>
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
              {/* Animated scanning layers */}
              <div style={{
                position: "relative",
                width: "120px",
                height: "120px",
                marginBottom: "32px"
              }}>
                {/* Background layers */}
                <div style={{
                  position: "absolute",
                  top: "20px",
                  left: "10px",
                  width: "100px",
                  height: "80px",
                  background: "#F7F9FC",
                  border: "2px solid #E0E5EB",
                  borderRadius: "8px",
                  opacity: 0.4
                }} />
                <div style={{
                  position: "absolute",
                  top: "10px",
                  left: "5px",
                  width: "100px",
                  height: "80px",
                  background: "#F7F9FC",
                  border: "2px solid #E0E5EB",
                  borderRadius: "8px",
                  opacity: 0.6
                }} />
                <div style={{
                  position: "absolute",
                  top: "0px",
                  left: "0px",
                  width: "100px",
                  height: "80px",
                  background: "white",
                  border: "2px solid #5B8FD6",
                  borderRadius: "8px",
                  overflow: "hidden"
                }}>
                  {/* Scanning beam */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "3px",
                    background: "linear-gradient(90deg, transparent, #5B8FD6, transparent)",
                    animation: "scan 2s ease-in-out infinite"
                  }} />
                  {/* Checkmark that appears */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "32px",
                    color: "#5B8FD6",
                    animation: "fadeInOut 2s ease-in-out infinite"
                  }}>
                    &#10003;
                  </div>
                </div>
                {/* Magnifying glass */}
                <div style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  width: "40px",
                  height: "40px",
                  border: "3px solid #5B8FD6",
                  borderRadius: "50%",
                  background: "white",
                  animation: "pulse 2s ease-in-out infinite"
                }}>
                  <div style={{
                    position: "absolute",
                    bottom: "-18px",
                    right: "-8px",
                    width: "3px",
                    height: "20px",
                    background: "#5B8FD6",
                    transform: "rotate(45deg)",
                    borderRadius: "2px"
                  }} />
                </div>
              </div>
              <div style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#2D4461",
                marginBottom: "24px"
              }}>
                Scanning your design...
              </div>
              <div style={{
                width: "100%",
                maxWidth: "320px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {scanSteps.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      background: step.status === "running" ? "#F0F5FA" : "white",
                      border: `1px solid ${step.status === "running" ? "#5B8FD6" : "#E0E5EB"}`,
                      borderRadius: "6px",
                      transition: "all 0.3s ease"
                    }}
                  >
                    <div style={{
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {step.status === "done" ? (
                        <span style={{ color: "#34A853", fontSize: "16px" }}>&#10003;</span>
                      ) : step.status === "running" ? (
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #E8EFF8",
                            borderTopColor: "#5B8FD6",
                            borderRadius: "50%",
                            animation: "spin 0.6s linear infinite"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#E0E5EB"
                          }}
                        />
                      )}
                    </div>
                    <span style={{
                      fontSize: "13px",
                      color: step.status === "pending" ? "#9B9B9B" : "#2C2C2C",
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
                  selectedNodeId={selectedNodeId}
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
