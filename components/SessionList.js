import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteSession,
  getSessions,
  getSessionStatus,
  stopSession,
  resumeSession,
  renameSession,
  electionResultsAPI,
} from "../lib/api";
import toast from "react-hot-toast";
import {
  extractAutomaticRetryRounds,
  extractDispatchTier,
  formatAutomaticRetryRounds,
} from "../lib/engineStatusMapper";
import DispatchModeSelector from "./DispatchModeSelector";
import { readStoredDispatchMode } from "../lib/dispatchMode";

const statusTone = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("paused") || key.includes("stopped")) return "status-paused";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  return "status-pending";
};

const statusIcon = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "❌";
  if (key.includes("paused") || key.includes("stopped")) return "⏸️";
  if (key.includes("process")) return "⏳";
  if (key.includes("complete")) return "✅";
  return "📋";
};

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [progressMap, setProgressMap] = useState({});
  const [dispatchTierMap, setDispatchTierMap] = useState({});
  const [renameModal, setRenameModal] = useState(null);
  const [linkedResultState, setLinkedResultState] = useState({
    open: false,
    loading: false,
    data: null,
    error: "",
    sourceSession: null,
  });
  const [linkedYear, setLinkedYear] = useState("");
  const [dispatchMode, setDispatchMode] = useState("auto");
  const [isTabVisible, setIsTabVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });

  useEffect(() => {
    setDispatchMode(readStoredDispatchMode());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const load = () => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getSessions(controller.signal)
      .then((res) => {
        const list = Array.isArray(res?.sessions)
          ? res.sessions
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : null;

        if (!Array.isArray(list)) {
          setSessions([]);
          setError("Unexpected sessions response. Please check the API.");
          return;
        }

        setSessions(list);
        if (list.length) {
          Promise.all(
            list.map((s) =>
              getSessionStatus(s.id)
                .then((payload) => ({ id: s.id, payload }))
                .catch(() => null),
            ),
          ).then((results) => {
            const next = {};
            const nextDispatchTierMap = {};

            results.filter(Boolean).forEach(({ id, payload }) => {
              next[id] = normalizeProgress(payload);
              const dispatchTier = extractDispatchTier(payload);
              if (dispatchTier) {
                nextDispatchTierMap[id] = dispatchTier;
              }
            });

            setProgressMap((prev) => ({ ...prev, ...next }));
            setDispatchTierMap((prev) => ({ ...prev, ...nextDispatchTierMap }));
          });
        }
      })
      .catch((err) => setError(err.message || "Failed to load sessions"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(load, []);

  // Auto-refresh every 2 seconds for processing sessions while tab is visible.
  useEffect(() => {
    if (!isTabVisible) return;

    const hasProcessing = sessions.some((s) =>
      (s?.status || "").toLowerCase().includes("process"),
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      load();
    }, 2000);

    return () => clearInterval(interval);
  }, [sessions, isTabVisible]);

  const handleDelete = async (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!window.confirm(`Delete session ${session?.original_filename || id}?`))
      return;
    setActionLoading(id);
    const prev = sessions;
    setSessions((list) => list.filter((s) => s.id !== id));
    try {
      await deleteSession(id);
    } catch (err) {
      setError(err.message || "Delete failed");
      setSessions(prev);
    } finally {
      setActionLoading("");
    }
  };

  const handleStop = async (id) => {
    setActionLoading(id);
    try {
      await stopSession(id);
      load();
    } catch (err) {
      setError(err.message || "Failed to stop session");
    } finally {
      setActionLoading("");
    }
  };

  const handleResume = async (id) => {
    setActionLoading(id);
    try {
      const response = await resumeSession(id, dispatchMode);
      const rounds = extractAutomaticRetryRounds(response);
      const retryText = formatAutomaticRetryRounds(rounds);
      toast.success(
        retryText ? `Session resumed. ${retryText}` : "Session resumed.",
      );
      load();
    } catch (err) {
      setError(err.message || "Failed to resume session");
    } finally {
      setActionLoading("");
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await renameSession(id, newName);
      setRenameModal(null);
      load();
    } catch (err) {
      setError(err.message || "Failed to rename session");
    }
  };

  const handleViewBoothResult = async (session, overrideYear) => {
    setLinkedResultState((prev) => ({
      ...prev,
      open: true,
      loading: true,
      error: "",
      sourceSession: session,
    }));

    const yearToUse =
      overrideYear || linkedYear || session.election_year || session.year || "";

    try {
      const data =
        await electionResultsAPI.getLinkedElectionResultsFromVoterSession(
          session.id,
          yearToUse,
        );
      setLinkedResultState((prev) => ({
        ...prev,
        loading: false,
        data,
        error: "",
      }));
    } catch (err) {
      const message = err.message || "Failed to fetch linked election results";
      setLinkedResultState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      toast.error(message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Voter Lists</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <DispatchModeSelector
            compact
            value={dispatchMode}
            onChange={setDispatchMode}
          />
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}
      {loading && (
        <div className="p-3 text-slate-300">Loading voter lists…</div>
      )}
      {!loading && sessions.length === 0 && !error && (
        <div className="p-3 text-slate-400">No voter lists yet.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map((s) => {
          const status = (s.status || "").toLowerCase();
          const isProcessing = status.includes("process");
          const isPaused =
            status.includes("paused") || status.includes("stopped");
          const isFailed = status.includes("fail");
          const canStop = isProcessing;
          const canResume = isPaused || isFailed;
          const dispatchTier =
            dispatchTierMap[s.id] ||
            extractDispatchTier(s) ||
            (s.activeDispatchTier === "paid" ? "paid" : "free");

          return (
            <div key={s.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-slate-100 break-all">
                      {s.original_filename || "Untitled PDF"}
                    </div>
                    <button
                      onClick={() => setRenameModal(s)}
                      className="text-slate-400 hover:text-neon-400 transition-colors"
                      title="Rename session"
                    >
                      ✏️
                    </button>
                  </div>
                  <div className="text-xs text-slate-400">ID: {s.id}</div>
                  {(s.assembly_name || s.constituency) && (
                    <div className="text-xs text-slate-400">
                      Assembly: {s.assembly_name || s.constituency}
                    </div>
                  )}
                  {(s.booth_no || s.booth_name) && (
                    <div className="text-xs text-slate-300">
                      Booth #{s.booth_no || "—"}
                      {s.booth_name ? ` • ${s.booth_name}` : ""}
                    </div>
                  )}
                </div>
                <span className={`badge ${statusTone(s.status)}`}>
                  {statusIcon(s.status)} {s.status || "pending"}
                </span>
              </div>
              {s.booth_name && (
                <p className="text-sm text-slate-400">
                  🏢 Booth:{" "}
                  <span className="text-slate-200">{s.booth_name}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                <div>
                  Pages:{" "}
                  <span className="font-semibold">
                    {s.page_count ?? s.pageCount ?? s.total_pages ?? "—"}
                  </span>
                </div>
                <div>
                  Voters:{" "}
                  <span className="font-semibold">
                    {s.voter_count ?? s.voterCount ?? "—"}
                  </span>
                </div>
                <div>
                  Created:{" "}
                  <span className="font-semibold">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div>
                  Updated:{" "}
                  <span className="font-semibold">
                    {s.updated_at
                      ? new Date(s.updated_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Dispatch tier used: {dispatchTier === "paid" ? "PAID" : "FREE"}
              </p>
              {(progressMap[s.id] || isProcessing) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>
                      {isProcessing ? "⏳ Processing..." : "Progress"}
                    </span>
                    <span>
                      {progressMap[s.id]?.processed ?? s.processed_pages ?? 0} /{" "}
                      {progressMap[s.id]?.total ??
                        s.page_count ??
                        s.total_pages ??
                        0}{" "}
                      pages
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-400/50 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isProcessing
                          ? "bg-neon-400 animate-pulse"
                          : "bg-teal-400"
                      }`}
                      style={{ width: `${progressMap[s.id]?.percent ?? 0}%` }}
                    />
                  </div>
                  {isProcessing && (
                    <p className="text-xs text-slate-400">
                      ⏰ ~
                      {((progressMap[s.id]?.total ?? s.page_count ?? 0) -
                        (progressMap[s.id]?.processed ??
                          s.processed_pages ??
                          0)) *
                        30}
                      s remaining (sequential processing)
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-primary" href={`/sessions/${s.id}`}>
                  View
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/sessions/${s.id}?openMass=1`}
                >
                  Mass Generate Slip
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleViewBoothResult(s)}
                >
                  View Booth Result
                </button>

                {/* Stop button - only for processing sessions */}
                {canStop && (
                  <button
                    className="btn bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => handleStop(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Stopping…" : "🛑 Stop"}
                  </button>
                )}

                {/* Resume button - for paused/failed sessions */}
                {canResume && (
                  <button
                    className="btn bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleResume(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Resuming…" : "▶️ Resume"}
                  </button>
                )}

                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(s.id)}
                  disabled={actionLoading === s.id}
                >
                  {actionLoading === s.id ? "Deleting…" : "🗑️ Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rename Modal */}
      {renameModal && (
        <RenameModal
          session={renameModal}
          onClose={() => setRenameModal(null)}
          onRename={handleRename}
        />
      )}

      {linkedResultState.open && (
        <LinkedElectionResultsModal
          state={linkedResultState}
          linkedYear={linkedYear}
          onYearChange={setLinkedYear}
          onClose={() =>
            setLinkedResultState({
              open: false,
              loading: false,
              data: null,
              error: "",
              sourceSession: null,
            })
          }
          onRetry={() =>
            linkedResultState.sourceSession &&
            handleViewBoothResult(linkedResultState.sourceSession, linkedYear)
          }
        />
      )}
    </div>
  );
}

function RenameModal({ session, onClose, onRename }) {
  const [name, setName] = useState(session.original_filename || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onRename(session.id, name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100 mb-4">
          ✏️ Rename Session
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400"
            placeholder="Enter new name"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-neon-500 text-white rounded-lg hover:bg-neon-400 transition-colors disabled:opacity-50"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function normalizeProgress(payload) {
  const processed = payload?.processed_pages ?? payload?.processed ?? 0;
  const total =
    payload?.page_count ?? payload?.total_pages ?? payload?.pages ?? 0;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : 0;
  return { processed, total, percent };
}

function normalizeAssembly(value) {
  return (value || "").toString().trim().toLowerCase();
}

function LinkedElectionResultsModal({
  state,
  linkedYear,
  onYearChange,
  onClose,
  onRetry,
}) {
  const totalLabels = {
    evm: "EVM Votes",
    postal: "Postal Votes",
    total: "Total Votes Polled",
  };

  const sourceAssembly =
    state.data?.session?.assembly_name ||
    state.sourceSession?.assembly_name ||
    state.sourceSession?.constituency ||
    "";

  const results = state.data?.fullResults || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-4 w-full max-w-6xl shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Linked Booth Result
            </h3>
            <p className="text-xs text-slate-400">
              Booth #
              {state.data?.session?.booth_no ||
                state.sourceSession?.booth_no ||
                "—"}
              {sourceAssembly ? ` • ${sourceAssembly}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="number"
            min="1900"
            max="2100"
            value={linkedYear}
            onChange={(e) => onYearChange(e.target.value)}
            placeholder="Year filter"
            className="px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500"
          />
          <button onClick={onRetry} className="btn btn-secondary">
            Reload Linked Result
          </button>
        </div>

        {state.loading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 rounded bg-ink-100" />
            <div className="h-28 rounded bg-ink-100" />
            <div className="h-28 rounded bg-ink-100" />
          </div>
        )}

        {!state.loading && state.error && (
          <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700 flex items-center justify-between gap-3">
            <span>{state.error}</span>
            <button
              className="btn btn-secondary text-xs py-1 px-2"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        )}

        {!state.loading && !state.error && results.length === 0 && (
          <div className="p-3 text-slate-400 border border-ink-400/40 rounded-lg">
            No linked election result found for this voter session.
          </div>
        )}

        {!state.loading &&
          !state.error &&
          results.map((result, index) => {
            const boothResult = result.boothResult || {};
            const electionSession = result.electionSession || {};
            const assemblyMismatch =
              normalizeAssembly(sourceAssembly) &&
              normalizeAssembly(
                electionSession.constituency || electionSession.assembly_name,
              ) &&
              normalizeAssembly(sourceAssembly) !==
                normalizeAssembly(
                  electionSession.constituency || electionSession.assembly_name,
                );

            return (
              <div
                key={`${electionSession.id || "session"}-${index}`}
                className="border border-ink-400/40 rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-slate-200">
                    <strong>
                      {electionSession.constituency || "Election Session"}
                    </strong>
                    {electionSession.election_year
                      ? ` • Year ${electionSession.election_year}`
                      : ""}
                    {boothResult.booth_no
                      ? ` • Booth #${boothResult.booth_no}`
                      : ""}
                  </div>
                  <Link
                    href={`/admin/election-results/${electionSession.id}?boothNo=${encodeURIComponent(boothResult.booth_no || "")}`}
                    className="btn btn-secondary text-xs py-1 px-2"
                  >
                    Open Booth Row
                  </Link>
                </div>

                {assemblyMismatch && (
                  <div className="p-2 text-xs bg-amber-900/30 border border-amber-600/40 text-amber-100 rounded">
                    Warning: Linked result assembly differs from voter session
                    assembly.
                  </div>
                )}

                <div className="overflow-x-auto border border-ink-400/30 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-100/80 text-slate-300 text-xs">
                        <th className="px-3 py-2 text-left">Booth</th>
                        <th className="px-3 py-2 text-left">Candidate Votes</th>
                        <th className="px-3 py-2 text-left">Valid</th>
                        <th className="px-3 py-2 text-left">Rejected</th>
                        <th className="px-3 py-2 text-left">NOTA</th>
                        <th className="px-3 py-2 text-left">Total</th>
                        <th className="px-3 py-2 text-left">Tendered</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-ink-400/20">
                        <td className="px-3 py-2 text-slate-100 font-mono">
                          {boothResult.booth_no || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {Object.entries(boothResult.candidate_votes || {})
                            .map(([name, votes]) => `${name}: ${votes}`)
                            .join(" | ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.total_valid_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.rejected_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.nota ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-semibold">
                          {boothResult.total_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.tendered_votes ?? "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {Array.isArray(result.candidates) &&
                  result.candidates.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {result.candidates.map((candidate, idx) => (
                        <span
                          key={`${candidate.id || candidate.candidate_name || idx}`}
                          className="px-2 py-1 rounded bg-ink-100/40 border border-ink-400/40 text-slate-200"
                        >
                          {candidate.candidate_name}
                        </span>
                      ))}
                    </div>
                  )}

                {Array.isArray(result.totals) && result.totals.length > 0 && (
                  <div className="overflow-x-auto border border-ink-400/30 rounded">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-ink-100/80 text-slate-300">
                          <th className="px-3 py-2 text-left">Total Type</th>
                          <th className="px-3 py-2 text-left">Valid</th>
                          <th className="px-3 py-2 text-left">Rejected</th>
                          <th className="px-3 py-2 text-left">NOTA</th>
                          <th className="px-3 py-2 text-left">Total</th>
                          <th className="px-3 py-2 text-left">Tendered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.totals.map((row) => (
                          <tr
                            key={row.total_type}
                            className="border-t border-ink-400/20 text-slate-300"
                          >
                            <td className="px-3 py-2">
                              {totalLabels[row.total_type] || row.total_type}
                            </td>
                            <td className="px-3 py-2">
                              {row.total_valid_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.rejected_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">{row.nota ?? "—"}</td>
                            <td className="px-3 py-2 font-semibold">
                              {row.total_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.tendered_votes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
