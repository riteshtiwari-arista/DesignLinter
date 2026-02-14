import React from "react";

interface TopBarProps {
  onClose: () => void;
}

export default function TopBar({ onClose }: TopBarProps) {
  return (
    <div
      style={{
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "white",
        borderBottom: "1px solid var(--border-color)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Arista Logo - Triangular A */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3L22 20H18L16.5 17H13.5L12 20H2L12 3ZM12 9L10 13H14L12 9Z" fill="#2D4461"/>
        </svg>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#2D4461", letterSpacing: "0.3px" }}>
            ARISTA
          </span>
          <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>
            Design Linter
          </span>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-secondary)",
          fontSize: "13px",
          cursor: "pointer",
          fontWeight: 500,
          padding: "4px 8px"
        }}
      >
        Close
      </button>
    </div>
  );
}
