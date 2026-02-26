import React from "react";

interface Finding {
  id: string;
  severity: "info" | "warn" | "block";
  nodeId: string;
  nodeName: string;
  message: string;
  howToFix: string;
  canAutoFix: boolean;
  fixPayload?: any;
}

interface IssueRowProps {
  finding: Finding;
  onZoom: (findingId: string, nodeId: string) => void;
  onFix: (findingId: string, nodeId: string, fixPayload: any) => void;
  resolvedType?: "resolved" | "auto-fixed";
  onToggleResolved: () => void;
  isSelected: boolean;
}

export default function IssueRow({ finding, onZoom, onFix, resolvedType, onToggleResolved, isSelected }: IssueRowProps) {

  return (
    <div
      onClick={() => onZoom(finding.id, finding.nodeId)}
      style={{
        padding: "14px",
        background: isSelected ? "#E8F0FE" : "white",
        borderRadius: "0",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
        transition: "all 0.2s",
        cursor: "pointer"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
        <span className={`badge badge-${finding.severity}`}>
          {finding.severity}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: "13px", marginBottom: "4px", color: "var(--text-primary)" }}>
            {finding.message}
          </div>
          <div
            style={{ fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-word" }}
            title={finding.nodeName}
          >
            {finding.nodeName.length > 100 ? finding.nodeName.substring(0, 100) + '...' : finding.nodeName}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          marginBottom: "12px",
          paddingLeft: "12px",
          borderLeft: "3px solid var(--arista-blue-light)",
          lineHeight: "1.6"
        }}
      >
        {finding.howToFix}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Show label pill if resolved */}
          {resolvedType ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                background: resolvedType === "auto-fixed" ? "#D1ECEC" : "#E3F2FD",
                color: resolvedType === "auto-fixed" ? "#2D5555" : "#1976D2",
                border: resolvedType === "auto-fixed" ? "1px solid #A8D5D5" : "1px solid #BBDEFB"
              }}
            >
              {resolvedType === "auto-fixed" ? "auto-fixed" : "resolved"}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleResolved();
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                  color: "inherit",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                ×
              </button>
            </span>
          ) : (
            <>
              {finding.canAutoFix && finding.fixPayload && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFix(finding.id, finding.nodeId, finding.fixPayload);
                  }}
                >
                  Auto-fix
                </button>
              )}

              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleResolved();
                }}
                style={{
                  background: "#E6F7ED",
                  color: "#0F7F3F"
                }}
              >
                Mark Resolved
              </button>
            </>
          )}
        </div>

        {/* Library name label (bottom-right) */}
        {finding.fixPayload?.libraryName && (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "12px",
              fontSize: "10px",
              fontWeight: 600,
              background: "#F0F5FA",
              color: "#5B8FD6",
              border: "1px solid #D1E3F5",
              whiteSpace: "nowrap"
            }}
          >
            {finding.fixPayload.libraryName}
          </span>
        )}
      </div>
    </div>
  );
}
