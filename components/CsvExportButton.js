import { useMemo } from "react";

export default function CsvExportButton({ voters = [], disabled }) {
  const toCsvValue = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    const needsQuotes = /[",\n\r]/.test(text);
    const escaped = text.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const csvContent = useMemo(() => {
    if (!voters.length) return "";
    const headers = [
      "serial_number",
      "name",
      "voter_id",
      "gender",
      "age",
      "house_number",
      "relation_type",
      "part_number",
      "section",
      "assembly",
    ];
    const headerRow = headers.map(toCsvValue).join(",");
    const rows = voters.map((v) =>
      headers.map((h) => toCsvValue(v[h])).join(","),
    );
    return [headerRow, ...rows].join("\r\n");
  }, [voters]);

  const handleExport = () => {
    const utf8Bom = "\uFEFF";
    const blob = new Blob([utf8Bom + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
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
