import { useMemo } from "react";
import * as XLSX from "xlsx";

export default function CsvExportButton({ voters = [], disabled }) {
  const getSerial = (voter) => {
    return (
      voter?.serial_number ??
      voter?.serialNumber ??
      voter?.sno ??
      voter?.sl_no ??
      voter?.slNo ??
      ""
    );
  };

  const normalizedRows = useMemo(() => {
    return voters.map((v) => ({
      serial_number: getSerial(v),
      name: v?.name ?? "",
      voter_id: v?.voter_id ?? "",
      gender: v?.gender ?? "",
      age: v?.age ?? "",
      house_number: v?.house_number ?? "",
      relation_type: v?.relation_type ?? "",
      part_number: v?.part_number ?? v?.partNumber ?? "",
      section: v?.section ?? "",
      assembly: v?.assembly ?? "",
      under_adjudication: v?.underAdjudication ? "Yes" : "No",
    }));
  }, [voters]);

  const handleExport = () => {
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
      "under_adjudication",
    ];

    const worksheet = XLSX.utils.json_to_sheet(normalizedRows, {
      header: headers,
      skipHeader: false,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Voters");
    XLSX.writeFile(
      workbook,
      `voters_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <button
      className="btn btn-secondary"
      disabled={disabled || !voters.length}
      onClick={handleExport}
    >
      Export Excel
    </button>
  );
}
