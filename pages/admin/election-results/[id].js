import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { electionResultsAPI } from "../../../lib/api";
import toast from "react-hot-toast";

export default function ElectionResultDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ElectionResultDetailContent />
    </ProtectedRoute>
  );
}

function ElectionResultDetailContent() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    electionResultsAPI
      .getSession(id, controller.signal)
      .then((res) => setData(res))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load election result details");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  const handleExport = async () => {
    try {
      toast.loading("Downloading Excel...", { id: "excel-download" });
      await electionResultsAPI.exportExcel(id);
      toast.success("Excel downloaded!", { id: "excel-download" });
    } catch (err) {
      toast.error(err.message || "Export failed", { id: "excel-download" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
          <p className="text-slate-300">Loading election result details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/election-results"
          className="text-sm text-neon-200 hover:text-neon-100"
        >
          ← Back to Election Results
        </Link>
        <div className="p-4 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { session, candidates, boothResults, totals } = data;
  const totalLabels = {
    evm: "EVM Votes",
    postal: "Postal Votes",
    total: "Total Votes Polled",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/election-results"
            className="inline-flex items-center gap-2 text-sm text-neon-200 hover:text-neon-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Election Results
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-slate-100">
            {session.constituency ||
              session.original_filename ||
              "Election Result"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/election-results/stats/${id}`}
            className="btn btn-secondary"
          >
            📈 Statistics
          </Link>
          <button
            onClick={handleExport}
            className="btn bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Status</span>
            <p className="font-semibold text-slate-100 capitalize">
              {session.status || "—"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Total Electors</span>
            <p className="font-semibold text-slate-100">
              {session.total_electors?.toLocaleString() || "—"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Total Pages</span>
            <p className="font-semibold text-slate-100">
              {session.processed_pages ?? "—"}/{session.total_pages ?? "—"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Candidates</span>
            <p className="font-semibold text-slate-100">
              {candidates?.length || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Candidate Legend */}
      {candidates && candidates.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Candidates
          </h3>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c, i) => (
              <span
                key={c.id}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ink-100/50 border border-ink-400/50 text-slate-200"
              >
                {i + 1}. {c.candidate_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results Table */}
      {boothResults && boothResults.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-100/80 text-slate-200 text-xs">
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Sl.
                  </th>
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Booth
                  </th>
                  {candidates?.map((c) => (
                    <th
                      key={c.id}
                      className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap max-w-[120px] truncate"
                      title={c.candidate_name}
                    >
                      {c.candidate_name}
                    </th>
                  ))}
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Valid
                  </th>
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Rejected
                  </th>
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    NOTA
                  </th>
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Total
                  </th>
                  <th className="border border-ink-400/40 px-3 py-2 text-center whitespace-nowrap">
                    Tendered
                  </th>
                </tr>
              </thead>
              <tbody>
                {boothResults.map((booth) => {
                  // Find the winner for this booth
                  let maxVotes = -1;
                  let winnerName = "";
                  candidates?.forEach((c) => {
                    const votes =
                      booth.candidate_votes?.[c.candidate_name] || 0;
                    if (votes > maxVotes) {
                      maxVotes = votes;
                      winnerName = c.candidate_name;
                    }
                  });

                  return (
                    <tr
                      key={booth.id}
                      className="border-b border-ink-400/20 hover:bg-ink-100/30 transition-colors"
                    >
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center text-slate-300">
                        {booth.serial_no}
                      </td>
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center font-mono text-slate-200">
                        {booth.booth_no}
                      </td>
                      {candidates?.map((c) => {
                        const votes =
                          booth.candidate_votes?.[c.candidate_name] || 0;
                        const isWinner =
                          c.candidate_name === winnerName && maxVotes > 0;
                        return (
                          <td
                            key={c.id}
                            className={`border border-ink-400/20 px-3 py-1.5 text-center ${
                              isWinner
                                ? "font-bold text-emerald-300 bg-emerald-500/10"
                                : "text-slate-300"
                            }`}
                          >
                            {votes.toLocaleString()}
                          </td>
                        );
                      })}
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center text-slate-300">
                        {booth.total_valid_votes?.toLocaleString()}
                      </td>
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center text-slate-400">
                        {booth.rejected_votes}
                      </td>
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center text-slate-400">
                        {booth.nota}
                      </td>
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center font-semibold text-slate-100">
                        {booth.total_votes?.toLocaleString()}
                      </td>
                      <td className="border border-ink-400/20 px-3 py-1.5 text-center text-slate-400">
                        {booth.tendered_votes}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals rows */}
                {totals?.map((t) => (
                  <tr
                    key={t.total_type}
                    className="bg-neon-500/10 font-bold border-t-2 border-neon-400/30"
                  >
                    <td
                      className="border border-ink-400/20 px-3 py-2 text-neon-200"
                      colSpan={2}
                    >
                      {totalLabels[t.total_type] || t.total_type}
                    </td>
                    {candidates?.map((c) => (
                      <td
                        key={c.id}
                        className="border border-ink-400/20 px-3 py-2 text-center text-neon-100"
                      >
                        {(
                          t.candidate_votes?.[c.candidate_name] || 0
                        ).toLocaleString()}
                      </td>
                    ))}
                    <td className="border border-ink-400/20 px-3 py-2 text-center text-neon-100">
                      {t.total_valid_votes?.toLocaleString()}
                    </td>
                    <td className="border border-ink-400/20 px-3 py-2 text-center text-neon-100">
                      {t.rejected_votes}
                    </td>
                    <td className="border border-ink-400/20 px-3 py-2 text-center text-neon-100">
                      {t.nota}
                    </td>
                    <td className="border border-ink-400/20 px-3 py-2 text-center text-neon-100">
                      {t.total_votes?.toLocaleString()}
                    </td>
                    <td className="border border-ink-400/20 px-3 py-2 text-center text-neon-100">
                      {t.tendered_votes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No data */}
      {(!boothResults || boothResults.length === 0) && !loading && (
        <div className="card text-center py-8">
          <p className="text-slate-400">
            No booth results available for this session.
          </p>
        </div>
      )}
    </div>
  );
}
