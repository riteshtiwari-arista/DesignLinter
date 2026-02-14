import React from "react";

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  findingsCount: number;
}

export default function Tabs({ activeTab, onTabChange, findingsCount }: TabsProps) {
  const tabs = [
    { id: "issues", label: "Issues", count: findingsCount },
    { id: "evidence", label: "Evidence" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <div
      style={{
        display: "flex",
        background: "#3B5F96"
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: "14px 24px",
            fontWeight: 500,
            fontSize: "14px",
            color: "white",
            background: activeTab === tab.id ? "#2D4461" : "transparent",
            transition: "all 0.15s",
            border: "none",
            cursor: "pointer"
          }}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              style={{
                marginLeft: "8px",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
