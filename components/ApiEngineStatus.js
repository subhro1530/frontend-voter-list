import { useEffect, useState, useCallback } from "react";
import { getApiKeysStatus, resetApiKeys, resumeSession } from "../lib/api";

const ENGINE_NAMES = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
];

export default function ApiEngineStatus({
  sessionId,
  sessionStatus,
  onResume,
  pollInterval = 5000,
  showSummary = false,
}) {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = useCallback(async (signal) => {
    try {
      const data = await getApiKeysStatus(signal);
      setApiStatus(data);
      setError("");
    } catch (err) {
      if (err.name === "AbortError") return;
      // Silent fail - API might not support this endpoint
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal);

    // Poll for status updates
    const interval = setInterval(() => {
      fetchStatus(controller.signal);
    }, pollInterval);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchStatus, pollInterval]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetApiKeys();
      await fetchStatus();
    } catch (err) {
      setError("Failed to reset API keys");
    } finally {
      setResetting(false);
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    setResuming(true);
    try {
      await resumeSession(sessionId);
      onResume?.();
    } catch (err) {
      setError("Failed to resume session");
    } finally {
      setResuming(false);
    }
  };

  // If no API status data available, show minimal UI
  if (!apiStatus && !loading) {
    return null;
  }

  const keys = apiStatus?.keys || apiStatus?.engines || [];
  const activeCount = keys.filter(
    (k) => k.status === "active" && !k.busy
  ).length;
  const busyCount = keys.filter((k) => k.status === "active" && k.busy).length;
  const exhaustedCount = keys.filter((k) => k.status === "exhausted").length;
  const rateLimitedCount = keys.filter(
    (k) => k.status === "rate_limited"
  ).length;
  const currentKey = apiStatus?.currentKey || apiStatus?.activeKey;
  const isPaused =
    sessionStatus?.toLowerCase?.()?.includes("paused") ||
    sessionStatus?.toLowerCase?.()?.includes("stopped") ||
    apiStatus?.sessionPaused;
  const lastPage = apiStatus?.lastProcessedPage || apiStatus?.stoppedAtPage;

  // New metrics from backend 2.0/2.1
  const totalEngines = apiStatus?.totalEngines || keys.length;
  const activeEngines = apiStatus?.activeEngines || activeCount;
  const busyEngines = apiStatus?.busyEngines || busyCount;
  const exhaustedEngines = apiStatus?.exhaustedEngines || exhaustedCount;
  const rateLimitedEngines = apiStatus?.rateLimitedEngines || rateLimitedCount;

  // Show summary dashboard if requested (for admin pages)
  if (showSummary) {
    return (
      <div className="bg-ink-200 rounded-xl shadow-lg p-6 border border-ink-400">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🚀</span> API Engines
          </h2>
          <button
            onClick={handleReset}
            disabled={resetting || exhaustedEngines === 0}
            className="px-4 py-2 rounded-lg bg-neon-500 text-white font-semibold hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {resetting ? (
              <>
                <span className="animate-spin">⏳</span>
                Resetting...
              </>
            ) : (
              <>
                <span>🔄</span>
                Reset All
              </>
            )}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-blue-500/20 border border-blue-400/30 p-4 rounded-xl text-center">
            <div className="text-3xl font-bold text-blue-400">
              {totalEngines}
            </div>
            <div className="text-sm text-slate-400">Total</div>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/30 p-4 rounded-xl text-center">
            <div className="text-3xl font-bold text-emerald-400">
              {activeEngines}
            </div>
            <div className="text-sm text-slate-400">Active</div>
          </div>
          <div className="bg-amber-500/20 border border-amber-400/30 p-4 rounded-xl text-center">
            <div className="text-3xl font-bold text-amber-400">
              {busyEngines}
            </div>
            <div className="text-sm text-slate-400">Busy</div>
          </div>
          <div className="bg-orange-500/20 border border-orange-400/30 p-4 rounded-xl text-center">
            <div className="text-3xl font-bold text-orange-400">
              {rateLimitedEngines}
            </div>
            <div className="text-sm text-slate-400">Rate Limited</div>
          </div>
          <div className="bg-rose-500/20 border border-rose-400/30 p-4 rounded-xl text-center">
            <div className="text-3xl font-bold text-rose-400">
              {exhaustedEngines}
            </div>
            <div className="text-sm text-slate-400">Exhausted</div>
          </div>
        </div>

        {/* Engine Grid - 7 engines in a row */}
        <div className="grid grid-cols-7 gap-2">
          {keys.map((engine, idx) => {
            const engineId = engine.engineId || idx + 1;
            const isBusy = engine.busy;
            const isActive = engine.status === "active";
            const isExhausted = engine.status === "exhausted";
            const isRateLimited = engine.status === "rate_limited";
            const processed =
              engine.metrics?.engineProcessed || engine.requests || 0;

            return (
              <div
                key={engineId}
                className={`p-3 rounded-lg text-center border-2 transition-all ${
                  isExhausted
                    ? "bg-rose-900/30 border-rose-400/50"
                    : isRateLimited
                    ? "bg-orange-900/30 border-orange-400/50"
                    : isBusy
                    ? "bg-amber-900/30 border-amber-400/50 animate-pulse"
                    : isActive
                    ? "bg-emerald-900/30 border-emerald-400/50"
                    : "bg-slate-800/30 border-slate-600/50"
                }`}
              >
                <div className="font-bold text-slate-200">#{engineId}</div>
                <div className="text-xl mt-1">
                  {isExhausted
                    ? "❌"
                    : isRateLimited
                    ? "⏳"
                    : isBusy
                    ? "⚡"
                    : isActive
                    ? "✅"
                    : "💤"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {processed} done
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-900/30 border border-rose-600 rounded-lg text-rose-200 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="api-engine-panel">
      {/* Header with toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="api-engine-header"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Gemini API Engines
            </h3>
            <p className="text-xs text-slate-400">
              {activeCount} active • {exhaustedCount} exhausted •{" "}
              {keys.length - activeCount - exhaustedCount} standby
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini status indicators */}
          <div className="flex items-center gap-1">
            {keys.slice(0, 7).map((key, idx) => (
              <div
                key={idx}
                className={`engine-dot ${
                  key.status === "active"
                    ? "engine-dot-active"
                    : key.status === "exhausted"
                    ? "engine-dot-exhausted"
                    : "engine-dot-standby"
                } ${
                  currentKey === idx || currentKey === key.id
                    ? "engine-dot-current"
                    : ""
                }`}
                title={`Engine ${ENGINE_NAMES[idx] || idx + 1}: ${key.status}`}
              />
            ))}
          </div>
          <span
            className={`text-slate-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="api-engine-content">
          {/* Current Engine Indicator */}
          {currentKey !== undefined && currentKey !== null && (
            <div className="current-engine-indicator">
              <span className="current-engine-icon">🔥</span>
              <div>
                <span className="text-xs text-slate-400">Currently Using</span>
                <span className="current-engine-name">
                  Engine {ENGINE_NAMES[currentKey] || currentKey + 1}
                </span>
              </div>
            </div>
          )}

          {/* Engine Grid */}
          <div className="engine-grid">
            {keys.map((key, idx) => {
              const isCurrent = currentKey === idx || currentKey === key.id;
              const isActive = key.status === "active";
              const isExhausted = key.status === "exhausted";

              return (
                <div
                  key={idx}
                  className={`engine-card ${
                    isExhausted
                      ? "engine-card-exhausted"
                      : isActive
                      ? "engine-card-active"
                      : "engine-card-standby"
                  } ${isCurrent ? "engine-card-current" : ""}`}
                >
                  <div className="engine-card-header">
                    <span className="engine-card-icon">
                      {isExhausted ? "🔴" : isActive ? "🟢" : "🟡"}
                    </span>
                    <span className="engine-card-name">
                      {ENGINE_NAMES[idx] || `Key ${idx + 1}`}
                    </span>
                    {isCurrent && (
                      <span className="engine-current-badge">IN USE</span>
                    )}
                  </div>
                  <div className="engine-card-status">
                    {isExhausted
                      ? "Quota Exhausted"
                      : isActive
                      ? "Ready"
                      : "Standby"}
                  </div>
                  {key.usage !== undefined && (
                    <div className="engine-usage">
                      <div className="engine-usage-bar">
                        <div
                          className="engine-usage-fill"
                          style={{
                            width: `${Math.min(100, key.usage || 0)}%`,
                          }}
                        />
                      </div>
                      <span className="engine-usage-text">
                        {key.usage?.toFixed?.(0) || 0}% used
                      </span>
                    </div>
                  )}
                  {key.requests !== undefined && (
                    <div className="text-xs text-slate-400">
                      {key.requests} requests
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Paused Session Alert */}
          {isPaused && (
            <div className="paused-alert">
              <div className="paused-alert-content">
                <span className="text-2xl">⏸️</span>
                <div>
                  <h4 className="text-sm font-semibold text-amber-100">
                    Session Paused
                  </h4>
                  <p className="text-xs text-amber-200/80">
                    All API keys exhausted. Processing stopped at page{" "}
                    {lastPage || "unknown"}.
                  </p>
                </div>
              </div>
              <button
                onClick={handleResume}
                disabled={resuming || activeCount === 0}
                className="resume-btn"
              >
                {resuming ? (
                  <>
                    <span className="resume-spinner" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <span>▶️</span>
                    Resume Processing
                  </>
                )}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="engine-actions">
            <button
              onClick={handleReset}
              disabled={resetting || exhaustedCount === 0}
              className="reset-keys-btn"
            >
              {resetting ? (
                <>
                  <span className="reset-spinner" />
                  Resetting...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Reset All Keys
                </>
              )}
            </button>
            <div className="text-xs text-slate-400">
              Auto-switches when a key is exhausted
            </div>
          </div>

          {error && <div className="text-sm text-rose-400 mt-2">{error}</div>}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-3 text-sm text-slate-400">
          Loading engine status...
        </div>
      )}
    </div>
  );
}
