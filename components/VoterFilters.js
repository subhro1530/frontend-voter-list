import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const FILTER_KEYS = [
  "name",
  "voterId",
  "gender",
  "minAge",
  "maxAge",
  "houseNumber",
  "relationType",
  "partNumber",
  "section",
  "assembly",
  "serialNumber",
];

export default function VoterFilters({ onChange, disabled }) {
  const router = useRouter();
  const [values, setValues] = useState(() => {
    const initial = {};
    FILTER_KEYS.forEach((key) => {
      if (router.query[key]) initial[key] = router.query[key];
    });
    return initial;
  });

  // Debounce and sync URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      const query = { ...router.query };
      FILTER_KEYS.forEach((key) => {
        if (values[key]) {
          query[key] = values[key];
        } else {
          delete query[key];
        }
      });
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
      });
      onChange(query);
    }, 350);
    return () => clearTimeout(timeout);
  }, [values, router, onChange]);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const inputs = useMemo(
    () => [
      {
        key: "name",
        label: "Name contains",
        type: "text",
        placeholder: "e.g. Kundu",
      },
      { key: "voterId", label: "Voter ID", type: "text", placeholder: "ID" },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        options: ["", "male", "female", "other"],
      },
      { key: "minAge", label: "Min Age", type: "number", min: 0 },
      { key: "maxAge", label: "Max Age", type: "number", min: 0 },
      {
        key: "houseNumber",
        label: "House #",
        type: "text",
        placeholder: "House no.",
      },
      {
        key: "relationType",
        label: "Relation",
        type: "text",
        placeholder: "Father/Mother",
      },
      { key: "partNumber", label: "Part #", type: "number", min: 0 },
      { key: "section", label: "Section", type: "text" },
      { key: "assembly", label: "Assembly", type: "text" },
      { key: "serialNumber", label: "Serial #", type: "number", min: 0 },
    ],
    []
  );

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
        <button
          type="button"
          className="text-sm text-teal-700 hover:text-teal-900 font-semibold"
          onClick={() => {
            setValues({});
            const cleared = { ...router.query };
            FILTER_KEYS.forEach((key) => delete cleared[key]);
            router.replace(
              { pathname: router.pathname, query: cleared },
              undefined,
              { shallow: true }
            );
            onChange(cleared);
          }}
          disabled={disabled}
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inputs.map((input) => (
          <div key={input.key} className="space-y-1">
            <label htmlFor={input.key}>{input.label}</label>
            {input.type === "select" ? (
              <select
                id={input.key}
                value={values[input.key] || ""}
                onChange={(e) => handleChange(input.key, e.target.value)}
                disabled={disabled}
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
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
