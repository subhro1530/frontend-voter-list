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

  const keys = apiStatus?.keys || [];
  const activeCount = keys.filter((k) => k.status === "active").length;
  const exhaustedCount = keys.filter((k) => k.status === "exhausted").length;
  const currentKey = apiStatus?.currentKey || apiStatus?.activeKey;
  const isPaused =
    sessionStatus?.toLowerCase?.()?.includes("paused") ||
    apiStatus?.sessionPaused;
  const lastPage = apiStatus?.lastProcessedPage || apiStatus?.stoppedAtPage;

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
