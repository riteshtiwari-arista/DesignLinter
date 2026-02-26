import React, { useState, useEffect } from "react";

interface Settings {
  theme: "light" | "dark";
  scanScope: "selection" | "page" | "all-pages";
  strictness: "relaxed" | "strict";
  dsLibraryKey?: string;
  requiredStateTags?: string[];
  truthTags?: string[];
  ignoreHiddenFills?: boolean;
  ignoreZeroOpacity?: boolean;
  ignoreTransparentColors?: boolean;
  helpUrl?: string;
}

interface LibraryInfo {
  key: string;
  name: string;
}

interface LibraryUsage {
  librariesInUse: string[];
  remoteStylesCount: number;
  remoteComponentsCount: number;
}

interface SettingsPanelProps {
  settings: Settings;
  libraries: LibraryInfo[];
  libraryUsage?: LibraryUsage | null;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onRefreshLibraries: () => void;
}

export default function SettingsPanel({
  settings,
  libraries,
  libraryUsage = null,
  onSettingsChange,
  onRefreshLibraries
}: SettingsPanelProps) {
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  return (
    <div style={{ padding: "18px" }}>
      <Section title="Getting Started">
        <div style={{ fontSize: "12px", lineHeight: "1.5", color: "var(--text-primary)" }}>
          <div style={{ marginBottom: "12px" }}>
            <strong>First time using Design Linter?</strong>
          </div>

          <ol style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>Select your design system</strong> below (Geiger, Clarity, SASE, etc.)
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Go to Issues tab</strong> and click "Run Scan"
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Review findings</strong> - Red = must fix, Yellow = should fix, Blue = suggestion
            </li>
            <li>
              <strong>Click "Fix" buttons</strong> to auto-apply design tokens
            </li>
          </ol>

          <div style={{
            padding: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            fontSize: "11px",
            marginTop: "12px"
          }}>
            <div style={{ marginBottom: "6px" }}>
              <strong>Severity levels:</strong>
            </div>
            <ul style={{ margin: "0", paddingLeft: "20px" }}>
              <li>Block (Red) = Error, must fix</li>
              <li>Warn (Yellow) = Important, should fix</li>
              <li>Info (Blue) = Suggestion</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Help & Support">
        <Field label="Documentation URL (Optional)">
          <input
            type="text"
            value={settings.helpUrl || ""}
            onChange={(e) => onSettingsChange({ helpUrl: e.target.value || undefined })}
            placeholder="https://your-wiki.com/design-linter-help"
            style={{ width: "100%", padding: "6px 8px", fontSize: "12px" }}
          />
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
            Link to your team's documentation or help page. This will be shown when users need help.
          </div>
        </Field>
      </Section>

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

      <Section title="Layer Scanning Options">
        <Field label="Layer Filters">
          <Checkbox
            label="Ignore invisible layers (hidden with eye icon)"
            checked={settings.ignoreInvisibleLayers ?? true}
            onChange={(checked) => onSettingsChange({ ignoreInvisibleLayers: checked })}
          />
        </Field>
      </Section>

      <Section title="Color Scanning Options">
        <Field label="Ignore Invisible Paints">
          <Checkbox
            label="Ignore fills with visibility turned off (eye icon)"
            checked={settings.ignoreHiddenFills ?? true}
            onChange={(checked) => onSettingsChange({ ignoreHiddenFills: checked })}
          />
          <Checkbox
            label="Ignore fills with 0% opacity"
            checked={settings.ignoreZeroOpacity ?? true}
            onChange={(checked) => onSettingsChange({ ignoreZeroOpacity: checked })}
          />
          <Checkbox
            label="Ignore fully transparent colors (alpha = 0)"
            checked={settings.ignoreTransparentColors ?? true}
            onChange={(checked) => onSettingsChange({ ignoreTransparentColors: checked })}
          />
        </Field>
      </Section>

      <Section title="Design System Library">
        <Field label="Select Library">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <select
              value={settings.dsLibraryKey || ""}
              onChange={(e) => onSettingsChange({ dsLibraryKey: e.target.value || undefined })}
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

        {!settings.dsLibraryKey && (
          <div
            style={{
              fontSize: "12px",
              padding: "12px",
              background: "#FFF9E6",
              borderRadius: "0",
              border: "1px solid #FFE066",
              marginTop: "12px"
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "6px", color: "#8B6914" }}>
              No library selected
            </div>
            <div style={{ color: "#8B6914", fontSize: "11px", lineHeight: "1.4" }}>
              Select your design system library above to scan for design token compliance.
              {libraryUsage && libraryUsage.librariesInUse.length > 0 && (
                <>
                  <br /><br />
                  <strong>Detected libraries in use:</strong>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                    {libraryUsage.librariesInUse.slice(0, 3).map((lib, i) => (
                      <li key={i}>{lib}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {libraries.length > 0 && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginTop: "8px",
              padding: "8px",
              background: "var(--bg-secondary)",
              borderRadius: "0",
              border: "1px solid var(--border-color)"
            }}
          >
            <strong>Library not in the list?</strong> Only bundled design systems appear here.{" "}
            {settings.helpUrl ? (
              <a href={settings.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#5B8FD6" }}>
                Contact your design systems team for help.
              </a>
            ) : (
              "Contact your design systems team to add your library."
            )}
          </div>
        )}

        {libraryUsage && libraryUsage.librariesInUse && libraryUsage.librariesInUse.length > 0 && (
          <div
            style={{
              fontSize: "12px",
              marginTop: "12px",
              padding: "12px",
              background: "#F0F7FF",
              borderRadius: "0",
              border: "1px solid #B8D4F1"
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "8px", color: "#2D4461" }}>
              Libraries Detected in Document
            </div>
            <div style={{ color: "#5B8FD6", fontSize: "11px", marginBottom: "6px" }}>
              {libraryUsage.librariesInUse.map((lib, i) => (
                <div key={i}>{lib}</div>
              ))}
            </div>
            <div style={{ fontSize: "11px", color: "#6B7280" }}>
              {libraryUsage.remoteStylesCount} remote styles, {libraryUsage.remoteComponentsCount} remote components
            </div>
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

      <Section title="Design System Palette Extraction">
        <Field label="Extract from Current File (Local)">
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Extract all local styles and variables from this file. Use this when you're inside the design system source file.
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              parent.postMessage({
                pluginMessage: {
                  type: "EXTRACT_PALETTE",
                  libraryKey: undefined // No library key = extract local
                }
              }, "*");
            }}
          >
            Extract Local Resources
          </button>
        </Field>

        <Field label="Extract from Library (Remote)">
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
            {settings.dsLibraryKey
              ? `Extract all resources from "${settings.dsLibraryKey}" library. Use this from a consumer file with the library enabled.`
              : "Select a library above to extract its resources."
            }
          </div>
          <button
            className="btn btn-secondary"
            disabled={!settings.dsLibraryKey}
            onClick={() => {
              parent.postMessage({
                pluginMessage: {
                  type: "EXTRACT_PALETTE",
                  libraryKey: settings.dsLibraryKey
                }
              }, "*");
            }}
          >
            {settings.dsLibraryKey
              ? `Extract "${settings.dsLibraryKey}"`
              : "Select Library First"
            }
          </button>
          <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>
            After extraction, save the JSON as src/palettes/[library-name].json and rebuild the plugin.
          </div>
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

function Checkbox({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        fontSize: "13px",
        color: "var(--text-primary)",
        marginBottom: "8px"
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: "16px",
          height: "16px",
          cursor: "pointer",
          accentColor: "#5B8FD6"
        }}
      />
      {label}
    </label>
  );
}
