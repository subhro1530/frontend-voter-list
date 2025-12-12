import { useEffect, useMemo, useState } from "react";

export default function VoterFilters({ onChange, disabled }) {
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
    []
  );

  return (
    <div className="card space-y-4 bg-ink-900/70 border border-ink-400/40">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Filters</h3>
        <button
          type="button"
          className="text-sm text-neon-200 hover:text-neon-100 font-semibold"
          onClick={() => {
            setValues({});
            onChange({});
          }}
          disabled={disabled}
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inputs.map((input) => (
          <div key={input.key} className="space-y-1">
            <label
              htmlFor={input.key}
              className="block text-sm font-medium text-slate-200"
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
