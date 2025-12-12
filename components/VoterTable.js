import { useMemo, useState, useEffect } from "react";
import CsvExportButton from "./CsvExportButton";

export default function VoterTable({ voters = [], loading, error }) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [voters]);

  const pages = Math.max(1, Math.ceil(voters.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return voters.slice(start, start + pageSize);
  }, [voters, page, pageSize]);

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-200">
          Showing {paged.length} of {voters.length} voters
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="pageSize" className="text-slate-300">
            Page size
          </label>
          <select
            id="pageSize"
            className="w-24"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <CsvExportButton
            voters={voters}
            disabled={loading || !voters.length}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}
      {loading && <div className="p-3 text-slate-300">Loading voters…</div>}
      {!loading && !error && voters.length === 0 && (
        <div className="p-3 text-slate-300">
          No voters found for these filters.
        </div>
      )}

      {!loading && !error && voters.length > 0 && (
        <div className="table-scroll">
          <table className="w-full text-sm sticky-header">
            <thead className="text-left">
              <tr className="text-slate-200">
                <th className="p-2">Name</th>
                <th className="p-2">Voter ID</th>
                <th className="p-2">Gender</th>
                <th className="p-2">Age</th>
                <th className="p-2">House #</th>
                <th className="p-2">Relation</th>
                <th className="p-2">Part</th>
                <th className="p-2">Section</th>
                <th className="p-2">Assembly</th>
                <th className="p-2">Serial</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((voter) => (
                <tr
                  key={`${voter.voter_id}-${voter.serial_number}`}
                  className="border-b border-ink-400/40 hover:bg-ink-100/50"
                >
                  <td className="p-2 font-semibold text-slate-100">
                    {voter.name || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.voter_id || "—"}
                  </td>
                  <td className="p-2 text-slate-200 capitalize">
                    {voter.gender || "—"}
                  </td>
                  <td className="p-2 text-slate-200">{voter.age ?? "—"}</td>
                  <td className="p-2 text-slate-200">
                    {voter.house_number || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.relation_type || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.part_number || "—"}
                  </td>
                  <td className="p-2 text-slate-200">{voter.section || "—"}</td>
                  <td className="p-2 text-slate-200">
                    {voter.assembly || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.serial_number || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && voters.length > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-slate-300">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-primary"
              disabled={page === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
