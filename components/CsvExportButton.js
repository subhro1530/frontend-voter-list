import { useMemo } from "react";

export default function CsvExportButton({ voters = [], disabled }) {
  const csvContent = useMemo(() => {
    if (!voters.length) return "";
    const headers = [
      "name",
      "voter_id",
      "gender",
      "age",
      "house_number",
      "relation_type",
      "part_number",
      "section",
      "assembly",
      "serial_number",
    ];
    const rows = voters.map((v) =>
      headers
        .map((h) => {
          const val = v[h] ?? "";
          if (typeof val === "string" && val.includes(",")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }, [voters]);

  const handleExport = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `voters_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      className="btn btn-secondary"
      disabled={disabled || !voters.length}
      onClick={handleExport}
    >
      Export CSV
    </button>
  );
}
