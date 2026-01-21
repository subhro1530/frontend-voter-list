import { useEffect, useMemo, useState } from "react";

const RELIGION_OPTIONS = [
  "",
  "Hindu",
  "Muslim",
  "Christian",
  "Sikh",
  "Buddhist",
  "Jain",
  "Other",
];

const RELIGION_ICONS = {
  Hindu: "🕉️",
  Muslim: "☪️",
  Christian: "✝️",
  Sikh: "🔯",
  Buddhist: "☸️",
  Jain: "🙏",
  Other: "🌐",
};

export default function VoterFilters({
  onChange,
  disabled,
  religionStats,
  activeFilters,
}) {
  const [values, setValues] = useState({});

  // Debounce and sync URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(values);
    }, 350);
    return () => clearTimeout(timeout);
  }, [values, onChange]);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleReligionChipClick = (religion) => {
    const newVal = values.religion === religion ? "" : religion;
    setValues((prev) => ({ ...prev, religion: newVal }));
  };

  const inputs = useMemo(
    () => [
      {
        key: "name",
        label: "🔎 Name contains",
        type: "text",
        placeholder: "e.g. Kundu",
      },
      {
        key: "voterId",
        label: "🪪 Voter ID",
        type: "text",
        placeholder: "ID",
      },
      {
        key: "gender",
        label: "⚧ Gender",
        type: "select",
        options: ["", "male", "female", "other"],
      },
      {
        key: "religion",
        label: "🛕 Religion",
        type: "select",
        options: RELIGION_OPTIONS,
      },
      { key: "minAge", label: "📉 Min Age", type: "number", min: 0 },
      { key: "maxAge", label: "📈 Max Age", type: "number", min: 0 },
      {
        key: "houseNumber",
        label: "🏠 House #",
        type: "text",
        placeholder: "House no.",
      },
      {
        key: "relationType",
        label: "🧭 Relation",
        type: "text",
        placeholder: "Father/Mother",
      },
      { key: "partNumber", label: "🧩 Part #", type: "number", min: 0 },
      { key: "section", label: "📍 Section", type: "text" },
      { key: "assembly", label: "🏛️ Assembly", type: "text" },
      { key: "serialNumber", label: "🔢 Serial #", type: "number", min: 0 },
    ],
    [],
  );

  // Calculate active filter count for display
  const activeFilterCount = Object.values(values).filter(
    (v) => v !== "" && v !== undefined && v !== null,
  ).length;

  return (
    <div className="card space-y-4 bg-ink-900/70 border border-ink-400/40">
      {/* Header with filter count badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-100">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="filter-count-badge">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-sm text-neon-200 hover:text-neon-100 font-semibold"
          onClick={() => {
            setValues({});
            onChange({});
          }}
          disabled={disabled}
        >
          Clear All
        </button>
      </div>

      {/* Religion Stats Quick Filter Chips */}
      {religionStats &&
      religionStats.stats &&
      religionStats.stats.length > 0 ? (
        <div className="religion-stats-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="text-lg">🛕</span>
              Religion Distribution
              <span className="text-xs text-slate-400 font-normal">
                (click to filter)
              </span>
            </h4>
            <span className="text-xs text-slate-400">
              Total: {religionStats.total?.toLocaleString() || 0} voters
            </span>
          </div>
          <div className="religion-chips-grid">
            {religionStats.stats.map((stat) => {
              const isActive = values.religion === stat.religion;
              const icon = RELIGION_ICONS[stat.religion] || "🌐";
              return (
                <button
                  key={stat.religion}
                  type="button"
                  onClick={() => handleReligionChipClick(stat.religion)}
                  disabled={disabled}
                  className={`religion-chip ${
                    isActive ? "religion-chip-active" : ""
                  }`}
                >
                  <div className="religion-chip-header">
                    <span className="religion-chip-icon">{icon}</span>
                    <span className="religion-chip-name">{stat.religion}</span>
                  </div>
                  <div className="religion-chip-stats">
                    <span className="religion-chip-count">
                      {stat.count?.toLocaleString() ?? 0}
                    </span>
                    <span className="religion-chip-percent">
                      {Number(stat.percentage || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="religion-chip-bar">
                    <div
                      className="religion-chip-bar-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Number(stat.percentage) || 0,
                        )}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="religion-stats-unavailable">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-xl opacity-60">🛕</span>
            <div>
              <p className="text-sm font-medium text-slate-300">
                Religion data not available
              </p>
              <p className="text-xs">
                This session was processed without religion classification. You
                can still filter by religion using the dropdown below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Status Bar */}
      {values.religion && (
        <div className="active-religion-filter">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {RELIGION_ICONS[values.religion] || "🌐"}
            </span>
            <span className="text-sm font-medium">
              Filtering by: <strong>{values.religion}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleChange("religion", "")}
            className="text-xs text-rose-300 hover:text-rose-200 font-semibold"
          >
            ✕ Remove
          </button>
        </div>
      )}

      {/* Standard Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {inputs.map((input) => (
          <div key={input.key} className="space-y-1">
            <label
              htmlFor={input.key}
              className="block text-xs sm:text-sm font-medium text-slate-200"
            >
              {input.label}
            </label>
            {input.type === "select" ? (
              <select
                id={input.key}
                value={values[input.key] || ""}
                onChange={(e) => handleChange(input.key, e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-ink-500/70 bg-ink-900/60 text-slate-100 focus:border-neon-300 focus:ring-2 focus:ring-neon-200"
              >
                {input.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "" ? "Any" : opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={input.key}
                type={input.type}
                min={input.min}
                placeholder={input.placeholder}
                value={values[input.key] || ""}
                onChange={(e) => handleChange(input.key, e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-ink-500/70 bg-ink-900/60 text-slate-100 placeholder:text-slate-400 focus:border-neon-300 focus:ring-2 focus:ring-neon-200"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
