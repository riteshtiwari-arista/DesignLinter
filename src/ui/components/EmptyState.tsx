import React from "react";

interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "32px",
        textAlign: "center"
      }}
    >
      <div>
        {/* Clean checklist icon in Arista blue */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          style={{ margin: "0 auto 16px", opacity: 0.4 }}
        >
          <rect x="14" y="8" width="36" height="48" rx="2" stroke="#5B8FD6" strokeWidth="2" fill="none"/>
          <line x1="22" y1="20" x2="42" y2="20" stroke="#5B8FD6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="22" y1="28" x2="42" y2="28" stroke="#5B8FD6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="22" y1="36" x2="42" y2="36" stroke="#5B8FD6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="22" y1="44" x2="35" y2="44" stroke="#5B8FD6" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          fontWeight: 500
        }}>
          {message}
        </div>
      </div>
    </div>
  );
}
