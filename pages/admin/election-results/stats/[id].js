import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import CandidateStatCard from "../../../../components/CandidateStatCard";
import { electionResultsAPI } from "../../../../lib/api";

export default function ElectionResultStatsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ElectionResultStatsContent />
    </ProtectedRoute>
  );
}

function ElectionResultStatsContent() {
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
      .getStats(id, controller.signal)
      .then((res) => setData(res))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load election statistics");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
          <p className="text-slate-300">Loading election statistics...</p>
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

  const { session, totalBooths, candidateStats, totals } = data;

  // Find winner (most total votes)
  const winner =
    candidateStats && candidateStats.length > 0
      ? candidateStats.reduce((a, b) =>
          (a.totalVotes || 0) > (b.totalVotes || 0) ? a : b,
        )
      : null;

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
            href={`/admin/election-results/${id}`}
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
            Back to Details
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-slate-100">
            📈 Election Statistics
          </h1>
          <p className="text-sm text-slate-400">
            {session?.constituency || "Election Result"}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <span className="text-3xl mb-2 block">🗳️</span>
          <p className="text-2xl font-bold text-slate-100">
            {totalBooths || "—"}
          </p>
          <p className="text-sm text-slate-400">Total Booths</p>
        </div>
        <div className="card text-center">
          <span className="text-3xl mb-2 block">👥</span>
          <p className="text-2xl font-bold text-slate-100">
            {candidateStats?.length || "—"}
          </p>
          <p className="text-sm text-slate-400">Candidates</p>
        </div>
        {winner && (
          <div className="card text-center border-emerald-500/30 bg-emerald-500/5">
            <span className="text-3xl mb-2 block">🏆</span>
            <p className="text-lg font-bold text-emerald-300 truncate">
              {winner.candidateName}
            </p>
            <p className="text-sm text-slate-400">
              {winner.totalVotes?.toLocaleString()} votes
            </p>
          </div>
        )}
      </div>

      {/* Candidate Stat Cards */}
      {candidateStats && candidateStats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Candidate Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidateStats.map((stat) => (
              <CandidateStatCard
                key={stat.candidateName}
                stat={stat}
                totalBooths={totalBooths}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vote Comparison Bar */}
      {candidateStats && candidateStats.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            Vote Share Comparison
          </h3>
          <div className="space-y-3">
            {candidateStats
              .sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0))
              .map((stat) => {
                const maxVotes = candidateStats.reduce(
                  (max, s) => Math.max(max, s.totalVotes || 0),
                  0,
                );
                const pct =
                  maxVotes > 0 ? ((stat.totalVotes || 0) / maxVotes) * 100 : 0;
                return (
                  <div key={stat.candidateName}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200 truncate mr-4">
                        {stat.candidateName}
                      </span>
                      <span className="text-slate-400 whitespace-nowrap">
                        {stat.totalVotes?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-ink-400/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-neon-500 to-blue-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Totals */}
      {totals && totals.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            Vote Totals
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-ink-400/40">
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Valid Votes</th>
                  <th className="px-3 py-2 text-right">Rejected</th>
                  <th className="px-3 py-2 text-right">NOTA</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Tendered</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr
                    key={t.total_type}
                    className="border-b border-ink-400/20 hover:bg-ink-100/30"
                  >
                    <td className="px-3 py-2 font-semibold text-slate-200">
                      {totalLabels[t.total_type] || t.total_type}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {t.total_valid_votes?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {t.rejected_votes}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {t.nota}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-100">
                      {t.total_votes?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {t.tendered_votes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
