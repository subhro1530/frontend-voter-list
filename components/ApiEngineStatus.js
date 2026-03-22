import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { resetApiKeys, resumeSession } from "../lib/api";
import { useEngineStatusPolling } from "../lib/useEngineStatusPolling";
import {
  extractAutomaticRetryRounds,
  formatAutomaticRetryRounds,
  isProcessingSessionStatus,
} from "../lib/engineStatusMapper";

export default function ApiEngineStatus({
  sessionId,
  sessionStatus,
  onResume,
  onStatusChange,
  pollInterval = 5000,
  showSummary = false,
}) {
  const [resetting, setResetting] = useState(false);
  const [resuming, setResuming] = useState(false);

  const { statusSnapshot, loading, pollError, isPolling } =
    useEngineStatusPolling({
      sessionId,
      sessionStatus,
      enabled: true,
      pollIntervalMs: pollInterval,
    });

  useEffect(() => {
    if (statusSnapshot) onStatusChange?.(statusSnapshot);
  }, [statusSnapshot, onStatusChange]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetApiKeys();
    } catch {
      // Keep monitor read-only on failures.
    } finally {
      setResetting(false);
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    setResuming(true);
    try {
      const response = await resumeSession(sessionId);
      const rounds = extractAutomaticRetryRounds(response);
      const retryText = formatAutomaticRetryRounds(rounds);
      toast.success(
        retryText ? `Session resumed. ${retryText}` : "Session resumed.",
      );
      onResume?.();
    } catch {
      // Parent handles toast/errors for action calls.
    } finally {
      setResuming(false);
    }
  };

  if (!statusSnapshot && !loading) return null;

  const keys = statusSnapshot?.engines || [];
  const totalEngines = statusSnapshot?.totalEngines || 0;
  const activeEngines = statusSnapshot?.activeEngines || 0;
  const busyEngines = statusSnapshot?.busyEngines || 0;
  const exhaustedEngines = statusSnapshot?.exhaustedEngines || 0;
  const rateLimitedEngines = statusSnapshot?.rateLimitedEngines || 0;
  const activeDispatchTier = statusSnapshot?.activeDispatchTier || "free";

  const pools = useMemo(() => {
    if (statusSnapshot?.pools?.free && statusSnapshot?.pools?.paid) {
      return statusSnapshot.pools;
    }

    const next = {
      free: {
        total: 0,
        active: 0,
        rateLimited: 0,
        exhausted: 0,
        busy: 0,
        available: 0,
      },
      paid: {
        total: 0,
        active: 0,
        rateLimited: 0,
        exhausted: 0,
        busy: 0,
        available: 0,
      },
    };

    keys.forEach((engine) => {
      const tier = engine.tier === "paid" ? "paid" : "free";
      next[tier].total += 1;
      if (engine.status === "active") next[tier].active += 1;
      if (engine.status === "rate_limited") next[tier].rateLimited += 1;
      if (engine.status === "exhausted") next[tier].exhausted += 1;
      if (engine.busy) next[tier].busy += 1;
      if (engine.status === "active" && !engine.busy) next[tier].available += 1;
    });

    return next;
  }, [keys, statusSnapshot?.pools]);

  const isPaused =
    sessionStatus?.toLowerCase?.()?.includes("paused") ||
    sessionStatus?.toLowerCase?.()?.includes("stopped");

  return (
    <div className="card space-y-4 border border-ink-400/50">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            Gemini Engine Monitor
          </h3>
          <p className="text-sm text-slate-300">
            Free pool is used first. Paid pool activates only when free is
            unavailable.
          </p>
        </div>
        {showSummary && (
          <button
            onClick={handleReset}
            disabled={resetting || exhaustedEngines === 0}
            className="btn btn-secondary"
          >
            {resetting ? "Resetting..." : "Reset Engine State"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricBadge
          label="Current Tier"
          value={activeDispatchTier === "paid" ? "PAID" : "FREE"}
          className={
            activeDispatchTier === "paid"
              ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
              : "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
          }
        />
        <MetricBadge
          label="Free Pool"
          value={`A ${pools.free.available} | AC ${pools.free.active} | RL ${pools.free.rateLimited} | EX ${pools.free.exhausted}`}
          className="border-blue-500/40 bg-blue-600/10 text-blue-100"
        />
        <MetricBadge
          label="Paid Pool"
          value={`A ${pools.paid.available} | AC ${pools.paid.active} | RL ${pools.paid.rateLimited} | EX ${pools.paid.exhausted}`}
          className="border-violet-500/40 bg-violet-600/10 text-violet-100"
        />
      </div>

      {activeDispatchTier === "paid" && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-700/20 px-4 py-3 text-sm text-amber-100">
          Paid Gemini fallback is active. Free pool is unavailable.
        </div>
      )}

      {pollError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-200">
          Unable to refresh engine status. Retrying with backoff.
        </div>
      )}

      {keys.length > 0 && (
        <div className="table-scroll border border-ink-400/40 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-100/80 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Engine</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Busy</th>
                <th className="px-3 py-2 text-left">Requests</th>
                <th className="px-3 py-2 text-left">Success</th>
                <th className="px-3 py-2 text-left">Key Preview</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((engine) => (
                <tr
                  key={engine.engineId}
                  className="border-t border-ink-400/30"
                >
                  <td className="px-3 py-2 text-slate-100 font-semibold">
                    #{engine.engineId}
                  </td>
                  <td className="px-3 py-2">
                    <span className="badge border-ink-400/60 bg-ink-100/40 text-slate-200">
                      {engine.tier === "paid" ? "PAID" : "FREE"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={engine.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      {engine.busy ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      )}
                      {engine.busy ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {engine.metrics?.totalRequests ?? 0}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {engine.metrics?.successCount ?? 0}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">
                    {engine.keyPreview || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isPaused && (
        <div className="rounded-lg border border-amber-600/50 bg-amber-700/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-100">
            Session is paused. Resume when at least one engine is available.
          </p>
          <button
            onClick={handleResume}
            disabled={resuming || activeEngines === 0}
            className="btn bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {resuming ? "Resuming..." : "Resume Processing"}
          </button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Loading engine status...</p>
      )}

      <div className="text-xs text-slate-400 flex items-center justify-between gap-3">
        <span>
          Engines: {activeEngines} active, {busyEngines} busy,{" "}
          {rateLimitedEngines} rate limited, {exhaustedEngines} exhausted,{" "}
          {totalEngines} total.
        </span>
        <span>
          {isPolling || (!sessionId && !loading)
            ? `Polling every ${Math.round(pollInterval / 1000)}s`
            : isProcessingSessionStatus(sessionStatus)
              ? "Polling paused"
              : "Snapshot frozen"}
        </span>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, className }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${className}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  const className =
    normalized === "active"
      ? "bg-emerald-700/30 border-emerald-500/50 text-emerald-200"
      : normalized === "rate_limited"
        ? "bg-amber-700/30 border-amber-500/50 text-amber-200"
        : normalized === "exhausted"
          ? "bg-rose-700/30 border-rose-500/50 text-rose-200"
          : "bg-slate-700/30 border-slate-500/50 text-slate-200";

  return <span className={`badge border ${className}`}>{normalized}</span>;
}
