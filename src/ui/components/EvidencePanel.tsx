import React, { useState } from "react";

interface Finding {
  principle: string;
  severity: string;
  message: string;
}

interface EvidencePanelProps {
  findings: Finding[];
}

export default function EvidencePanel({ findings }: EvidencePanelProps) {
  const [copied, setCopied] = useState(false);

  const generateEvidence = () => {
    const lines: string[] = [];
    lines.push("# Design Linter Evidence");
    lines.push("");
    lines.push(`**Scan Date:** ${new Date().toLocaleDateString()}`);
    lines.push(`**Total Issues:** ${findings.length}`);
    lines.push("");

    // Group by principle
    const grouped = findings.reduce((acc, f) => {
      if (!acc[f.principle]) acc[f.principle] = [];
      acc[f.principle].push(f);
      return acc;
    }, {} as Record<string, Finding[]>);

    for (const [principle, items] of Object.entries(grouped)) {
      const blockCount = items.filter(f => f.severity === "block").length;
      const warnCount = items.filter(f => f.severity === "warn").length;
      const infoCount = items.filter(f => f.severity === "info").length;

      lines.push(`## ${principle}`);
      lines.push(`- Total: ${items.length} (${blockCount} blocking, ${warnCount} warnings, ${infoCount} info)`);
      lines.push("");
    }

    lines.push("## Summary");
    lines.push("Design review completed using Arista Principles Linter.");
    lines.push("");

    return lines.join("\n");
  };

  const handleCopy = () => {
    const evidence = generateEvidence();

    // Create temporary textarea to copy text
    const textarea = document.createElement('textarea');
    textarea.value = evidence;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Evidence copied to clipboard!" } }, "*");
    } catch (err) {
      parent.postMessage({ pluginMessage: { type: "NOTIFY", message: "Failed to copy to clipboard" } }, "*");
    }

    document.body.removeChild(textarea);
  };

  const evidence = generateEvidence();

  return (
    <div style={{ padding: "18px" }}>
      <div
        style={{
          marginBottom: "16px",
          padding: "16px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "0"
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
          Evidence Block
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          Copy this summary to include in Jira tickets or design reviews.
        </p>
      </div>

      <div
        style={{
          background: "#F7F9FC",
          border: "1px solid var(--border-color)",
          borderRadius: "0",
          padding: "14px",
          fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          marginBottom: "14px",
          maxHeight: "320px",
          overflow: "auto",
          lineHeight: "1.6",
          color: "var(--text-primary)"
        }}
      >
        {evidence}
      </div>

      <button className="btn btn-primary" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy to Clipboard"}
      </button>
    </div>
  );
}
