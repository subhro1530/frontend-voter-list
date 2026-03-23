import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resetApiKeys, resumeSession } from "../lib/api";
import { useEngineStatusPolling } from "../lib/useEngineStatusPolling";
import { useAuth } from "../context/AuthContext";
import {
  extractAutomaticRetryRounds,
  formatDispatchTierLabel,
  formatAutomaticRetryRounds,
  isProcessingSessionStatus,
} from "../lib/engineStatusMapper";
import {
  getDispatchModeMessage,
  normalizeDispatchMode,
} from "../lib/dispatchMode";

export default function ApiEngineStatus({
  sessionId,
  sessionStatus,
  onResume,
  onStatusChange,
  onDispatchTierChange,
  dispatchMode = "auto",
  pollInterval = 4000,
  showSummary = false,
}) {
  const { isAdmin } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showEngineTable, setShowEngineTable] = useState(false);
  const previousTierRef = useRef();

  const {
    statusSnapshot,
    dispatchTier,
    paidFallbackActive,
    loading,
    pollError,
    isPolling,
  } = useEngineStatusPolling({
    sessionId,
    sessionStatus,
    enabled: true,
    isAdmin,
    pollIntervalMs: pollInterval,
  });

  useEffect(() => {
    if (statusSnapshot) onStatusChange?.(statusSnapshot);
  }, [statusSnapshot, onStatusChange]);

  useEffect(() => {
    if (!dispatchTier) return;
    onDispatchTierChange?.(dispatchTier);
  }, [dispatchTier, onDispatchTierChange]);

  const keys = statusSnapshot?.engines || [];
  const totalEngines = statusSnapshot?.totalEngines || 0;
  const activeEngines = statusSnapshot?.activeEngines || 0;
  const busyEngines = statusSnapshot?.busyEngines || 0;
  const exhaustedEngines = statusSnapshot?.exhaustedEngines || 0;
  const rateLimitedEngines = statusSnapshot?.rateLimitedEngines || 0;
  const activeDispatchTier =
    dispatchTier || statusSnapshot?.activeDispatchTier || "free";
  const fallbackActive = paidFallbackActive || activeDispatchTier === "paid";
  const allExhausted = Boolean(statusSnapshot?.allExhausted);
  const normalizedDispatchMode = normalizeDispatchMode(dispatchMode);

  useEffect(() => {
    const previousTier = previousTierRef.current;
    if (
      previousTier === "free" &&
      activeDispatchTier === "paid" &&
      isProcessingSessionStatus(sessionStatus)
    ) {
      toast("Switched to paid fallback for continuity", { icon: "⚡" });
    }
    previousTierRef.current = activeDispatchTier;
  }, [activeDispatchTier, sessionStatus]);

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
      const response = await resumeSession(sessionId, normalizedDispatchMode);
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
          value={formatDispatchTierLabel(activeDispatchTier)}
          className={
            fallbackActive
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

      <div className="rounded-lg border border-ink-400/40 bg-ink-100/30 px-4 py-3 text-sm text-slate-200">
        {getDispatchModeMessage(normalizedDispatchMode)}
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          activeDispatchTier === "paid"
            ? "border-amber-500/50 bg-amber-700/20 text-amber-100"
            : "border-emerald-500/50 bg-emerald-700/20 text-emerald-100"
        }`}
      >
        {activeDispatchTier === "paid"
          ? "FREE pool unavailable. Using PAID fallback pool"
          : "Using FREE Gemini pool"}
      </div>

      {fallbackActive && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-700/20 px-4 py-3 text-sm text-amber-100">
          Paid Gemini fallback is active. Free pool is unavailable.
        </div>
      )}

      {rateLimitedEngines > 0 && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-700/15 px-4 py-3 text-sm text-blue-100">
          Backend is waiting for key cooldown windows; retries are adaptive.
        </div>
      )}

      {allExhausted && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-700/15 px-4 py-3 text-sm text-rose-100">
          Wait for quota recovery or add more paid keys.
        </div>
      )}

      {normalizedDispatchMode === "free-only" &&
        (allExhausted || pools.free.available <= 0) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-700/15 px-4 py-3 text-sm text-amber-100">
            Switch to Turbo for faster completion.
          </div>
        )}

      {pollError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-200">
          Engine status temporarily unavailable
        </div>
      )}

      {isAdmin && keys.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowEngineTable((prev) => !prev)}
          >
            {showEngineTable ? "Hide Engine Table" : "Show Engine Table"}
          </button>
        </div>
      )}

      {isAdmin && keys.length > 0 && showEngineTable && (
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
                <th className="px-3 py-2 text-left">Recovery time</th>
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
                  <td className="px-3 py-2 text-slate-300">
                    {formatRecoveryTime(engine.recoveryTimeMs, engine.status)}
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
          {isPolling
            ? `Polling every ${Math.round(pollInterval / 1000)}s`
            : "Snapshot frozen"}
        </span>
      </div>
    </div>
  );
}

function formatRecoveryTime(recoveryTimeMs, status) {
  if (status !== "rate_limited") return "-";
  const ms = Number(recoveryTimeMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "Adaptive";
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}s`;
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
