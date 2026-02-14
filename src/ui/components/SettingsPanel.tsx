import React, { useState, useEffect } from "react";

interface Settings {
  theme: "light" | "dark";
  scanScope: "selection" | "page" | "all-pages";
  strictness: "relaxed" | "strict";
  dsLibraryKey?: string;
  requiredStateTags?: string[];
  truthTags?: string[];
}

interface LibraryInfo {
  key: string;
  name: string;
}

interface SettingsPanelProps {
  settings: Settings;
  libraries: LibraryInfo[];
  onSettingsChange: (settings: Partial<Settings>) => void;
  onRefreshLibraries: () => void;
}

export default function SettingsPanel({
  settings,
  libraries,
  onSettingsChange,
  onRefreshLibraries
}: SettingsPanelProps) {

  return (
    <div style={{ padding: "18px" }}>
      <Section title="Appearance">
        <Field label="Theme">
          <RadioGroup
            name="theme"
            value={settings.theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" }
            ]}
            onChange={(value) => onSettingsChange({ theme: value as "light" | "dark" })}
          />
        </Field>
      </Section>

      <Section title="Scan Options">
        <Field label="Scope">
          <RadioGroup
            name="scope"
            value={settings.scanScope}
            options={[
              { value: "selection", label: "Selection Only" },
              { value: "page", label: "Current Page" },
              { value: "all-pages", label: "All Pages" }
            ]}
            onChange={(value) => onSettingsChange({ scanScope: value as "selection" | "page" | "all-pages" })}
          />
        </Field>

        <Field label="Strictness">
          <RadioGroup
            name="strictness"
            value={settings.strictness}
            options={[
              { value: "relaxed", label: "Relaxed (warnings)" },
              { value: "strict", label: "Strict (blocking)" }
            ]}
            onChange={(value) => onSettingsChange({ strictness: value as "relaxed" | "strict" })}
          />
        </Field>
      </Section>

      <Section title="Design System Library">
        <Field label="Select Library">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <select
              value={settings.dsLibraryKey || ""}
              onChange={(e) => onSettingsChange({ dsLibraryKey: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="">None selected</option>
              {libraries.map((lib) => (
                <option key={lib.key} value={lib.key}>
                  {lib.name}
                </option>
              ))}
            </select>

            <button className="btn btn-secondary btn-sm" onClick={onRefreshLibraries}>
              Refresh Libraries
            </button>
          </div>
        </Field>

        {libraries.length === 0 && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              padding: "12px",
              background: "var(--bg-secondary)",
              borderRadius: "0",
              border: "1px solid var(--border-color)"
            }}
          >
            No libraries found. Make sure you have enabled libraries in this file via Assets → Team Libraries.
          </div>
        )}
      </Section>

      <Section title="Required State Tags">
        <Field label="Tags">
          <textarea
            value={settings.requiredStateTags?.join(", ") || ""}
            onChange={(e) =>
              onSettingsChange({
                requiredStateTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              })
            }
            rows={3}
            placeholder="state:loading, state:empty, state:error"
            style={{ width: "100%", resize: "vertical" }}
          />
        </Field>
      </Section>

      <Section title="Truth/Data Context Tags">
        <Field label="Tags">
          <textarea
            value={settings.truthTags?.join(", ") || ""}
            onChange={(e) =>
              onSettingsChange({
                truthTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              })
            }
            rows={3}
            placeholder="truth:source, truth:freshness, truth:scope"
            style={{ width: "100%", resize: "vertical" }}
          />
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "16px",
        background: "var(--bg-primary)",
        border: "1px solid var(--border-color)",
        borderRadius: "0"
      }}
    >
      <h3
        style={{
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "14px",
          color: "var(--text-primary)"
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          marginBottom: "6px",
          color: "var(--text-primary)",
          fontWeight: 500
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function RadioGroup({
  name,
  value,
  options,
  onChange
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {options.map((option) => (
        <label
          key={option.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--text-primary)"
          }}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "16px",
              height: "16px",
              cursor: "pointer",
              accentColor: "#5B8FD6"
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
